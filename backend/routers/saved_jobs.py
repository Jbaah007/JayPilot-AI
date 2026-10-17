from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import SavedJob, User
from services.auth_service import get_current_user

router = APIRouter(prefix="/saved-jobs", tags=["saved-jobs"])

Status = Literal["saved", "applied", "interview", "offer", "rejected"]


class SavedJobCreate(BaseModel):
    external_job_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    company: str = Field("", max_length=200)
    location: str = Field("", max_length=200)
    description: str = Field("", max_length=10000)
    apply_url: str | None = Field(None, max_length=2000)
    salary_min: float | None = Field(None, ge=0)
    salary_max: float | None = Field(None, ge=0)
    match_score: int | None = Field(None, ge=0, le=100)

    @field_validator("apply_url")
    @classmethod
    def http_only(cls, value: str | None) -> str | None:
        if value and not value.lower().startswith(("http://", "https://")):
            raise ValueError("apply_url must be an http(s) URL.")
        return value or None


class StatusUpdate(BaseModel):
    status: Status


class SavedJobOut(BaseModel):
    id: int
    external_job_id: str
    title: str
    company: str
    location: str
    description: str
    apply_url: str | None
    salary_min: float | None
    salary_max: float | None
    match_score: int | None
    status: Status
    status_updated_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


def _owned_job(db: Session, user: User, job_id: int) -> SavedJob:
    # Ownership lives in the query; another user's job is indistinguishable from a missing one.
    job = db.scalar(select(SavedJob).where(SavedJob.id == job_id, SavedJob.user_id == user.id))
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Saved job not found.")
    return job


@router.post("", response_model=SavedJobOut, status_code=status.HTTP_201_CREATED)
def save_job(
    payload: SavedJobCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SavedJob:
    existing = db.scalar(
        select(SavedJob.id).where(
            SavedJob.user_id == user.id, SavedJob.external_job_id == payload.external_job_id
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already saved this job.")
    job = SavedJob(user_id=user.id, **payload.model_dump())
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already saved this job.")
    return job


@router.get("", response_model=list[SavedJobOut])
def list_saved_jobs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(SavedJob).where(SavedJob.user_id == user.id).order_by(SavedJob.created_at.desc())
    ).all()


@router.get("/summary")
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(SavedJob.status, func.count()).where(SavedJob.user_id == user.id).group_by(SavedJob.status)
    ).all()
    by_status = {name: count for name, count in rows}
    total = sum(by_status.values())
    return {
        "saved_jobs": total,
        "applications": total - by_status.get("saved", 0),
        "by_status": by_status,
    }


@router.patch("/{job_id}/status", response_model=SavedJobOut)
def update_status(
    job_id: int,
    payload: StatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedJob:
    job = _owned_job(db, user, job_id)
    job.status = payload.status
    job.status_updated_at = datetime.now(timezone.utc)
    db.commit()
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_job(
    job_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    db.delete(_owned_job(db, user, job_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
