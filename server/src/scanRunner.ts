/**
 * Spawns Python scan_runner and parses JSON output.
 * Copyright (c) Atlas Synapse.
 */

import { spawn } from "child_process";
import path from "path";
import { existsSync } from "fs";
import { getClient } from "./db.js";
import type { Severity } from "./types.js";

const serverDir = path.resolve(__dirname, "..");
const projectRoot = existsSync(path.join(process.cwd(), "scanner", "scan_runner.py"))
  ? process.cwd()
  : path.resolve(serverDir, "..");
const SCANNER_SCRIPT = path.join(projectRoot, "scanner", "scan_runner.py");
const CRAWLER_SCRIPT = path.join(projectRoot, "scanner", "crawler.py");

/** Scanner output format (DeepTeam + Gemini). */
export interface ScannerOutput {
  vulnerabilities: Array<{
    category: string;
    severity: string;
    title: string;
    description: string;
    score: number;
  }>;
  risk_score: number;
  status: "completed" | "failed";
  error?: string;
}

/** Crawler output format. */
export interface CrawlerOutput {
  endpoints: Array<{
    url: string;
    type: string;
    description: string;
  }>;
  pages_crawled: number;
  method: string;
  status: "completed" | "failed";
  error?: string;
}

function toCapitalizedSeverity(s: string): Severity {
  const lower = s.toLowerCase();
  if (lower === "critical") return "Critical";
  if (lower === "high") return "High";
  if (lower === "medium") return "Medium";
  if (lower === "low") return "Low";
  return "Low";
}

export function runPythonScan(scanId: string, targetUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const py = process.platform === "win32" ? "python" : "python3";
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    };
    if (process.env.GEMINI_API_KEY) env.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (process.env.GOOGLE_API_KEY) env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (process.env.GEMINI_API_KEY && !env.GOOGLE_API_KEY) env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
    if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    const child = spawn(py, [SCANNER_SCRIPT, targetUrl], {
      cwd: projectRoot,
      env,
    });

    let stdout = "";
    let stderr = "";

    getClient()
      .then((client) =>
        client
          .query("UPDATE scans SET status = $1 WHERE id = $2", ["running", scanId])
          .finally(() => client.release())
      )
      .catch((err) => console.error("Failed to set scan status to running:", err));

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      finishScan(scanId, "failed", null, []).then(resolve).catch(resolve);
      reject(err);
    });

    child.on("close", async (code) => {
      try {
        if (code !== 0) {
          console.error(`Scanner exited with code ${code}. stderr:`, stderr);
          await finishScan(scanId, "failed", null, []);
          return resolve();
        }
        let data: ScannerOutput;
        try {
          data = JSON.parse(stdout) as ScannerOutput;
        } catch {
          console.error("Failed to parse scanner JSON. stdout:", stdout.slice(0, 500), "stderr:", stderr.slice(0, 500));
          await finishScan(scanId, "failed", null, []);
          return resolve();
        }
        if (data.status === "failed" || data.error) {
          console.error("Scanner reported failure:", data.error, "stderr:", stderr.slice(0, 500));
          await finishScan(scanId, "failed", null, []);
          return resolve();
        }

        const vulns = (data.vulnerabilities || []).map((v) => ({
          category: v.category,
          severity: toCapitalizedSeverity(v.severity),
          title: v.title,
          description: v.description || null,
          score: typeof v.score === "number" ? v.score : null,
        }));

        const riskScore = typeof data.risk_score === "number" ? data.risk_score : null;
        await finishScan(scanId, "completed", riskScore, vulns);
      } catch (err) {
        console.error("Error in scan close handler:", err);
        await finishScan(scanId, "failed", null, []).catch(() => {});
      }
      resolve();
    });
  });
}

async function finishScan(
  scanId: string,
  status: "completed" | "failed",
  riskScore: number | null,
  vulns: Array<{ category: string; severity: Severity; title: string; description: string | null; score: number | null }>
): Promise<void> {
  const criticalCount = vulns.filter((v) => v.severity === "Critical").length;
  const client = await getClient();
  try {
    await client.query(
      `UPDATE scans SET status = $1, risk_score = $2, vulnerabilities_count = $3, critical_count = $4, completed_at = NOW() WHERE id = $5`,
      [status, riskScore, vulns.length, criticalCount, scanId]
    );
    for (const v of vulns) {
      await client.query(
        `INSERT INTO vulnerabilities (scan_id, category, severity, title, description, score)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [scanId, v.category, v.severity, v.title, v.description, v.score]
      );
    }
  } finally {
    client.release();
  }
}

export function runCrawler(scanId: string, targetUrl: string): Promise<CrawlerOutput | null> {
  return new Promise((resolve) => {
    const py = process.platform === "win32" ? "python" : "python3";
    const child = spawn(py, [CRAWLER_SCRIPT, targetUrl, "--max-pages", "10", "--timeout", "30"], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("error", () => resolve(null));

    child.on("close", async (code) => {
      if (code !== 0) {
        console.error(`Crawler exited with code ${code}. stderr:`, stderr.slice(0, 500));
        return resolve(null);
      }
      let data: CrawlerOutput;
      try {
        data = JSON.parse(stdout) as CrawlerOutput;
      } catch {
        console.error("Failed to parse crawler JSON. stdout:", stdout.slice(0, 500));
        return resolve(null);
      }

      if (data.endpoints?.length) {
        const client = await getClient();
        try {
          for (const ep of data.endpoints) {
            await client.query(
              `INSERT INTO discovered_endpoints (scan_id, url, type, description) VALUES ($1, $2, $3, $4)`,
              [scanId, ep.url, ep.type, ep.description || null]
            );
          }
        } finally {
          client.release();
        }
      }

      resolve(data);
    });
  });
}
