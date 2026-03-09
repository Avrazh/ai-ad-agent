"use client";

import { useState } from "react";
import Link from "next/link";

// ── All styles available for the agent to use ─────────────────
const STYLE_GROUPS: { group: string; styles: { id: string; label: string }[] }[] = [
  {
    group: "AI Layouts",
    styles: [
      { id: "top_bottom",    label: "Top / Bottom" },
      { id: "split_left",    label: "Split Left" },
      { id: "split_right",   label: "Split Right" },
      { id: "full_overlay",  label: "Full Overlay" },
      { id: "bottom_bar",    label: "Bottom Bar" },
      { id: "color_block",   label: "Color Block" },
      { id: "frame_overlay", label: "Frame" },
      { id: "magazine",      label: "Magazine" },
      { id: "postcard",      label: "Postcard" },
      { id: "vertical_text", label: "Letters" },
    ],
  },
  {
    group: "Testimonial",
    styles: [
      { id: "quote_card",  label: "Quote" },
      { id: "star_review", label: "Stars" },
    ],
  },
  {
    group: "Luxury",
    styles: [
      { id: "luxury_editorial_left",  label: "Editorial" },
      { id: "luxury_soft_frame_open", label: "Frame Open" },
    ],
  },
];

// ── Mock run history (UI only for now) ───────────────────────
const MOCK_RUNS = [
  { date: "Today, 15:00",      images: 6, ads: 12, hasOutput: true  },
  { date: "Yesterday, 15:00",  images: 0, ads: 0,  hasOutput: false },
  { date: "Mon 3 Mar, 15:00",  images: 4, ads: 8,  hasOutput: true  },
  { date: "Sun 2 Mar, 15:00",  images: 2, ads: 4,  hasOutput: true  },
];

