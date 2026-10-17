"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileProvider } from "../ProfileContext";
import { useRequireUser, type User } from "@/lib/auth";

const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext) as User;

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Find Jobs", href: "/dashboard/jobs" },
  { label: "Career Profile", href: "/dashboard/profile" },
  { label: "Saved Jobs", href: "/dashboard/saved-jobs" },
  { label: "Applications", href: "/dashboard/applications" },
  { label: "Resume Center", href: "/dashboard/resume" },
  { label: "Account", href: "/dashboard/account" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useRequireUser();
  const pathname = usePathname();

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Loading your workspace...
      </div>
    );
  }

  return (
    <UserContext.Provider value={user}>
      <ProfileProvider>
        <div className="flex flex-1 flex-col bg-slate-50 font-sans text-slate-900 md:flex-row">
          <aside className="border-b border-slate-200 bg-white md:w-64 md:shrink-0 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2 px-6 py-5 text-lg font-bold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
                J
              </span>
              JayPilot AI
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={signOut}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:mt-4"
              >
                Sign Out
              </button>
            </nav>
          </aside>
          <main className="min-w-0 flex-1 px-6 py-8 md:px-10">{children}</main>
        </div>
      </ProfileProvider>
    </UserContext.Provider>
  );
}
