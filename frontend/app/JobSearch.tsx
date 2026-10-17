"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileContext";
import { ApiError, listSavedJobs, saveJob } from "@/lib/savedJobs";
import { getToken } from "@/lib/auth";

const API_URL = "/api/backend/jobs/search";
const MATCH_API_URL = "/api/backend/jobs/match";

type Match = {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  match_reasons: string[];
  disclaimer: string;
};

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  created: string | null;
  apply_url: string | null;
  match?: Match;
};

type SearchResult = {
  jobs: Job[];
  count: number;
  query: string;
  location: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatSalary(min: number | null, max: number | null): string | null {
  if (min && max && min !== max) return `${money.format(min)} – ${money.format(max)}`;
  const single = min || max;
  return single ? money.format(single) : null;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function Chips({ items, className }: { items: string[]; className: string }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function MatchDetails({ match }: { match: Match }) {
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
      {match.matched_skills.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matched skills</p>
          <Chips items={match.matched_skills} className="bg-indigo-100 text-indigo-800" />
        </div>
      )}
      {match.missing_skills.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Potential gaps</p>
          <Chips items={match.missing_skills} className="border border-slate-300 bg-white text-slate-700" />
          <p className="mt-1 text-xs text-slate-500">Not detected in your resume; you may still have them.</p>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why this matches</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
          {match.match_reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function JobSearch() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const { profile } = useProfile();
  // null means the visitor is not signed in, so jobs cannot be saved.
  const [savedIds, setSavedIds] = useState<Set<string> | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    let active = true;
    listSavedJobs()
      .then((jobs) => active && setSavedIds(new Set(jobs.map((j) => j.external_job_id))))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(job: Job) {
    setSavingId(job.id);
    setSaveError(null);
    try {
      await saveJob({
        external_job_id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        apply_url: job.apply_url,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        match_score: job.match?.match_score ?? null,
      });
      setSavedIds((prev) => new Set(prev).add(job.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSavedIds((prev) => new Set(prev).add(job.id));
      } else {
        setSaveError((err as Error).message);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      setError("Enter a job title or keyword.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ query: query.trim(), location: location.trim() });
      const response = profile
        ? await fetch(MATCH_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: query.trim(),
              location: location.trim(),
              candidate_profile: profile,
            }),
          })
        : await fetch(`${API_URL}?${params}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof data?.detail === "string" ? data.detail : "Job search failed.");
      }
      setResult(data as SearchResult);
    } catch (err) {
      setResult(null);
      setError(err instanceof TypeError ? "Could not reach the server." : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Browse Jobs</h2>
        <p className="mt-4 text-lg text-slate-600">Search real, current U.S. job listings.</p>
        <p className="mt-2 text-sm text-slate-500">
          {profile
            ? "Resume analyzed: results show how your resume overlaps with each listing."
            : "Upload and analyze your resume to see how it overlaps with each listing."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Job title or keyword"
          aria-label="Job title or keyword"
          maxLength={100}
          className={inputClass}
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, State"
          aria-label="Location"
          maxLength={100}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Searching..." : "Search Jobs"}
        </button>
      </form>

      <div className="mt-10" aria-live="polite">
        {error && (
          <p className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {result && result.jobs.length === 0 && (
          <p className="text-center text-slate-600">
            No jobs found. Try a different keyword or location.
          </p>
        )}
        {result && result.jobs.length > 0 && (
          <>
            {saveError && (
              <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </p>
            )}
            <p className="mb-4 text-sm text-slate-500">
              Showing {result.count} results for &ldquo;{result.query}&rdquo;
              {result.location && ` in ${result.location}`}
            </p>
            <ul className="grid gap-4 md:grid-cols-2">
              {result.jobs.map((job) => {
                const salary = formatSalary(job.salary_min, job.salary_max);
                const posted = formatDate(job.created);
                return (
                  <li
                    key={job.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {job.company}
                      {job.location && ` · ${job.location}`}
                    </p>
                    {job.match && (
                      <div className="mt-3 inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                        {job.match.match_score}% Resume Match
                      </div>
                    )}
                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                      {job.description}
                    </p>
                    {job.match && <MatchDetails match={job.match} />}
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {salary && <span className="font-medium text-emerald-700">{salary}</span>}
                      {posted && <span>Posted {posted}</span>}
                    </div>
                    {job.apply_url && (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <a
                          href={job.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-fit rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                        >
                          View Job
                        </a>
                        {savedIds === null ? (
                          <Link
                            href="/signin"
                            className="text-sm font-semibold text-indigo-600 hover:underline"
                          >
                            Sign in to save
                          </Link>
                        ) : savedIds.has(job.id) ? (
                          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                            Saved ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSave(job)}
                            disabled={savingId === job.id}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            {savingId === job.id ? "Saving..." : "Save Job"}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
