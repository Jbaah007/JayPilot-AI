"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, authHeaders, clearToken } from "./auth";

export const STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;
export type AppStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<AppStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export type SavedJob = {
  id: number;
  external_job_id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string | null;
  salary_min: number | null;
  salary_max: number | null;
  match_score: number | null;
  status: AppStatus;
  status_updated_at: string;
  created_at: string;
};

export type Summary = {
  saved_jobs: number;
  applications: number;
  by_status: Partial<Record<AppStatus, number>>;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...init.headers },
    });
  } catch {
    throw new ApiError("Could not reach the server. Please try again.", 0);
  }
  if (response.status === 401) {
    clearToken();
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  if (response.status === 409) throw new ApiError("You have already saved this job.", 409);
  if (!response.ok) throw new ApiError("Something went wrong. Please try again.", response.status);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const listSavedJobs = () => request<SavedJob[]>("/saved-jobs");
export const getSummary = () => request<Summary>("/saved-jobs/summary");
export const saveJob = (job: Omit<SavedJob, "id" | "status" | "status_updated_at" | "created_at">) =>
  request<SavedJob>("/saved-jobs", { method: "POST", body: JSON.stringify(job) });
export const updateStatus = (id: number, status: AppStatus) =>
  request<SavedJob>(`/saved-jobs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
export const removeSavedJob = (id: number) => request<void>(`/saved-jobs/${id}`, { method: "DELETE" });

export function useSavedJobs() {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listSavedJobs()
      .then((data) => active && setJobs(data))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const changeStatus = useCallback(async (id: number, status: AppStatus) => {
    setError(null);
    try {
      const updated = await updateStatus(id, status);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    setError(null);
    try {
      await removeSavedJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  return { jobs, loading, error, changeStatus, remove };
}
