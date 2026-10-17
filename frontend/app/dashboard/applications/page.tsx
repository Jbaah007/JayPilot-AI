"use client";

import Link from "next/link";
import { useSavedJobs, STATUSES, STATUS_LABELS } from "@/lib/savedJobs";
import StatusSelect from "../StatusSelect";

export default function ApplicationsPage() {
  const { jobs, loading, error, changeStatus } = useSavedJobs();

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
      <p className="mt-1 text-slate-600">Track where each saved job stands. Changes are saved automatically.</p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading your applications...</p>
      ) : jobs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold">No applications to track yet.</p>
          <p className="mt-1 text-slate-600">Save a job and it will appear here as Saved.</p>
          <Link
            href="/dashboard/jobs"
            className="mt-5 inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Find Jobs
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STATUSES.map((stage) => {
            const items = jobs.filter((j) => j.status === stage);
            return (
              <section key={stage} className="rounded-2xl bg-slate-100 p-3">
                <h2 className="flex items-center justify-between px-1 pb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                  {STATUS_LABELS[stage]}
                  <span className="rounded-full bg-white px-2 py-0.5 text-slate-500">{items.length}</span>
                </h2>
                <ul className="space-y-3">
                  {items.map((job) => (
                    <li key={job.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                      <p className="font-semibold">{job.title}</p>
                      <p className="text-slate-500">{job.company}</p>
                      <p className="mt-1 text-xs font-medium text-indigo-700">Status: {STATUS_LABELS[job.status]}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <StatusSelect value={job.status} onChange={(s) => changeStatus(job.id, s)} />
                        {job.apply_url && (
                          <a
                            href={job.apply_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            View Job
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                  {items.length === 0 && <li className="px-1 py-3 text-xs text-slate-400">Nothing here yet.</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
