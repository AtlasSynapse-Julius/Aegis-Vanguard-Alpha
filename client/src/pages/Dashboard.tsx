import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listScans, type Scan } from "../api";

export default function Dashboard() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasRunning = scans.some((s) => s.status === "running" || s.status === "pending");

  useEffect(() => {
    listScans()
      .then(setScans)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => {
      listScans().then(setScans).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  const totalScans = scans.length;
  const completed = scans.filter((s) => s.status === "completed");
  const avgRisk =
    completed.length > 0
      ? completed.reduce((a, s) => a + (s.risk_score ?? 0), 0) / completed.length
      : null;
  const criticalCount = scans.reduce((a, s) => a + (s.critical_count ?? 0), 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-white/60">Loading…</div>
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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-white/60 text-sm uppercase tracking-wider">Total Scans</div>
          <div className="text-2xl font-semibold text-primary mt-1">{totalScans}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-white/60 text-sm uppercase tracking-wider">Avg Risk Score</div>
          <div className="text-2xl font-semibold text-white mt-1">
            {avgRisk != null ? avgRisk.toFixed(2) : "—"}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-white/60 text-sm uppercase tracking-wider">Critical Findings</div>
          <div className="text-2xl font-semibold text-warning mt-1">{criticalCount}</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium text-white mb-3">Recent Scans</h2>
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-4 py-3 text-white/60 font-medium">Target</th>
                <th className="px-4 py-3 text-white/60 font-medium">Status</th>
                <th className="px-4 py-3 text-white/60 font-medium">Risk</th>
                <th className="px-4 py-3 text-white/60 font-medium">Findings</th>
                <th className="px-4 py-3 text-white/60 font-medium">Date</th>
                <th className="px-4 py-3 text-white/60 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {scans.slice(0, 10).map((s) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white font-mono text-sm truncate max-w-[200px]" title={s.target_url}>
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
                  <td className="px-4 py-3 text-white">
                    {s.risk_score != null ? s.risk_score.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-white">{s.vulnerabilities_count}</td>
                  <td className="px-4 py-3 text-white/70 text-sm">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/scans/${s.id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scans.length === 0 && (
            <div className="px-4 py-8 text-center text-white/50">No scans yet. Launch one from New Scan.</div>
          )}
        </div>
      </section>
    </div>
  );
}
