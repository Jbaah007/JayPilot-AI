"use client";

import Link from "next/link";
import { useProfile } from "../../ProfileContext";

export default function CareerProfilePage() {
  const { profile } = useProfile();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Career Profile</h1>
      {!profile ? (
        <p className="mt-4 text-slate-600">
          No resume analyzed yet.{" "}
          <Link href="/dashboard/resume" className="font-semibold text-indigo-600 hover:underline">
            Go to Resume Center
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
          <Section title="Suggested job areas" items={profile.job_search_terms} />
          <Section title="Skills" items={profile.skills} />
          <Section
            title="Experience"
            items={profile.experience.map((e) => [e.title, e.company, e.dates].filter(Boolean).join(" · "))}
          />
          <Section
            title="Education"
            items={profile.education.map((e) => [e.degree, e.institution, e.dates].filter(Boolean).join(" · "))}
          />
          <Section title="Certifications" items={profile.certifications} />
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-slate-500">None found in your resume.</p>
      )}
    </div>
  );
}
