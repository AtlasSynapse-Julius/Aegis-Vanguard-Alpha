import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { listScans, updateScan, type Scan, type LeadStatus } from "../api";

const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Closed Won",
  "Closed Lost",
];

const STATUS_COLORS: Record<LeadStatus, string> = {
  New: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Contacted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Qualified: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Proposal: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Closed Won": "bg-green-500/20 text-green-400 border-green-500/30",
  "Closed Lost": "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function LeadCRM() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "All">("All");
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listScans().then(setScans).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    listScans()
      .then(setScans)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: string, newStatus: LeadStatus) => {
    setSaving(id);
    try {
      const updated = await updateScan(id, { lead_status: newStatus });
      setScans((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    } catch {
      refresh();
    } finally {
      setSaving(null);
    }
  };

  const handleNotesSave = async (id: string) => {
    setSaving(id);
    try {
      const updated = await updateScan(id, { notes: notesDraft });
      setScans((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    } catch {
      refresh();
    } finally {
      setSaving(null);
      setEditingNotes(null);
    }
  };

  const filtered = filter === "All" ? scans : scans.filter((s) => s.lead_status === filter);

  const counts = LEAD_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: scans.filter((sc) => sc.lead_status === s).length }),
    {} as Record<LeadStatus, number>,
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-white/60">Loading leads…</div>
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
        <h1 className="text-2xl font-semibold text-white">Lead CRM</h1>
        <p className="text-white/50 text-sm mt-1">
          Track scan leads through the sales pipeline
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "All" : s)}
            className={`p-3 rounded-lg border text-left transition-all ${
              filter === s
                ? STATUS_COLORS[s] + " ring-1 ring-white/20"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="text-xs text-white/50 uppercase tracking-wider">{s}</div>
            <div className="text-xl font-semibold text-white mt-1">{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      {filter !== "All" && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-white/60 text-sm">Filtered by:</span>
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[filter]}`}>
            {filter}
          </span>
          <button
            onClick={() => setFilter("All")}
            className="text-white/40 hover:text-white text-xs ml-1"
          >
            Clear
          </button>
        </div>
      )}

      <div className="border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Target</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Scan Status</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Risk</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Findings</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Lead Status</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Notes</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm">Date</th>
              <th className="px-4 py-3 text-white/60 font-medium text-sm"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                <td
                  className="px-4 py-3 text-white font-mono text-sm truncate max-w-[180px]"
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
                <td className="px-4 py-3 text-white text-sm">
                  {s.vulnerabilities_count}
                  {(s.critical_count ?? 0) > 0 && (
                    <span className="text-red-400 ml-1">({s.critical_count} crit)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={s.lead_status}
                    onChange={(e) => handleStatusChange(s.id, e.target.value as LeadStatus)}
                    disabled={saving === s.id}
                    className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer outline-none ${STATUS_COLORS[s.lead_status]} ${
                      saving === s.id ? "opacity-50" : ""
                    }`}
                  >
                    {LEAD_STATUSES.map((ls) => (
                      <option key={ls} value={ls} className="bg-gray-900 text-white">
                        {ls}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  {editingNotes === s.id ? (
                    <div className="flex gap-1">
                      <input
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleNotesSave(s.id);
                          if (e.key === "Escape") setEditingNotes(null);
                        }}
                        className="w-full px-2 py-1 rounded text-xs bg-white/10 border border-white/20 text-white outline-none focus:border-primary"
                        autoFocus
                        placeholder="Add notes…"
                      />
                      <button
                        onClick={() => handleNotesSave(s.id)}
                        disabled={saving === s.id}
                        className="px-2 py-1 rounded text-xs bg-primary/20 text-primary hover:bg-primary/30 whitespace-nowrap"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingNotes(s.id);
                        setNotesDraft(s.notes || "");
                      }}
                      className="text-white/50 hover:text-white text-xs text-left truncate block w-full"
                      title={s.notes || "Click to add notes"}
                    >
                      {s.notes || "—"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/scans/${s.id}`}
                    className="text-primary hover:underline text-xs whitespace-nowrap"
                  >
                    View Scan
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-white/50">
            {filter === "All" ? "No leads yet. Run a scan to create one." : `No leads with status "${filter}".`}
          </div>
        )}
      </div>
    </div>
  );
}
