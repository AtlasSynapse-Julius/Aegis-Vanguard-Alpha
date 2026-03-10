/**
 * Scans API and PDF report.
 * Copyright (c) Atlas Synapse.
 */

import { Router, Request, Response } from "express";
import { query, getClient } from "../db.js";
import { runPythonScan, runCrawler } from "../scanRunner.js";
import type {
  ScanRow, VulnerabilityRow, ScanResult, VulnerabilityResult,
  DiscoveredEndpointRow, DiscoveredEndpointResult,
} from "../types.js";
import PDFDocument from "pdfkit";

const router = Router();

const SCAN_COLS = `id, target_url, status, vulnerabilities_count, critical_count, risk_score, notes, lead_status, created_at, completed_at`;

function mapScan(
  row: ScanRow,
  vulns?: VulnerabilityResult[],
  endpoints?: DiscoveredEndpointResult[],
): ScanResult {
  return {
    id: row.id,
    target_url: row.target_url,
    status: row.status as ScanResult["status"],
    vulnerabilities_count: row.vulnerabilities_count,
    critical_count: row.critical_count ?? 0,
    risk_score: row.risk_score != null ? Number(row.risk_score) : null,
    notes: row.notes,
    lead_status: (row.lead_status || "New") as ScanResult["lead_status"],
    created_at: row.created_at.toISOString(),
    completed_at: row.completed_at?.toISOString() ?? null,
    ...(vulns && { vulnerabilities: vulns }),
    ...(endpoints && { discovered_endpoints: endpoints }),
  };
}

function mapEndpoint(row: DiscoveredEndpointRow): DiscoveredEndpointResult {
  return {
    id: row.id,
    scan_id: row.scan_id,
    url: row.url,
    type: row.type as DiscoveredEndpointResult["type"],
    description: row.description,
    created_at: row.created_at.toISOString(),
  };
}

function mapVuln(row: VulnerabilityRow): VulnerabilityResult {
  return {
    id: row.id,
    scan_id: row.scan_id,
    category: row.category,
    severity: row.severity as VulnerabilityResult["severity"],
    title: row.title,
    description: row.description,
    score: row.score != null ? Number(row.score) : null,
    created_at: row.created_at.toISOString(),
  };
}

// POST /api/scans
router.post("/", async (req: Request, res: Response) => {
  try {
    const { target_url, notes } = req.body || {};
    if (!target_url || typeof target_url !== "string") {
      res.status(400).json({ error: "target_url is required" });
      return;
    }
    const rows = await query<ScanRow[]>(
      `INSERT INTO scans (target_url, status, notes) VALUES ($1, 'pending', $2)
       RETURNING ${SCAN_COLS}`,
      [target_url.trim(), notes || null]
    );
    const scan = mapScan(rows[0]);
    const doCrawl = req.body.crawl === true;

    (async () => {
      if (doCrawl) {
        try {
          await runCrawler(scan.id, target_url.trim());
        } catch (err) {
          console.error("Crawler error (non-fatal):", err);
        }
      }
      await runPythonScan(scan.id, target_url.trim());
    })().catch((err) => {
      console.error("Scan pipeline error:", err);
    });

    res.status(201).json(scan);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create scan" });
  }
});

// GET /api/scans
router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await query<ScanRow[]>(
      `SELECT ${SCAN_COLS} FROM scans ORDER BY created_at DESC LIMIT 100`
    );
    res.json(rows.map((r) => mapScan(r)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list scans" });
  }
});

// GET /api/scans/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scans = await query<ScanRow[]>(
      `SELECT ${SCAN_COLS} FROM scans WHERE id = $1`,
      [id]
    );
    if (!scans.length) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }
    const vulnRows = await query<VulnerabilityRow[]>(
      `SELECT id, scan_id, category, severity, title, description, score, created_at
       FROM vulnerabilities WHERE scan_id = $1 ORDER BY severity DESC, score DESC NULLS LAST`,
      [id]
    );
    const epRows = await query<DiscoveredEndpointRow[]>(
      `SELECT id, scan_id, url, type, description, created_at
       FROM discovered_endpoints WHERE scan_id = $1 ORDER BY type, url`,
      [id]
    );
    res.json(mapScan(scans[0], vulnRows.map(mapVuln), epRows.map(mapEndpoint)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get scan" });
  }
});

// POST /api/scans/:id/crawl — run endpoint discovery on an existing scan
router.post("/:id/crawl", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scans = await query<ScanRow[]>(
      `SELECT id, target_url FROM scans WHERE id = $1`,
      [id]
    );
    if (!scans.length) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }
    runCrawler(id, scans[0].target_url).then((result) => {
      if (!result) console.error("Crawler returned null for scan", id);
    }).catch((err) => {
      console.error("Crawler error:", err);
    });
    res.json({ status: "crawling", scan_id: id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to start crawl" });
  }
});

// GET /api/scans/:id/endpoints — list discovered endpoints for a scan
router.get("/:id/endpoints", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await query<DiscoveredEndpointRow[]>(
      `SELECT id, scan_id, url, type, description, created_at
       FROM discovered_endpoints WHERE scan_id = $1 ORDER BY type, url`,
      [id]
    );
    res.json(rows.map(mapEndpoint));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list endpoints" });
  }
});

