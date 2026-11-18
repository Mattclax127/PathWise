import TaskList from "@/components/TaskList";
import { SECTIONS, type JourneyTask } from "@/lib/journey/types";

/** Plain list of every stage and its tasks. The accessible, no-graphics equivalent of the map. */
export default function JourneyList({ tasks }: { tasks: JourneyTask[] }) {
  return (
    <div>
      {SECTIONS.map((s) => {
        const mine = tasks.filter((t) => t.section === s.key && t.is_applicable);
        const done = mine.filter((t) => t.status === "completed").length;
        return (
          <div className="card" key={s.key}>
            <div className="row"><h2 style={{ fontSize: 20 }}>{s.label}</h2><span className="chip">{mine.length ? `${done} of ${mine.length}` : "Not applicable"}</span></div>
            <TaskList tasks={tasks.filter((t) => t.section === s.key)} all={tasks} />
          </div>
        );
      })}
    </div>
  );
}
