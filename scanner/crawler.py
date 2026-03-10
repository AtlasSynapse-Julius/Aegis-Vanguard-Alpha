#!/usr/bin/env python3
"""
Aegis Vanguard — Endpoint discovery crawler.
Crawls a target website to find AI chat endpoints, API surfaces,
embedded chatbot iframes, and WebSocket connections.

Uses crawl4ai when available, falls back to requests + BeautifulSoup.
Outputs a JSON array of discovered endpoints to stdout.

Usage:
  python3 scanner/crawler.py https://example.com
  python3 scanner/crawler.py https://example.com --max-pages 20 --timeout 30

Copyright (c) Atlas Synapse.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests

ENDPOINT_PATTERNS = {
    "chat": [
        r"/chat\b", r"/api/chat\b", r"/v\d+/chat\b", r"/completions\b",
        r"/messages\b", r"/conversation\b", r"/ask\b", r"/query\b",
        r"/assistant\b", r"/bot\b", r"/ai\b", r"/llm\b",
    ],
    "api": [
        r"/api/", r"/v\d+/", r"/graphql\b", r"/rest/", r"/rpc\b",
        r"/webhook\b", r"/endpoint\b",
    ],
    "websocket": [
        r"wss?://[^\s\"']+",
    ],
}

CHATBOT_IFRAME_PATTERNS = [
    r"intercom", r"drift", r"crisp", r"tidio", r"zendesk",
    r"freshchat", r"hubspot", r"livechat", r"chatwoot",
    r"botpress", r"dialogflow", r"kommunicate", r"tawk",
]

SCRIPT_CHAT_PATTERNS = [
    r"chatbot", r"chat[-_]?widget", r"live[-_]?chat", r"messenger",
    r"ai[-_]?assistant", r"openai", r"anthropic", r"langchain",
    r"websocket.*chat", r"socket\.io",
]


def _classify_url(url: str) -> Optional[str]:
    """Classify a URL as chat/api/websocket or None."""
    lower = url.lower()
    if re.search(r"wss?://", lower):
        return "websocket"
    for pattern in ENDPOINT_PATTERNS["chat"]:
        if re.search(pattern, lower):
            return "chat"
    for pattern in ENDPOINT_PATTERNS["api"]:
        if re.search(pattern, lower):
            return "api"
    return None


def _extract_from_html(html: str, base_url: str) -> list[dict]:
    """Extract endpoints from raw HTML using regex (no BS4 required)."""
    endpoints = []
    seen = set()

    href_matches = re.findall(r'(?:href|src|action|data-url)\s*=\s*["\']([^"\']+)["\']', html, re.I)
    for href in href_matches:
        full = urljoin(base_url, href)
        etype = _classify_url(full)
        if etype and full not in seen:
            seen.add(full)
            endpoints.append({
                "url": full,
                "type": etype,
                "description": f"Found in HTML attribute ({etype} endpoint)",
            })

    iframe_srcs = re.findall(r'<iframe[^>]+src\s*=\s*["\']([^"\']+)["\']', html, re.I)
    for src in iframe_srcs:
        full = urljoin(base_url, src)
        lower = full.lower()
        for pattern in CHATBOT_IFRAME_PATTERNS:
            if re.search(pattern, lower):
                if full not in seen:
                    seen.add(full)
                    endpoints.append({
                        "url": full,
                        "type": "iframe",
                        "description": f"Embedded chatbot iframe ({pattern})",
                    })
                break

    script_srcs = re.findall(r'<script[^>]+src\s*=\s*["\']([^"\']+)["\']', html, re.I)
    for src in script_srcs:
        full = urljoin(base_url, src)
        lower = full.lower()
        for pattern in SCRIPT_CHAT_PATTERNS:
            if re.search(pattern, lower):
                if full not in seen:
                    seen.add(full)
                    endpoints.append({
                        "url": full,
                        "type": "chat",
                        "description": f"Chat-related script ({pattern})",
                    })
                break

    inline_scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.I | re.S)
    for script in inline_scripts:
        ws_urls = re.findall(r'wss?://[^\s"\'`<>]+', script)
        for ws in ws_urls:
            if ws not in seen:
                seen.add(ws)
                endpoints.append({
                    "url": ws,
                    "type": "websocket",
                    "description": "WebSocket URL found in inline script",
                })
        api_urls = re.findall(r'["\']((https?://[^\s"\'`]+)?/api/[^\s"\'`<>]+)["\']', script)
        for match in api_urls:
            url_str = match[0]
            full = urljoin(base_url, url_str)
            etype = _classify_url(full) or "api"
            if full not in seen:
                seen.add(full)
                endpoints.append({
                    "url": full,
                    "type": etype,
                    "description": "API endpoint found in inline script",
                })

    return endpoints


def crawl_with_crawl4ai(target_url: str, max_pages: int = 10, timeout: int = 30) -> list[dict]:
    """Use crawl4ai for deep crawling with JS rendering."""
    from crawl4ai import WebCrawler

    crawler = WebCrawler(verbose=False)
    crawler.warmup()

    all_endpoints = []
    seen_urls = set()
    pages_to_crawl = [target_url]
    pages_crawled = set()

    while pages_to_crawl and len(pages_crawled) < max_pages:
        url = pages_to_crawl.pop(0)
        if url in pages_crawled:
            continue
        pages_crawled.add(url)

        try:
            result = crawler.run(url=url)
        except Exception:
            continue

        html = getattr(result, "html", "") or ""
        endpoints = _extract_from_html(html, url)
        for ep in endpoints:
            if ep["url"] not in seen_urls:
                seen_urls.add(ep["url"])
                all_endpoints.append(ep)

        internal_links = getattr(result, "links", {})
        base_domain = urlparse(target_url).netloc
        for link_list in (internal_links.get("internal", []), internal_links.get("external", [])):
            for link in link_list:
                href = link.get("href", "") if isinstance(link, dict) else str(link)
                if href and urlparse(href).netloc == base_domain and href not in pages_crawled:
                    pages_to_crawl.append(href)

    return all_endpoints


def crawl_with_requests(target_url: str, max_pages: int = 10, timeout: int = 30) -> list[dict]:
    """Fallback: crawl using requests (no JS rendering)."""
    all_endpoints = []
    seen_urls = set()
    pages_to_crawl = [target_url]
    pages_crawled = set()
    base_domain = urlparse(target_url).netloc

    headers = {
        "User-Agent": "AegisVanguard/1.0 (endpoint-discovery)",
        "Accept": "text/html,application/xhtml+xml,*/*",
    }

    while pages_to_crawl and len(pages_crawled) < max_pages:
        url = pages_to_crawl.pop(0)
        if url in pages_crawled:
            continue
        pages_crawled.add(url)

        try:
            r = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
            r.raise_for_status()
            if "text/html" not in r.headers.get("content-type", ""):
                continue
            html = r.text
        except Exception:
            continue

        endpoints = _extract_from_html(html, url)
        for ep in endpoints:
            if ep["url"] not in seen_urls:
                seen_urls.add(ep["url"])
                all_endpoints.append(ep)

        page_links = re.findall(r'<a[^>]+href\s*=\s*["\']([^"\'#]+)["\']', html, re.I)
        for href in page_links:
            full = urljoin(url, href)
            parsed = urlparse(full)
            if parsed.netloc == base_domain and parsed.scheme in ("http", "https"):
                clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                if clean not in pages_crawled:
                    pages_to_crawl.append(clean)

    return all_endpoints


def _probe_common_paths(target_url: str, timeout: int = 10) -> list[dict]:
    """Probe well-known AI/chat endpoint paths on the target."""
    base = target_url.rstrip("/")
    common_paths = [
        "/chat", "/api/chat", "/api/v1/chat", "/api/v1/completions",
        "/api/v1/messages", "/api/query", "/api/ask", "/v1/chat/completions",
        "/webhook", "/api/webhook", "/graphql", "/api/graphql",
        "/ws", "/socket.io/",
    ]

    endpoints = []
    for path in common_paths:
        url = base + path
        try:
            r = requests.head(url, timeout=timeout, allow_redirects=True)
            if r.status_code < 405:
                etype = "websocket" if "/ws" in path or "socket" in path else _classify_url(url) or "api"
                endpoints.append({
                    "url": url,
                    "type": etype,
                    "description": f"Responded with HTTP {r.status_code} (probed common path)",
                })
        except Exception:
            continue

    return endpoints


def discover_endpoints(
    target_url: str,
    max_pages: int = 10,
    timeout: int = 30,
) -> dict:
    """Main entry point. Returns {"endpoints": [...], "pages_crawled": N, "method": "..."}."""

    method = "requests"
    try:
        endpoints = crawl_with_crawl4ai(target_url, max_pages, timeout)
        method = "crawl4ai"
    except ImportError:
        endpoints = crawl_with_requests(target_url, max_pages, timeout)
    except Exception:
        endpoints = crawl_with_requests(target_url, max_pages, timeout)

    probed = _probe_common_paths(target_url, timeout=min(timeout, 10))
    seen = {ep["url"] for ep in endpoints}
    for ep in probed:
        if ep["url"] not in seen:
            seen.add(ep["url"])
            endpoints.append(ep)

    return {
        "endpoints": endpoints,
        "pages_crawled": max_pages,
        "method": method,
        "status": "completed",
    }


def main():
    parser = argparse.ArgumentParser(description="Aegis Vanguard endpoint discovery crawler")
    parser.add_argument("url", help="Target website URL to crawl")
    parser.add_argument("--max-pages", type=int, default=10, help="Max pages to crawl")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")
    args = parser.parse_args()

    try:
        result = discover_endpoints(args.url, args.max_pages, args.timeout)
    except Exception as e:
        result = {
            "endpoints": [],
            "pages_crawled": 0,
            "method": "failed",
            "status": "failed",
            "error": str(e),
        }

    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
