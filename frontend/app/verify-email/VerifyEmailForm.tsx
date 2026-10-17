"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell, { inputClass } from "../AuthShell";
import { resendVerification, verifyEmail } from "@/lib/auth";

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const notSent = searchParams.get("sent") === "0";
  const [countdown, setCountdown] = useState(notSent ? 0 : 60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    notSent ? "Your account was created, but the verification email could not be sent. Select Resend Code to try again." : null,
  );
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!verified) return;
    const timer = window.setTimeout(() => router.replace("/signin"), 1800);
    return () => window.clearTimeout(timer);
  }, [verified, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !/^\d{6}$/.test(code)) {
      setError("Enter your email and the six-digit code.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await verifyEmail(email.trim(), code);
      setVerified(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await resendVerification(email.trim());
      setNotice("If this email is eligible, a new code has been sent.");
      setCountdown(60);
      setCode("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title={verified ? "Email verified" : "Verify your email"}
      subtitle={
        verified
          ? "Your email is confirmed. Taking you to Sign In..."
          : "Enter the six-digit code we sent to your email address."
      }
      footer={
        <>
          Already verified?{" "}
          <Link href="/signin" className="font-semibold text-indigo-600 hover:underline">
            Sign In
          </Link>
        </>
      }
    >
      {verified ? (
        <div className="space-y-4">
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your account is ready. You can now sign in.
          </p>
          <Link href="/signin" className="block text-center text-sm font-semibold text-indigo-600 hover:underline">
            Continue to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Six-digit verification code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputClass} text-center font-mono text-xl tracking-[0.4em]`}
              placeholder="000000"
              aria-label="Six-digit verification code"
            />
          </label>
          <p className="text-xs text-slate-500">The code expires 10 minutes after it is sent. You can paste the full code.</p>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              {notice}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={resending || countdown > 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? "Sending..." : countdown > 0 ? `Resend code in ${countdown}s` : "Resend Code"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
