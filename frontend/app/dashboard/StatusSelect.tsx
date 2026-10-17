"use client";

import { STATUSES, STATUS_LABELS, type AppStatus } from "@/lib/savedJobs";

export default function StatusSelect({
  value,
  onChange,
}: {
  value: AppStatus;
  onChange: (status: AppStatus) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="sr-only sm:not-sr-only">Status</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AppStatus)}
        aria-label="Update status"
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
