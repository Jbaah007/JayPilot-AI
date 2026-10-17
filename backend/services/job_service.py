import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs/us/search"
REQUEST_TIMEOUT = 15.0
DESCRIPTION_LIMIT = 400


class JobServiceError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _truncate(text: str, limit: int = DESCRIPTION_LIMIT) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[:limit].rstrip() + "..."


def _normalize(job: dict) -> dict:
    return {
        "id": str(job.get("id", "")),
        "title": job.get("title") or "Untitled",
        "company": (job.get("company") or {}).get("display_name") or "Unknown company",
        "location": (job.get("location") or {}).get("display_name") or "",
        "description": _truncate(job.get("description", "")),
        "salary_min": job.get("salary_min"),
        "salary_max": job.get("salary_max"),
        "created": job.get("created"),
        "apply_url": job.get("redirect_url"),
        "full_description": " ".join((job.get("description") or "").split()),
    }


async def search_jobs(
    query: str,
    location: str = "",
    page: int = 1,
    results_per_page: int = 10,
    keep_full_description: bool = False,
) -> dict:
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        raise JobServiceError(500, "Job search is not configured on the server.")

    params = {
        "app_id": app_id,
        "app_key": app_key,
        "what": query,
        "results_per_page": results_per_page,
        "content-type": "application/json",
    }
    if location:
        params["where"] = location

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(f"{ADZUNA_BASE_URL}/{page}", params=params)
    except httpx.TimeoutException:
        raise JobServiceError(504, "The job search service timed out. Please try again.")
    except httpx.HTTPError:
        raise JobServiceError(502, "Could not reach the job search service.")

    if response.status_code in (401, 403):
        raise JobServiceError(502, "Job search service rejected the server credentials.")
    if response.status_code != 200:
        raise JobServiceError(502, "The job search service returned an error.")

    try:
        data = response.json()
    except ValueError:
        raise JobServiceError(502, "The job search service returned an invalid response.")

    jobs = [_normalize(job) for job in data.get("results", [])]
    if not keep_full_description:
        for job in jobs:
            del job["full_description"]

    return {
        "jobs": jobs,
        "count": len(jobs),
        "total": data.get("count", len(jobs)),
        "page": page,
        "query": query,
        "location": location,
    }
