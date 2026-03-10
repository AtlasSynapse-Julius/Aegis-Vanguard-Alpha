import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listScans, reportUrl, type Scan, type ScanStatus } from "../api";

type RiskFilter = "all" | "critical" | "high" | "medium" | "low";
const PAGE_SIZE = 20;

function letterGrade(score: number | null): { grade: string; color: string } {
  if (score == null) return { grade: "—", color: "text-white/40" };
  const p = Math.min(100, Math.round(score));
  if (p <= 10) return { grade: "A", color: "text-green-400" };
  if (p <= 30) return { grade: "B", color: "text-blue-400" };
  if (p <= 50) return { grade: "C", color: "text-yellow-400" };
  if (p <= 70) return { grade: "D", color: "text-orange-400" };
  return { grade: "F", color: "text-red-400" };
}

function riskBucket(score: number | null): RiskFilter {
  if (score == null) return "low";
  if (score >= 70) return "critical";
  if (score >= 50) return "high";
  if (score >= 20) return "medium";
  return "low";
}

export default function ScanHistory() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ScanStatus | "all">("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    listScans()
      .then(setScans)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(0); }, [statusFilter, riskFilter]);

  const filtered = scans
    .filter((s) => statusFilter === "all" || s.status === statusFilter)
    .filter((s) => riskFilter === "all" || riskBucket(s.risk_score) === riskFilter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageScans = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusCounts = {
    all: scans.length,
    completed: scans.filter((s) => s.status === "completed").length,
    failed: scans.filter((s) => s.status === "failed").length,
    running: scans.filter((s) => s.status === "running" || s.status === "pending").length,
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-white/60">Loading scan history…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Scan History</h1>
        <p className="text-white/50 text-sm mt-1">
          {filtered.length} scan{filtered.length !== 1 ? "s" : ""} found
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs uppercase tracking-wider">Status:</span>
          {(["all", "completed", "failed", "running"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? s === "completed" ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                    : s === "failed" ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                    : s === "running" ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30"
                    : "bg-white/10 text-white ring-1 ring-white/20"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1 opacity-60">
                {s === "running" ? statusCounts.running : statusCounts[s]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <span className="text-white/50 text-xs uppercase tracking-wider">Risk:</span>
          {(["all", "critical", "high", "medium", "low"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r === riskFilter ? "all" : r)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                riskFilter === r
                  ? r === "critical" ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                    : r === "high" ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30"
                    : r === "medium" ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30"
                    : r === "low" ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                    : "bg-white/10 text-white ring-1 ring-white/20"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Target URL</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Status</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Risk</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Grade</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Findings</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Critical</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Date</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageScans.map((s) => {
              const { grade, color } = letterGrade(s.risk_score);
              return (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                  <td
                    className="px-4 py-3 text-white font-mono text-sm truncate max-w-[220px]"
                    title={s.target_url}
                  >
                    {s.target_url}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        s.status === "completed"
                          ? "bg-primary/20 text-primary"
                          : s.status === "failed"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-warning/20 text-warning"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white text-sm">
                    {s.risk_score != null ? s.risk_score.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-lg font-bold ${color}`}>{grade}</span>
                  </td>
                  <td className="px-4 py-3 text-white text-sm">{s.vulnerabilities_count}</td>
                  <td className="px-4 py-3 text-sm">
                    {(s.critical_count ?? 0) > 0 ? (
                      <span className="text-red-400 font-medium">{s.critical_count}</span>
                    ) : (
                      <span className="text-white/40">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString()}
                    <br />
                    <span className="text-white/40">
                      {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/scans/${s.id}`}
                        className="text-primary hover:underline text-xs"
                      >
                        Details
                      </Link>
                      {(s.status === "completed" || s.status === "failed") && (
                        <a
                          href={reportUrl(s.id)}
                          download
                          className="text-white/50 hover:text-white text-xs"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-white/50">
            No scans match the current filters.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-white/50 text-sm">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-2.5 py-1.5 rounded text-xs bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="px-2.5 py-1.5 rounded text-xs bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const p = start + i;
              if (p >= totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium ${
                    p === page
                      ? "bg-primary/20 text-primary"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1.5 rounded text-xs bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1.5 rounded text-xs bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