// PATCH /api/scans/:id — update lead_status and/or notes
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { lead_status, notes } = req.body || {};
    const validStatuses = ["New", "Contacted", "Qualified", "Proposal", "Closed Won", "Closed Lost"];
    if (lead_status !== undefined && !validStatuses.includes(lead_status)) {
      res.status(400).json({ error: `lead_status must be one of: ${validStatuses.join(", ")}` });
      return;
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (lead_status !== undefined) {
      sets.push(`lead_status = $${idx++}`);
      params.push(lead_status);
    }
    if (notes !== undefined) {
      sets.push(`notes = $${idx++}`);
      params.push(notes || null);
    }
    if (!sets.length) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    params.push(id);
    const rows = await query<ScanRow[]>(
      `UPDATE scans SET ${sets.join(", ")} WHERE id = $${idx} RETURNING ${SCAN_COLS}`,
      params
    );
    if (!rows.length) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }
    res.json(mapScan(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update scan" });
  }
});

// GET /api/scans/:id/report
router.get("/:id/report", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scans = await query<ScanRow[]>(
      `SELECT ${SCAN_COLS} FROM scans WHERE id = $1`,
      [id]
    );
    if (!scans.length) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }
    const vulnRows = await query<VulnerabilityRow[]>(
      `SELECT id, scan_id, category, severity, title, description, score, created_at
       FROM vulnerabilities WHERE scan_id = $1 ORDER BY severity DESC, score DESC NULLS LAST`,
      [id]
    );
    const scan = mapScan(scans[0], vulnRows.map(mapVuln));
    const vulns = scan.vulnerabilities || [];

    const riskPercent = scan.risk_score != null ? Math.min(100, Math.round(Number(scan.risk_score))) : 0;
    const letterGrade = riskPercent <= 10 ? "A" : riskPercent <= 30 ? "B" : riskPercent <= 50 ? "C" : riskPercent <= 70 ? "D" : "F";
    const gradeColorHex = letterGrade === "A" ? "#22c55e" : letterGrade === "B" ? "#38bdf8" : letterGrade === "C" ? "#eab308" : letterGrade === "D" ? "#f97316" : "#ef4444";

    const severityOrder = ["Critical", "High", "Medium", "Low"] as const;
    const severityCounts = severityOrder.map((s) => ({
      severity: s,
      count: vulns.filter((v) => v.severity === s).length,
    }));
    const severityColorHex: Record<string, string> = {
      Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#6b7280",
    };

    const reportNum = id.replace(/-/g, "").slice(0, 5).toUpperCase();
    const reportId = `AV-${reportNum}`;
    const reportDate = new Date(scan.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const reportTime = new Date(scan.created_at).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportId}-report.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    doc.pipe(res);

    const pageW = doc.page.width;
    const marginL = 50;
    const contentW = pageW - 100;

    // --- CONFIDENTIAL BANNER ---
    doc.rect(0, 0, pageW, 28).fill("#dc2626");
    doc.fontSize(9).fillColor("#ffffff")
      .text("CONFIDENTIAL — AUTHORIZED RECIPIENTS ONLY", 0, 8, { align: "center", width: pageW });

    // --- HEADER ---
    doc.fillColor("#111827");
    doc.moveDown(2);
    doc.fontSize(24).fillColor("#1e40af").text("AEGIS VANGUARD", marginL, 50, { align: "center", width: contentW });
    doc.fontSize(11).fillColor("#6b7280").text("AI Security Assessment Report", marginL, 78, { align: "center", width: contentW });
    doc.moveDown(0.5);

    doc.moveTo(marginL, 100).lineTo(pageW - 50, 100).lineWidth(1).strokeColor("#d1d5db").stroke();

    // --- REPORT META ---
    const metaY = 112;
    doc.fontSize(8).fillColor("#9ca3af");
    doc.text(`Report ID: ${reportId}`, marginL, metaY);
    doc.text(`Date: ${reportDate} at ${reportTime}`, marginL, metaY + 12);
    doc.text(`Target: ${scan.target_url}`, marginL, metaY + 24);
    doc.text(`Scan Status: ${scan.status.toUpperCase()}`, marginL, metaY + 36);

    // --- EXECUTIVE SUMMARY ---
    const sumY = 170;
    doc.fontSize(14).fillColor("#111827").text("Executive Summary", marginL, sumY);
    doc.moveTo(marginL, sumY + 18).lineTo(pageW - 50, sumY + 18).lineWidth(0.5).strokeColor("#e5e7eb").stroke();

    // Risk score box
    const boxY = sumY + 30;
    doc.roundedRect(marginL, boxY, 130, 80, 6).fillAndStroke("#f9fafb", "#e5e7eb");
    doc.fontSize(8).fillColor("#6b7280").text("RISK SCORE", marginL + 10, boxY + 8, { width: 110, align: "center" });
    doc.fontSize(32).fillColor(gradeColorHex).text(
      scan.risk_score != null ? scan.risk_score.toFixed(1) : "N/A",
      marginL + 10, boxY + 22, { width: 110, align: "center" }
    );
    doc.fontSize(18).fillColor(gradeColorHex).text(
      `(${letterGrade})`, marginL + 10, boxY + 56, { width: 110, align: "center" }
    );

    // Findings box
    doc.roundedRect(marginL + 145, boxY, 130, 80, 6).fillAndStroke("#f9fafb", "#e5e7eb");
    doc.fontSize(8).fillColor("#6b7280").text("TOTAL FINDINGS", marginL + 155, boxY + 8, { width: 110, align: "center" });
    doc.fontSize(32).fillColor("#111827").text(
      String(scan.vulnerabilities_count), marginL + 155, boxY + 28, { width: 110, align: "center" }
    );

    // Severity distribution box
    const sevBoxX = marginL + 290;
    const sevBoxW = contentW - 290;
    doc.roundedRect(sevBoxX, boxY, sevBoxW, 80, 6).fillAndStroke("#f9fafb", "#e5e7eb");
    doc.fontSize(8).fillColor("#6b7280").text("SEVERITY DISTRIBUTION", sevBoxX + 10, boxY + 8, { width: sevBoxW - 20 });

    let sevLineY = boxY + 24;
    for (const { severity, count } of severityCounts) {
      const color = severityColorHex[severity] || "#6b7280";
      doc.circle(sevBoxX + 16, sevLineY + 4, 4).fill(color);
      doc.fontSize(9).fillColor("#374151").text(`${severity}`, sevBoxX + 26, sevLineY, { continued: true });
      doc.fillColor("#6b7280").text(`  ${count}`, { continued: false });
      sevLineY += 14;
    }

    // --- RISK DESCRIPTION ---
    const descY = boxY + 95;
    const riskDescriptions: Record<string, string> = {
      A: "Excellent security posture. The target successfully defended against all tested attack vectors.",
      B: "Good security posture with minor concerns. A small number of findings were identified.",
      C: "Moderate risk. Several vulnerabilities were identified that should be addressed.",
      D: "Elevated risk. Multiple significant vulnerabilities require prompt remediation.",
      F: "Critical risk. Severe vulnerabilities detected. Immediate remediation is strongly recommended.",
    };
    doc.fontSize(9).fillColor("#374151").text(riskDescriptions[letterGrade] || "", marginL, descY, { width: contentW });

    // --- DETAILED FINDINGS ---
    let curY = descY + 30;
    doc.fontSize(14).fillColor("#111827").text("Detailed Findings", marginL, curY);
    curY += 18;
    doc.moveTo(marginL, curY).lineTo(pageW - 50, curY).lineWidth(0.5).strokeColor("#e5e7eb").stroke();
    curY += 12;

    if (vulns.length === 0) {
      doc.fontSize(10).fillColor("#6b7280").text("No vulnerabilities were recorded for this scan.", marginL, curY);
      curY += 20;
    }

    for (let i = 0; i < vulns.length; i++) {
      const v = vulns[i];
      const sevColor = severityColorHex[v.severity] || "#6b7280";

      if (curY > 700) {
        doc.addPage();
        curY = 50;
      }

      // Severity + category header
      doc.roundedRect(marginL, curY, contentW, 22, 3).fill("#f3f4f6");
      doc.circle(marginL + 12, curY + 11, 5).fill(sevColor);
      doc.fontSize(10).fillColor("#111827")
        .text(`${v.severity}`, marginL + 22, curY + 5, { continued: true })
        .fillColor("#6b7280").text(` — ${v.category}`, { continued: true })
        .fillColor("#9ca3af").text(`   #${i + 1}`, { continued: false });
      curY += 28;

      // Title
      doc.fontSize(9).fillColor("#111827").text(v.title, marginL + 10, curY, { width: contentW - 20 });
      curY += doc.heightOfString(v.title, { width: contentW - 20 }) + 4;

      // Description
      if (v.description) {
        const desc = v.description.length > 600 ? v.description.slice(0, 597) + "…" : v.description;
        doc.fontSize(8).fillColor("#4b5563").text(desc, marginL + 10, curY, { width: contentW - 20 });
        curY += doc.heightOfString(desc, { width: contentW - 20 }) + 4;
      }

      // Score
      if (v.score != null) {
        doc.fontSize(8).fillColor("#9ca3af").text(`Score: ${v.score.toFixed(1)} / 10`, marginL + 10, curY);
        curY += 14;
      }

      curY += 10;
    }

    // --- FOOTER on every page ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      const footY = doc.page.height - 40;
      doc.moveTo(marginL, footY - 5).lineTo(pageW - 50, footY - 5).lineWidth(0.5).strokeColor("#d1d5db").stroke();
      doc.fontSize(7).fillColor("#9ca3af")
        .text(`© 2026 Aegis Vanguard — Atlas Synapse LLC. All rights reserved.`, marginL, footY, { width: contentW * 0.7, align: "left" });
      doc.fontSize(7).fillColor("#9ca3af")
        .text(`${reportId}  |  Page ${i + 1} of ${pages.count}`, marginL, footY, { width: contentW, align: "right" });
    }

    doc.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate report" });
  }
});

export default router;
