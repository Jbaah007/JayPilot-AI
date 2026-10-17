import JobSearch from "./JobSearch";
import { ProfileProvider } from "./ProfileContext";
import ResumeUploader from "./ResumeUploader";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Find Jobs", href: "#preview" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Sign In", href: "/signin" },
  { label: "Create Account", href: "/signup" },
];

const steps = [
  {
    title: "Upload your resume",
    description:
      "Drop in your resume as a PDF or document. We securely read your work history, education, and skills.",
    icon: (
      <path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    ),
  },
  {
    title: "AI analyzes your experience",
    description:
      "JayPilot AI builds a profile of your strengths, seniority, and career direction to understand what fits you.",
    icon: (
      <path d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7z" />
    ),
  },
  {
    title: "Discover relevant jobs",
    description:
      "Browse real openings from live job listings, so you spend time on roles worth applying to.",
    icon: <path d="m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />,
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white font-sans text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4">
          <a href="#home" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
              J
            </span>
            JayPilot AI
          </a>
          <ul className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-600 sm:gap-8">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className={
                    link.label === "Sign In"
                      ? "rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 transition hover:bg-slate-50"
                      : link.label === "Create Account"
                        ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-white transition hover:bg-indigo-700"
                        : "transition hover:text-slate-900"
                  }
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <ProfileProvider>
      <main className="flex-1">
        <section
          id="home"
          className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 sm:py-24">
            <div>
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                AI-powered job discovery
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Find jobs that fit your experience
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                JayPilot AI analyzes your resume to understand your skills and
                background, then discovers real job opportunities that are
                relevant to your profile.
              </p>
              <div className="mt-8">
                <ResumeUploader />
              </div>
            </div>
          </div>
        </section>

        <section id="preview" className="scroll-mt-16 border-t border-slate-200 bg-white py-20">
          <JobSearch />
        </section>

        <section id="how-it-works" className="scroll-mt-16 bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
              <p className="mt-4 text-lg text-slate-600">
                From resume to relevant opportunities in three simple steps.
              </p>
            </div>
            <ol className="mt-14 grid gap-6 md:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                      <Icon>{step.icon}</Icon>
                    </div>
                    <span className="text-sm font-semibold text-slate-400">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      </ProfileProvider>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-xs text-white">
              J
            </span>
            JayPilot AI
          </div>
          <p>© {new Date().getFullYear()} JayPilot AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