export default function AgentPage() {
  const [watchFolder,  setWatchFolder]  = useState("");
  const [outputFolder, setOutputFolder] = useState("");
  const [scanTime,     setScanTime]     = useState("15:00");
  const [isActive,     setIsActive]     = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(
    new Set(["top_bottom", "split_left", "full_overlay", "magazine", "postcard"])
  );

  const toggleStyle = (id: string) =>
    setSelectedStyles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const canActivate = watchFolder.trim().length > 0 && selectedStyles.size >= 2;

  const resolvedOutput = outputFolder.trim() || (watchFolder.trim() ? `${watchFolder.trim()}/to-be-reviewed` : "");

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F14] text-white">

      {/* Under development banner */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-[12px] text-amber-400 font-medium">
        <span>⚠</span>
        This feature is under development — configuration is not saved yet and no scans will run.
      </div>

      {/* ════ LEFT — Configuration ════════════════════════════════ */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-white/[0.06] overflow-y-auto">

        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-400 transition text-[13px] flex items-center gap-1.5"
            >
              ←
            </Link>
            <h1 className="text-base font-bold text-white tracking-tight">AI Agent</h1>
            {isActive && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-600">
            Watches a folder · generates 2 distinct ads per new image
          </p>
        </div>

        <div className="flex flex-col gap-0 flex-1">

          {/* Watch Folder */}
          <ConfigSection title="Watch Folder" description="Folder to scan for new images">
            <input
              type="text"
              value={watchFolder}
              onChange={e => setWatchFolder(e.target.value)}
              placeholder="/Users/me/products/incoming"
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-gray-600 font-mono outline-none focus:border-indigo-500/50 transition"
            />
          </ConfigSection>

          {/* Scan Time */}
          <ConfigSection title="Scan Time" description="Schedule a daily scan or trigger one immediately">
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={scanTime}
                onChange={e => setScanTime(e.target.value)}
                className="bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white font-mono outline-none focus:border-indigo-500/50 transition cursor-pointer w-[120px]"
              />
              <span className="text-[12px] text-gray-600 mr-1">daily</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <button
                disabled={!canActivate}
                className={
                  "shrink-0 text-[12px] font-medium px-3 py-2 rounded-lg border transition " +
                  (canActivate
                    ? "border-white/15 text-gray-300 hover:border-indigo-500/40 hover:text-indigo-300 hover:bg-indigo-500/5"
                    : "border-white/[0.06] text-gray-700 cursor-not-allowed")
                }
              >
                Run Now
              </button>
            </div>
          </ConfigSection>

          {/* Styles */}
          <ConfigSection
            title="Styles to Generate"
            description={
              selectedStyles.size < 2
                ? "Select at least 2 styles"
                : `${selectedStyles.size} selected — agent picks 2 most distinct per image`
            }
            descriptionWarning={selectedStyles.size < 2}
          >
            <div className="flex flex-col gap-4">
              {STYLE_GROUPS.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">
                    {group.group}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.styles.map(style => {
                      const on = selectedStyles.has(style.id);
                      return (
                        <button
                          key={style.id}
                          onClick={() => toggleStyle(style.id)}
                          className={
                            "px-3 py-1 rounded-lg border text-[12px] font-medium transition " +
                            (on
                              ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                              : "border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-400")
                          }
                        >
                          {style.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ConfigSection>

          {/* Output Folder */}
          <ConfigSection
            title="Output Folder"
            description="Finished ads land here for review — auto-filled if left empty"
          >
            <input
              type="text"
              value={outputFolder}
              onChange={e => setOutputFolder(e.target.value)}
              placeholder={resolvedOutput || "/Users/me/products/to-be-reviewed"}
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-gray-600 font-mono outline-none focus:border-indigo-500/50 transition"
            />
          </ConfigSection>

          {/* Activate */}
          <div className="px-5 py-5 border-t border-white/[0.06] mt-auto shrink-0">
            <button
              onClick={() => setIsActive(v => !v)}
              disabled={!canActivate}
              className={
                "w-full py-2.5 rounded-xl text-[13px] font-semibold transition flex items-center justify-center gap-2 " +
                (isActive
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15"
                  : canActivate
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed")
              }
            >
              {isActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  Deactivate Agent
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-white/40" />
                  Activate Agent
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* ════ RIGHT — Status + History ═══════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* Status bar */}
        <div className="shrink-0 border-b border-white/[0.06] px-8 py-4 flex items-center gap-6">
          {isActive ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[13px] font-medium text-emerald-400">Running</span>
              </div>
              <span className="text-[12px] text-gray-600">
                Next scan: <span className="text-gray-400 font-mono">{scanTime}</span> today
              </span>
              <span className="text-[12px] text-gray-600">
                Watching: <span className="text-gray-400 font-mono">{watchFolder || "—"}</span>
              </span>
            </>
          ) : (
            <span className="text-[13px] text-gray-600">
              Agent inactive — configure and activate to start
            </span>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 px-8 py-6">

          {/* Summary cards — only show when active */}
          {isActive && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <StatCard label="Today's new images"  value="6" />
              <StatCard label="Ads generated today" value="12" />
              <StatCard label="Total this week"      value="24" />
            </div>
          )}

          {/* Run history */}
          <div>
            <h2 className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest mb-4">
              Run History
            </h2>

            {MOCK_RUNS.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-700">
                <div className="text-4xl mb-3">⏱</div>
                <p className="text-[13px]">No runs yet</p>
                <p className="text-[12px] mt-1">Activate the agent to get started</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {MOCK_RUNS.map((run, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-4 hover:border-white/10 transition"
                  >
                    {/* Status dot */}
                    <div className={
                      "w-2 h-2 rounded-full shrink-0 " +
                      (run.images > 0 ? "bg-indigo-400" : "bg-white/20")
                    } />

                    {/* Date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/80 font-medium">{run.date}</p>
                      <p className="text-[12px] text-gray-600 mt-0.5">
                        {run.images === 0
                          ? "No new images found"
                          : `${run.images} new image${run.images !== 1 ? "s" : ""} → ${run.ads} ads generated`}
                      </p>
                    </div>

                    {/* Styles used chips */}
                    {run.images > 0 && (
                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-md px-2 py-0.5">
                          Magazine
                        </span>
                        <span className="text-[11px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-md px-2 py-0.5">
                          Split Left
                        </span>
                      </div>
                    )}

                    {/* Open button */}
                    {run.hasOutput && (
                      <button className="shrink-0 text-[12px] text-gray-500 hover:text-gray-300 border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition font-medium">
                        Open folder →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function ConfigSection({
  title,
  description,
  descriptionWarning,
  children,
}: {
  title: string;
  description?: string;
  descriptionWarning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-white/[0.06]">
      <div className="mb-3">
        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        {description && (
          <p className={
            "text-[11px] mt-0.5 " +
            (descriptionWarning ? "text-amber-500/80" : "text-gray-600")
          }>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-4">
      <p className="text-[11px] text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
