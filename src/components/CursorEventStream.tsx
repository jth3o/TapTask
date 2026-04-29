import { CursorRunInfo } from "@/lib/types";

type CursorEventStreamProps = {
  events: CursorRunInfo["events"];
};

export function CursorEventStream({ events }: CursorEventStreamProps) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cursor Events</p>
      <ul className="space-y-1 text-xs text-slate-700">
        {events.map((event, index) => (
          <li key={`${event}-${index}`}>- {event}</li>
        ))}
      </ul>
    </div>
  );
}
