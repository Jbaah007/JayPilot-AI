"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "./DashboardShell";
import { useProfile } from "../ProfileContext";
import { API_BASE } from "@/lib/auth";
import { getSummary, STATUSES, STATUS_LABELS, type Summary } from "@/lib/savedJobs";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  apply_url: string | null;
  match?: { match_score: number };
};

function StatCard({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value ?? "–"}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const user = useUser();
  const { profile } = useProfile();
  const [loaded, setLoaded] = useState<{ term: string; jobs: Job[] } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    let active = true;
    getSummary()
      .then((data) => active && setSummary(data))
      .catch(() => active && setSummaryError(true));
    return () => {
      active = false;
    };
  }, []);
  const searchTerm = profile?.job_search_terms[0];
  const loading = !!searchTerm && loaded?.term !== searchTerm;
  const jobs = loaded && loaded.term === searchTerm ? loaded.jobs : [];

  useEffect(() => {
    if (!profile || !searchTerm) return;
    let active = true;
    fetch(`${API_BASE}/jobs/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchTerm, results_per_page: 5, candidate_profile: profile }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => active && setLoaded({ term: searchTerm, jobs: data?.jobs ?? [] }))
      .catch(() => active && setLoaded({ term: searchTerm, jobs: [] }));
    return () => {
      active = false;
    };
  }, [profile, searchTerm]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.name}</h1>
        <p className="mt-1 text-slate-600">Here is your JayPilot AI workspace.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Saved Jobs"
          value={summary?.saved_jobs ?? null}
          hint={summaryError ? "Could not load" : "Jobs you have saved"}
        />
        <StatCard
          label="Applications"
          value={summary?.applications ?? null}
          hint={summaryError ? "Could not load" : "Jobs moved past Saved"}
        />
      </div>

      <Panel title="Career Profile">
        {profile ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested job areas</p>
              <p className="mt-1 text-slate-700">{profile.job_search_terms.join(", ") || "None detected"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {profile.skills.slice(0, 15).map((skill) => (
                  <span key={skill} className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            No resume analyzed yet.{" "}
            <Link href="/dashboard/resume" className="font-semibold text-indigo-600 hover:underline">
              Upload your resume
            </Link>{" "}
            to build your career profile.
          </p>
        )}
      </Panel>

      <Panel title="Recommended Jobs">
        {!profile ? (
          <p className="text-sm text-slate-600">Analyze your resume to see real job recommendations here.</p>
        ) : loading ? (
          <p className="text-sm text-slate-500">Finding jobs for &ldquo;{searchTerm}&rdquo;...</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-600">No recommendations found right now.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.title}</p>
                  <p className="truncate text-sm text-slate-500">
                    {job.company}
                    {job.location && ` · ${job.location}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {job.match && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {job.match.match_score}% Resume Match
                    </span>
                  )}
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Application Pipeline">
        <div className="grid gap-3 sm:grid-cols-5">
          {STATUSES.map((stage) => (
            <div key={stage} className="rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-sm font-semibold text-slate-700">{STATUS_LABELS[stage]}</p>
              <p className="mt-1 text-2xl font-bold text-slate-400">{summary ? (summary.by_status[stage] ?? 0) : "–"}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600">
          {summary && summary.saved_jobs === 0 ? (
            <>
              No applications yet.{" "}
              <Link href="/dashboard/jobs" className="font-semibold text-indigo-600 hover:underline">
                Find jobs
              </Link>{" "}
              and save them to start tracking.
            </>
          ) : (
            <Link href="/dashboard/applications" className="font-semibold text-indigo-600 hover:underline">
              Open the application tracker
            </Link>
          )}
        </p>
      </Panel>
    </div>
  );
}
