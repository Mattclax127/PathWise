"use client";
import { useState } from "react";
import Link from "next/link";
import TaskList from "@/components/TaskList";
import type { StageNode } from "@/lib/engine/engine";
import type { JourneyTask } from "@/lib/journey/types";

const STATE_TEXT = { not_applicable: "Not applicable", not_started: "Not started", in_progress: "In progress", completed: "Completed" } as const;

/** Reads persisted task state only. The marker is a view of saved data, never the source of truth. */
export default function JourneyMap({ nodes, tasks }: { nodes: StageNode[]; tasks: JourneyTask[] }) {
  const [view, setView] = useState<"map" | "list">("map");
  const [open, setOpen] = useState<string | null>(nodes.find((n) => n.isFocus)?.section ?? null);
  const openNode = nodes.find((n) => n.section === open) ?? null;
  const byPos = [...nodes].sort((a, b) => a.map_y - b.map_y || a.map_x - b.map_x);
  const path = byPos.map((n, i) => `${i ? "L" : "M"}${n.map_x * 6} ${n.map_y * 6}`).join(" ");

  return (
    <section aria-label="Journey map">
      <div role="group" aria-label="View" style={{ margin: "8px 0" }}>
        <button className={`btn ${view === "map" ? "" : "ghost"}`} aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>{" "}
        <button className={`btn ${view === "list" ? "" : "ghost"}`} aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
      </div>
      {view === "map" && (
        <div className="map" style={{ position: "relative", height: 560 }}>
          <svg viewBox="0 0 600 600" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <path d={path} fill="none" stroke="#9FB0D3" strokeWidth="5" strokeDasharray="2 12" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {nodes.map((n) => (
            <button key={n.section} type="button" className={`node ${n.state} ${n.isFocus ? "focus" : ""}`} aria-expanded={open === n.section}
              aria-label={`${n.label}: ${STATE_TEXT[n.state]}, ${n.done} of ${n.total} done${n.isFocus ? ", your current focus" : ""}${n.isParallel ? ", also open" : ""}`}
              style={{ left: `${n.map_x}%`, top: `${n.map_y * 0.9 + 4}%` }} onClick={() => setOpen(open === n.section ? null : n.section)}>
              {n.isFocus && <span className="you" aria-hidden="true">You are here</span>}
              <strong>{n.label}</strong>
              <span style={{ fontSize: 12 }}>{n.state === "not_applicable" ? "Not applicable" : `${n.done} of ${n.total}`}</span>
              {n.official > 0 && <span style={{ fontSize: 11 }}>{n.officialConfirmed} of {n.official} official confirmed{n.waiting ? ` · ${n.waiting} waiting` : ""}</span>}
              {n.isParallel && !n.isFocus && <span className="chip" style={{ fontSize: 10 }}>Also open</span>}
            </button>
          ))}
        </div>
      )}
      {view === "list" && (
        <div>{nodes.map((n) => (
          <div className="card" key={n.section}>
            <div className="row"><h2 style={{ fontSize: 20 }}>{n.label}</h2><span className="chip">{n.state === "not_applicable" ? "Not applicable" : `${n.done} of ${n.total}`}</span></div>
            <TaskList tasks={tasks.filter((t) => t.section === n.section)} all={tasks} />
          </div>
        ))}</div>
      )}
      {view === "map" && openNode && (
        <div className="card" style={{ marginTop: 16 }} aria-live="polite">
          <div className="row"><h2 style={{ fontSize: 20 }}>{openNode.label}</h2>
            <button className="btn ghost" onClick={() => setOpen(null)}>Close</button></div>
          {openNode.section === "employer_journey" && <p><Link href="/journey/employer">Open Employer Discovery and workspace</Link></p>}
          {openNode.section === "sponsor_journey" && <p><Link href="/journey/sponsor">Open Sponsor journey</Link> · <Link href="/sponsors">Compare sponsors</Link></p>}
          <TaskList tasks={tasks.filter((t) => t.section === openNode.section)} all={tasks} />
        </div>
      )}
    </section>
  );
}
