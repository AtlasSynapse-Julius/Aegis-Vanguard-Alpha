/**
 * API and domain types.
 * Copyright (c) Atlas Synapse.
 */

export type ScanStatus = "pending" | "running" | "completed" | "failed";

export type Severity = "Critical" | "High" | "Medium" | "Low";

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Proposal" | "Closed Won" | "Closed Lost";

export interface ScanRow {
  id: string;
  target_url: string;
  status: string;
  vulnerabilities_count: number;
  critical_count: number;
  risk_score: number | null;
  notes: string | null;
  lead_status: string;
  created_at: Date;
  completed_at: Date | null;
}

export interface VulnerabilityRow {
  id: string;
  scan_id: string;
  category: string;
  severity: string;
  title: string;
  description: string | null;
  score: number | null;
  created_at: Date;
}

export type EndpointType = "chat" | "api" | "websocket" | "iframe";

export interface DiscoveredEndpointRow {
  id: string;
  scan_id: string;
  url: string;
  type: string;
  description: string | null;
  created_at: Date;
}

export interface DiscoveredEndpointResult {
  id: string;
  scan_id: string;
  url: string;
  type: EndpointType;
  description: string | null;
  created_at: string;
}

export interface CreateScanBody {
  target_url: string;
  notes?: string;
  crawl?: boolean;
}

export interface VulnerabilityResult {
  id: string;
  scan_id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string | null;
  score: number | null;
  created_at: string;
}

export interface ScanResult {
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
  vulnerabilities?: VulnerabilityResult[];
  discovered_endpoints?: DiscoveredEndpointResult[];
}
