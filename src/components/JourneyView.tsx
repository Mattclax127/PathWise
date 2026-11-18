"use client";
import { useState } from "react";
import IslandMap from "@/components/map/IslandMap";
import JourneyList from "@/components/JourneyList";
import type { MapModel } from "@/lib/map/mapModel";
import type { JourneyTask } from "@/lib/journey/types";

export default function JourneyView({ model, tasks, journeyId }: { model: MapModel; tasks: JourneyTask[]; journeyId: string }) {
  const [view, setView] = useState<"map" | "list">("map");
  return (
    <section aria-label="Journey">
      <div role="group" aria-label="View" style={{ margin: "8px 0" }}>
        <button className={`btn ${view === "map" ? "" : "ghost"}`} aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>{" "}
        <button className={`btn ${view === "list" ? "" : "ghost"}`} aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
      </div>
      {view === "map" ? <IslandMap model={model} journeyId={journeyId} /> : <JourneyList tasks={tasks} />}
    </section>
  );
}
