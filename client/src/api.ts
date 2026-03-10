export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type Severity = "Critical" | "High" | "Medium" | "Low";
export type EndpointType = "chat" | "api" | "websocket" | "iframe";
export type LeadStatus = "New" | "Contacted" | "Qualified" | "Proposal" | "Closed Won" | "Closed Lost";

const TOKEN_KEY = "aegis_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const r = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (r.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  return r;
}

export async function login(password: string): Promise<void> {
  const r = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || "Login failed");
  }
  const { token } = await r.json();
  setToken(token);
}

export function logout(): void {
  clearToken();
  window.location.href = "/login";
}

export interface Vulnerability {
  id: string;
  scan_id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string | null;
  score: number | null;
  created_at: string;
}

export interface DiscoveredEndpoint {
  id: string;
  scan_id: string;
  url: string;
  type: EndpointType;
  description: string | null;
  created_at: string;
}

export interface Scan {
  id: string;
  target_url: string;
  status: ScanStatus;
  vulnerabilities_count: number;
  critical_count: number;
  risk_score: number | null;
  notes: string | null;
  lead_status: LeadStatus;
  created_at: string;
  completed_at: string | null;
  vulnerabilities?: Vulnerability[];
  discovered_endpoints?: DiscoveredEndpoint[];
}

const API = "/api";
export async function listScans(): Promise<Scan[]> {
  const r = await authFetch(`${API}/scans`);
  if (!r.ok) throw new Error("Failed to fetch scans");
  return r.json();
}

export async function getScan(id: string): Promise<Scan> {
  const r = await authFetch(`${API}/scans/${id}`);
  if (!r.ok) throw new Error("Failed to fetch scan");
  return r.json();
}

export async function createScan(body: { target_url: string; notes?: string; crawl?: boolean }): Promise<Scan> {
  const r = await authFetch(`${API}/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to create scan");
  return r.json();
}

export async function crawlScan(id: string): Promise<{ status: string; scan_id: string }> {
  const r = await authFetch(`${API}/scans/${id}/crawl`, { method: "POST" });
  if (!r.ok) throw new Error("Failed to start crawl");
  return r.json();
}

export async function getEndpoints(id: string): Promise<DiscoveredEndpoint[]> {
  const r = await authFetch(`${API}/scans/${id}/endpoints`);
  if (!r.ok) throw new Error("Failed to fetch endpoints");
  return r.json();
}

export async function updateScan(id: string, body: { lead_status?: LeadStatus; notes?: string }): Promise<Scan> {
  const r = await authFetch(`${API}/scans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to update scan");
  return r.json();
}

export function reportUrl(id: string): string {
  const token = getToken();
  return `${API}/scans/${id}/report${token ? `?token=${token}` : ""}`;
}
