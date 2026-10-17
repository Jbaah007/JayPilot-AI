"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type CandidateProfile = {
  skills: string[];
  education: { degree: string; institution: string; location: string; dates: string }[];
  experience: { title: string; company: string; dates: string }[];
  certifications: string[];
  job_search_terms: string[];
};

type ProfileContextValue = {
  profile: CandidateProfile | null;
  setProfile: (profile: CandidateProfile | null) => void;
};

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  setProfile: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  return <ProfileContext.Provider value={{ profile, setProfile }}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => useContext(ProfileContext);
