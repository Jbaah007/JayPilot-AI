"use client";

import { useUser } from "../DashboardShell";

export default function AccountPage() {
  const user = useUser();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Account</h1>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
        <dt className="text-slate-500">Name</dt>
        <dd>{user.name}</dd>
        <dt className="text-slate-500">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-slate-500">Member since</dt>
        <dd>{new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</dd>
      </dl>
    </div>
  );
}
