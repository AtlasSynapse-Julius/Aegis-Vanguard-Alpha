import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createScan } from "../api";

export default function NewScan() {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("Creating scan…");
    setLoading(true);
    try {
      const scan = await createScan({ target_url: url.trim(), notes: notes.trim() || undefined });
      setPhase("Scan running… You can open the scan detail for live status.");
      navigate(`/scans/${scan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start scan");
      setPhase(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold text-white mb-6">New Scan</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-white/80 mb-1">
            Target URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/chat"
            required
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="mt-1 text-xs text-white/50">
            Base URL of the LLM API. Scanner will POST to /chat with {"{ input, turns }"} and expect {"{ content }"}.
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-white/80 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes for this scan"
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {phase && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            {phase}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-primary text-background font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Launching…" : "Launch Scan"}
        </button>
      </form>
    </div>
  );
}
