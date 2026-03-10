import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getScan, reportUrl, type Scan, type Severity } from "../api";

const SEVERITY_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"];
const SEVERITY_CLASS: Record<Severity, string> = {
  Critical: "border-red-500/50 bg-red-500/10 text-red-400",
  High: "border-warning/50 bg-warning/10 text-warning",
  Medium: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
  Low: "border-white/20 bg-white/5 text-white/80",
};

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getScan(id)
      .then(setScan)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !scan || (scan.status !== "pending" && scan.status !== "running")) return;
    const t = setInterval(() => getScan(id).then(setScan), 2000);
    return () => clearInterval(t);
  }, [id, scan?.status]);

  if (loading || !scan) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-white/60">{loading ? "Loading…" : "Scan not found."}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8">
        <div className="text-warning">Error: {error}</div>
      </div>
    );
  }

  const vulns = scan.vulnerabilities ?? [];
  const bySeverity = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    items: vulns.filter((v) => v.severity === sev),
  }));

  const riskPercent = scan.risk_score != null ? Math.min(100, Math.round(Number(scan.risk_score))) : 0;
  const letterGrade = riskPercent <= 10 ? "A" : riskPercent <= 30 ? "B" : riskPercent <= 50 ? "C" : riskPercent <= 70 ? "D" : "F";
  const gradeColor = letterGrade === "A" ? "text-green-400" : letterGrade === "B" ? "text-primary" : letterGrade === "C" ? "text-yellow-400" : letterGrade === "D" ? "text-orange-400" : "text-red-400";
  const allFindingsAreErrors = vulns.length > 0 && vulns.every((v) => (v.description || "").includes("Error:"));
  const severityCounts = SEVERITY_ORDER.map((s) => ({ severity: s, count: vulns.filter((v) => v.severity === s).length }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/" className="text-primary hover:underline text-sm mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-white">Scan Detail</h1>
          <p className="text-white/60 font-mono text-sm mt-1 truncate max-w-2xl" title={scan.target_url}>
            {scan.target_url}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(scan.status === "completed" || scan.status === "failed") && (
            <a
              href={reportUrl(scan.id)}
              download
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors text-sm"
            >
              Download PDF Report
            </a>
          )}
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
              scan.status === "completed"
                ? "bg-primary/20 text-primary"
                : scan.status === "failed"
                ? "bg-red-500/20 text-red-400"
                : "bg-warning/20 text-warning"
            }`}
          >
            {scan.status}
          </span>
        </div>
      </div>

      {(scan.status === "pending" || scan.status === "running") && (
        <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/30 text-primary flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          Scan in progress. This page refreshes every few seconds.
        </div>
      )}

      {scan.status === "completed" && allFindingsAreErrors && (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col gap-1">
          <span className="font-medium">LLM API unavailable (Claude/Gemini)</span>
          <span className="text-sm opacity-90">
            Scans completed using static attack prompts only. For full red-team coverage, set ANTHROPIC_API_KEY or GEMINI_API_KEY with quota, or run the target at <code className="bg-white/10 px-1 rounded">http://host.docker.internal:5001</code> and retry.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-white/60 text-sm uppercase tracking-wider">Risk Score</div>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <div className="text-3xl font-semibold text-white">
              {scan.risk_score != null ? scan.risk_score.toFixed(1) : "—"}
            </div>
            <span className={`text-2xl font-bold ${gradeColor}`}>({letterGrade})</span>
            {scan.risk_score != null && (
              <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, riskPercent)}%` }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-white/60 text-sm uppercase tracking-wider">Findings</div>
          <div className="text-2xl font-semibold text-white mt-1">{scan.vulnerabilities_count}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 md:col-span-2">
          <div className="text-white/60 text-sm uppercase tracking-wider mb-2">Severity distribution</div>
          <div className="flex gap-2 flex-wrap items-center">
            {severityCounts.filter(({ count }) => count > 0).map(({ severity, count }) => (
              <div key={severity} className={`flex items-center gap-1.5 px-2 py-1 rounded ${SEVERITY_CLASS[severity]}`}>
                <span className="text-sm font-medium">{severity}</span>
                <span className="text-sm opacity-90">({count})</span>
              </div>
            ))}
          </div>
          {scan.completed_at && (
            <div className="text-white/50 text-xs mt-2">Completed {new Date(scan.completed_at).toLocaleString()}</div>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium text-white mb-3">Vulnerabilities by severity</h2>
        <div className="space-y-4">
          {bySeverity.map(
            ({ severity, items }) =>
              items.length > 0 && (
                <div key={severity}>
                  <h3 className="text-sm font-medium text-white/70 mb-2">
                    {severity} ({items.length})
                  </h3>
                  <div className="space-y-2">
                    {items.map((v) => (
                      <div
                        key={v.id}
                        className={`p-4 rounded-lg border ${SEVERITY_CLASS[v.severity]}`}
                      >
                        <div className="font-medium">{v.title}</div>
                        <div className="text-xs opacity-80 mt-1">{v.category}</div>
                        {v.description && (
                          <p className="mt-2 text-sm opacity-90 whitespace-pre-wrap line-clamp-3">
                            {v.description}
                          </p>
                        )}
                        {v.score != null && (
                          <div className="mt-2 text-xs">Score: {v.score.toFixed(2)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
        {vulns.length === 0 && scan.status === "completed" && (
          <div className="p-6 rounded-lg bg-white/5 border border-white/10 text-white/60 text-center">
            No vulnerabilities recorded for this scan.
          </div>
        )}
        {vulns.length === 0 && (scan.status === "pending" || scan.status === "running") && (
          <div className="p-6 rounded-lg bg-white/5 border border-white/10 text-white/60 text-center">
            Vulnerabilities will appear when the scan completes.
          </div>
        )}
      </section>
    </div>
  );
}
