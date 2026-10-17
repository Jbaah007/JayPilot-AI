"use client";

import Link from "next/link";
import { useSavedJobs, STATUS_LABELS } from "@/lib/savedJobs";
import StatusSelect from "../StatusSelect";

export default function SavedJobsPage() {
  const { jobs, loading, error, changeStatus, remove } = useSavedJobs();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Saved Jobs</h1>
      <p className="mt-1 text-slate-600">Jobs you saved from real listings.</p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading your saved jobs...</p>
      ) : jobs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold">No saved jobs yet.</p>
          <p className="mt-1 text-slate-600">Find jobs that interest you and save them here.</p>
          <Link
            href="/dashboard/jobs"
            className="mt-5 inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Find Jobs
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{job.title}</h2>
                  <p className="text-sm text-slate-500">
                    {job.company}
                    {job.location && ` · ${job.location}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {job.match_score !== null && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {job.match_score}% Resume Match
                    </span>
                  )}
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {STATUS_LABELS[job.status]}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <StatusSelect value={job.status} onChange={(s) => changeStatus(job.id, s)} />
                {job.apply_url && (
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-indigo-600 hover:underline"
                  >
                    View Job
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => remove(job.id)}
                  className="text-sm font-semibold text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
