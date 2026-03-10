# Aegis Vanguard — Product Roadmap

**Classification:** Internal — Atlas Synapse  
**Aligned to:** Aegis Vanguard Institutional Product Brief (Feb 2026)

---

## Current state (Alpha)

- **Stack:** React + Vite + Tailwind frontend, Express + TypeScript backend, PostgreSQL, Python scanner (DeepTeam).
- **Scan flow:** Single target URL → Python scanner (Gemini-backed red-team or **static-attack fallback**) → risk score + findings → PDF report.
- **UI:** Scan list, scan detail with risk score, letter grade (A–F), severity distribution, vulnerability cards, PDF download.
- **No Gemini required:** Set `USE_STATIC_ATTACKS=1` or rely on automatic fallback when Gemini fails (quota/network).

---

## Phase 1 — Scanner reliability ✅

- [x] Static attack prompts when Gemini is unavailable (no more 38 “Error simulating” findings).
- [x] Rule-based scoring for PII Leakage, Prompt Leakage, Toxicity, Bias, Misinformation.
- [x] Scan detail: letter grade, severity distribution, banner when all findings are Gemini errors.

---

## Phase 2 — Executive scorecard (brief-aligned)

- [ ] **Risk heatmap:** Category × severity matrix (e.g. Recharts or CSS grid).
- [ ] **Letter grades (A–F)** on dashboard tiles and PDF (done on detail; extend to list and report).
- [ ] **PDF branding:** AEGIS VANGUARD Security header, CONFIDENTIAL banner, AV-XXXXX report IDs (partially present; verify against brief).
- [ ] **Severity-weighted risk formula:** Align 0–100 risk score with OWASP/NIST (currently count-based; refine weights).

---

## Phase 3 — Crawl4AI endpoint discovery

- [ ] Integrate Crawl4AI (or equivalent) to discover AI chat endpoints, iframes, WebSockets, streaming APIs from a target URL.
- [ ] Store `discovered_endpoints` (url, type, metadata) and run red-team scans per endpoint (or primary).
- [ ] Scan flow: Enter URL → Crawl phase → Choose/auto-select endpoints → Red-team → Report.

---

## Phase 4 — Lead CRM & sales pipeline

- [ ] **Tables:** `lead_status` (New | Contacted | Qualified | Proposal | Closed Won | Closed Lost), `notes` on scan targets.
- [ ] **UI:** Lead CRM view, pipeline stages, filters, notes.
- [ ] **Reporting:** Scan history and reports tied to lead status for “sales infiltrator” workflow.

---

## Phase 5 — S3 evidence archival

- [ ] **Config:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`.
- [ ] **Paths:** `aegis-vanguard/scans/{domain}/{scanId}/` for logs, evidence, PDF.
- [ ] **Upload:** On scan completion, push report + artifacts to S3; store `pdfUrl` / `s3EvidencePath` in DB.

---

## Phase 6 — tRPC + type-safe API

- [ ] Migrate Express REST to tRPC (or add tRPC alongside) with Superjson.
- [ ] Shared types for scans, vulnerabilities, endpoints; end-to-end type safety with client.

---

## Phase 7 — Auth & multi-tenant

- [ ] **Manus OAuth + JWT (jose):** Session-based auth, role-based access (admin/user).
- [ ] **Env:** `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `OWNER_NAME`.
- [ ] Dashboard and scans filtered by `userId`; admin sees all.

---

## Phase 8 — Database (MySQL/TiDB + Drizzle)

- [ ] **Current:** PostgreSQL + raw SQL in Alpha.
- [ ] **Brief:** MySQL (TiDB) + Drizzle ORM, schema-first, `pnpm db:push` for migrations.
- [ ] Migrate schema and queries to Drizzle; preserve `scan_targets`, `discovered_endpoints`, `vulnerabilities`, `scan_logs`, `users`.

---

## Phase 9 — Vercel deployment

- [ ] **Config:** `vercel.json` with SPA rewrites, API forwarding, static cache.
- [ ] **Env:** All required vars in Vercel dashboard; serverless-compatible DB (e.g. PlanetScale/TiDB serverless).
- [ ] Cold-start mitigation (e.g. health-check cron, connection pooling).

---

## References

- Aegis Vanguard Institutional Product Brief (Feb 2026) — Sections 1–5.
- OWASP Top 10 for LLM Applications (2025).
- NIST AI Risk Management Framework.

---

*Atlas Synapse — Aegis Vanguard*
