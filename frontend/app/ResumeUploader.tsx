"use client";

import { useRef, useState } from "react";
import { useProfile } from "./ProfileContext";

const API_URL = "/api/backend/resume/upload";
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

type ExperienceEntry = {
  title: string;
  company: string;
  dates: string;
};

type EducationEntry = {
  degree: string;
  institution: string;
  location: string;
  dates: string;
};

type CandidateProfile = {
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  certifications: string[];
  job_search_terms: string[];
};

type UploadResult = {
  filename: string;
  file_type: string;
  character_count: number;
  candidate_profile: CandidateProfile;
};

function EntryCards({ label, entries }: { label: string; entries: { heading: string; lines: string[] }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
      {entries.length > 0 ? (
        <div className="mt-2 space-y-2">
          {entries.map((entry, index) => (
            <div key={`${entry.heading}-${index}`} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <p className="font-semibold text-slate-900">{entry.heading}</p>
              {entry.lines.map((line) => (
                <p key={line} className="text-slate-600">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-slate-500">None found in your resume.</p>
      )}
    </div>
  );
}

type Status = "idle" | "uploading" | "success" | "error";

function ChipGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "indigo" | "slate";
}) {
  const chipClass =
    tone === "indigo" ? "bg-indigo-100 text-indigo-800" : "bg-white text-slate-700 border border-slate-200";
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className={`rounded-full px-3 py-1 text-xs font-medium ${chipClass}`}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-slate-500">None found in your resume.</p>
      )}
    </div>
  );
}

export default function ResumeUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const { setProfile } = useProfile();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;

    setResult(null);
    setProfile(null);
    const name = selected.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      setFile(null);
      setStatus("error");
      setError("Unsupported file type. Please choose a PDF or DOCX file.");
      return;
    }

    setFile(selected);
    setStatus("idle");
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;

    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(API_URL, { method: "POST", body: formData });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : null;
        setStatus("error");
        setError(detail ?? "Upload failed. Please try again.");
        return;
      }

      setResult(data as UploadResult);
      setProfile((data as UploadResult).candidate_profile);
      setStatus("success");
    } catch {
      setStatus("error");
      setError(
        "Unable to reach the server. Please make sure the backend is running and try again."
      );
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Upload Resume
        </button>
        <a
          href="#preview"
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-center text-base font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Browse Jobs
        </a>
      </div>

      {file && status !== "success" && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate text-sm text-slate-700">
            <span className="font-medium">Selected:</span> {file.name}
          </p>
          <button
            type="button"
            onClick={handleUpload}
            disabled={status === "uploading"}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "uploading" ? "Analyzing resume..." : "Analyze Resume"}
          </button>
        </div>
      )}

      {status === "error" && error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {status === "success" && result && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <p className="font-semibold">Resume uploaded and processed successfully.</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-emerald-700">Filename</dt>
            <dd className="truncate">{result.filename}</dd>
            <dt className="text-emerald-700">File type</dt>
            <dd className="uppercase">{result.file_type}</dd>
            <dt className="text-emerald-700">Characters</dt>
            <dd>{result.character_count.toLocaleString()}</dd>
          </dl>

          <div className="mt-5 space-y-4 border-t border-emerald-200 pt-4 text-slate-800">
            <h3 className="font-semibold text-emerald-900">Your candidate profile</h3>

            <ChipGroup label="Suggested job areas" items={result.candidate_profile.job_search_terms} tone="indigo" />
            <ChipGroup label="Skills" items={result.candidate_profile.skills} tone="slate" />

            <EntryCards
              label="Experience"
              entries={result.candidate_profile.experience.map((job) => ({
                heading: job.title || job.company,
                lines: [job.title ? job.company : "", job.dates].filter(Boolean),
              }))}
            />
            <EntryCards
              label="Education"
              entries={result.candidate_profile.education.map((school) => ({
                heading: school.degree || school.institution,
                lines: [
                  school.degree ? school.institution : "",
                  [school.location, school.dates].filter(Boolean).join(" · "),
                ].filter(Boolean),
              }))}
            />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Certifications</p>
              {result.candidate_profile.certifications.length > 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {result.candidate_profile.certifications.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-500">None found in your resume.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
