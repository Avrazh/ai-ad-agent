"use client";

import { useState, useEffect, useCallback } from "react";

type HeadlineMap = Record<string, Record<string, string>>;

export default function DebugHeadlines() {
  const [data, setData] = useState<HeadlineMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/persona-headlines");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClear = async () => {
    if (!confirm("Clear all headlines from the DB? They will be regenerated on next upload.")) return;
    setClearing(true);
    try {
      await fetch("/api/persona-headlines", { method: "DELETE" });
      setData({});
      setCleared(true);
    } finally {
      setClearing(false);
    }
  };

  const total = data ? Object.values(data).reduce((n, tones) => n + Object.keys(tones).length, 0) : 0;
  const personaCount = data ? Object.keys(data).length : 0;

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold">Persona Headlines</h1>
            {!loading && data && (
              <p className="text-sm text-gray-500 mt-1">
                {personaCount} personas · {total} headline slots
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition disabled:opacity-40"
            >
              Refresh
            </button>
            <button
              onClick={handleClear}
              disabled={clearing || loading}
              className="px-4 py-2 text-sm rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition disabled:opacity-40"
            >
              {clearing ? "Clearing…" : "Clear Headlines"}
            </button>
          </div>
        </div>

        {cleared && (
          <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
            Headlines cleared. Upload any image to regenerate.
          </div>
        )}

        {loading && (
          <p className="text-gray-500 text-sm">Loading…</p>
        )}

        {!loading && data && Object.keys(data).length === 0 && (
          <p className="text-gray-500 text-sm">No headlines in DB. Upload an image to generate them.</p>
        )}

        {!loading && data && Object.entries(data).map(([personaId, tones]) => (
          <div key={personaId} className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{personaId}</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {Object.entries(tones).map(([tone, headline]) => (
                <div key={tone} className="flex items-baseline gap-4 px-4 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 w-24 shrink-0">{tone}</span>
                  <span className="text-sm text-gray-300">{headline}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
