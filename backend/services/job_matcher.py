"""Deterministic, explainable resume-to-job overlap scoring for a job seeker's own use.

Score (0-100) = 100 * earned / applicable, using these components:
  skills      60 pts  matched job skills / max(job skills detected, 3)   (only if the job lists skills)
  title       20 pts  best overlap between job title and resume titles / suggested job areas
  experience  10 pts  resume job titles whose distinctive words appear in the listing (2+ = full)
  education   10 pts  degree level / certifications named by the job that the resume shows
                      (only if the listing mentions a degree or certification)
Components that do not apply are dropped and the rest are rescaled. If a listing names no
recognisable skills, the score is capped at NO_SKILLS_CAP because the evidence is thin.
"""

import re

WEIGHTS = {"skills": 60, "title": 20, "experience": 10, "education": 10}
NO_SKILLS_CAP = 50
MIN_SKILLS_BASIS = 3  # listings are short snippets; 1 detected skill is weak evidence
MAX_LISTED = 8

# canonical name -> extra spellings (the canonical name itself is always matched)
SKILL_ALIASES: dict[str, list[str]] = {
    "AWS": ["Amazon Web Services"],
    "Azure": ["Microsoft Azure"],
    "Google Cloud": ["GCP", "Google Cloud Platform"],
    "Kubernetes": ["K8s"],
    "CI/CD": ["CI-CD", "CICD", "continuous integration", "continuous delivery", "continuous deployment"],
    "Node.js": ["NodeJS", "Node js"],
    "Next.js": ["NextJS"],
    "React": ["React.js", "ReactJS"],
    "PostgreSQL": ["Postgres"],
    "REST APIs": ["REST API", "RESTful", "RESTful API", "RESTful APIs"],
    "Power BI": ["PowerBI"],
    "Help Desk": ["Helpdesk"],
}
BASE_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "C#", "C++", "Go", "Rust", "Ruby", "PHP", "SQL",
    "Bash", "PowerShell", "React", "Next.js", "Node.js", "Angular", "Vue", "Django", "Flask",
    "FastAPI", "Spring Boot", ".NET", "HTML", "CSS", "Tailwind CSS", "GraphQL", "REST APIs",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB", "AWS", "Azure", "Google Cloud",
    "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "GitLab CI",
    "CI/CD", "Linux", "Windows Server", "Active Directory", "VMware", "Git", "Cisco", "TCP/IP",
    "DNS", "DHCP", "VPN", "Firewalls", "Routing", "Switching", "VLAN", "Wireshark", "Splunk",
    "Nagios", "Prometheus", "Grafana", "Machine Learning", "TensorFlow", "PyTorch", "Pandas",
    "NumPy", "Tableau", "Power BI", "Excel", "Jira", "Agile", "Scrum", "Figma", "Selenium",
    "Cybersecurity", "Network Security", "Troubleshooting", "Help Desk",
]
# Short names that are ordinary words are only matched with this exact capitalisation.
CASE_SENSITIVE = {"Go", "Golang"}

CERT_PATTERNS = [
    r"AWS Certified", r"Azure (?:Fundamentals|Administrator|Developer|Solutions Architect)", r"Google Cloud (?:Certified|Professional|Associate)",
    r"CompTIA", r"\bCCNA\b", r"\bCCNP\b", r"\bCISSP\b", r"\bCISM\b", r"\bCEH\b", r"\bPMP\b",
    r"\bCKA\b", r"\bCKAD\b", r"Security\+", r"Network\+", r"Terraform Associate", r"\bITIL\b",
]
DEGREE_RANKS = [
    (4, re.compile(r"\b(?:ph\.?d|doctorate|doctoral)\b", re.I)),
    (3, re.compile(r"\b(?:master'?s?|m\.?s\.?c?|m\.?b\.?a)\b", re.I)),
    (2, re.compile(r"\b(?:bachelor'?s?|b\.?s\.?c?|b\.?a)\b", re.I)),
    (1, re.compile(r"\b(?:associate'?s?(?: degree)?|a\.?a\.?s)\b", re.I)),
]
DEGREE_NAMES = {1: "associate", 2: "bachelor's", 3: "master's", 4: "doctoral"}

GENERIC_TITLE_WORDS = {
    "engineer", "developer", "administrator", "analyst", "architect", "specialist", "technician",
    "manager", "consultant", "scientist", "designer", "programmer", "assistant", "coordinator",
    "officer", "intern", "associate",
}
TITLE_STOPWORDS = {
    "senior", "sr", "junior", "jr", "lead", "principal", "staff", "i", "ii", "iii", "iv", "and",
    "of", "the", "a", "an", "for", "to", "in", "at", "remote", "hybrid", "or", "with",
}


def _skill_regex(name: str) -> re.Pattern:
    flags = 0 if name in CASE_SENSITIVE else re.I
    return re.compile(rf"(?<![\w+#]){re.escape(name)}(?![\w+#]|\.\w)", flags)


def _build_taxonomy() -> tuple[dict[str, str], dict[str, re.Pattern]]:
    canonical_of: dict[str, str] = {}
    patterns: dict[str, re.Pattern] = {}
    for name in BASE_SKILLS:
        spellings = [name, *SKILL_ALIASES.get(name, [])]
        for spelling in spellings:
            canonical_of[spelling.lower()] = name
        patterns[name] = re.compile(
            "|".join(_skill_regex(s).pattern for s in spellings),
            0 if name in CASE_SENSITIVE else re.I,
        )
    canonical_of["gcp"] = "Google Cloud"
    canonical_of["golang"] = "Go"
    patterns["Go"] = re.compile(
        _skill_regex("Go").pattern + "|" + _skill_regex("Golang").pattern
    )
    return canonical_of, patterns


CANONICAL_OF, SKILL_PATTERNS = _build_taxonomy()


def _canonical(skill: str) -> str:
    return CANONICAL_OF.get(skill.strip().lower(), skill.strip())


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9+#.]+", text.lower())
    return [w.strip(".") for w in words if w.strip(".")]


def _stem(word: str) -> str:
    return word[:-1] if len(word) > 3 and word.endswith("s") else word


def _title_tokens(text: str) -> set[str]:
    return {_stem(t) for t in _tokens(text) if t not in TITLE_STOPWORDS}


def _job_skills(text: str, resume_skills: set[str]) -> list[str]:
    found = [name for name, pattern in SKILL_PATTERNS.items() if pattern.search(text)]
    # Skills the resume lists outside our dictionary still count when the listing names them.
    for skill in resume_skills:
        if skill not in SKILL_PATTERNS and len(skill) > 2 and _skill_regex(skill).search(text):
            found.append(skill)
    return found


def _title_score(job_title: str, phrases: list[str]) -> tuple[float, str | None]:
    job_tokens = _title_tokens(job_title)
    if not job_tokens:
        return 0.0, None
    best, best_phrase = 0.0, None
    for phrase in phrases:
        tokens = _title_tokens(phrase)
        shared = job_tokens & tokens
        if not tokens or not shared:
            continue
        weight = lambda ts: sum(0.4 if t in GENERIC_TITLE_WORDS else 1.0 for t in ts)
        if all(t in GENERIC_TITLE_WORDS for t in shared):
            score = 0.2
        else:
            score = weight(shared) / min(weight(job_tokens), weight(tokens))
        if score > best:
            best, best_phrase = score, phrase
    return min(best, 1.0), best_phrase


def _degree_rank(text: str) -> int:
    return next((rank for rank, pattern in DEGREE_RANKS if pattern.search(text)), 0)


def _education_score(job_text: str, profile: dict) -> tuple[float | None, list[str]]:
    """Return (score or None if the listing names neither), plus human-readable evidence."""
    items = evidence = 0
    notes: list[str] = []
    job_rank = _degree_rank(job_text)
    if job_rank:
        items += 1
        resume_rank = max(
            (_degree_rank(e.get("degree", "")) for e in profile.get("education", [])), default=0
        )
        if resume_rank >= job_rank:
            evidence += 1
            notes.append(f"Your resume lists a {DEGREE_NAMES[resume_rank]} degree, which covers the degree level the listing mentions.")
        elif resume_rank:
            evidence += 0.5
            notes.append(f"The listing mentions a {DEGREE_NAMES[job_rank]} degree; your resume lists a {DEGREE_NAMES[resume_rank]} degree.")
    job_certs = {m.group().lower() for p in CERT_PATTERNS for m in re.finditer(p, job_text, re.I)}
    if job_certs:
        items += 1
        resume_certs = " ".join(profile.get("certifications", [])).lower()
        hit = [c for c in job_certs if c in resume_certs]
        if hit:
            evidence += 1
            notes.append("Your resume lists a certification the listing mentions.")
    return (evidence / items if items else None), notes


def match_job(profile: dict, job: dict, job_text: str | None = None) -> dict:
    text = f"{job.get('title', '')}\n{job_text if job_text is not None else job.get('description', '')}"

    resume_skills = {_canonical(s) for s in profile.get("skills", []) if s.strip()}
    job_skills = _job_skills(text, resume_skills)
    matched = [s for s in job_skills if s in resume_skills]
    missing = [s for s in job_skills if s not in resume_skills]

    phrases = [e.get("title", "") for e in profile.get("experience", [])] + list(
        profile.get("job_search_terms", [])
    )
    title_fraction, title_phrase = _title_score(job.get("title", ""), [p for p in phrases if p])

    text_tokens = {_stem(t) for t in _tokens(text)}
    exp_hits = 0
    for entry in profile.get("experience", []):
        distinct = {t for t in _title_tokens(entry.get("title", "")) if t not in GENERIC_TITLE_WORDS}
        if distinct & text_tokens:
            exp_hits += 1
    exp_fraction = min(1.0, exp_hits / 2)

    edu_fraction, edu_notes = _education_score(text, profile)

    fractions = {"title": title_fraction, "experience": exp_fraction}
    if job_skills:
        fractions["skills"] = len(matched) / max(len(job_skills), MIN_SKILLS_BASIS)
    if edu_fraction is not None:
        fractions["education"] = edu_fraction

    applicable = sum(WEIGHTS[k] for k in fractions)
    earned = sum(WEIGHTS[k] * f for k, f in fractions.items())
    score = earned / applicable * 100
    if not job_skills:
        score = min(score, NO_SKILLS_CAP)

    reasons: list[str] = []
    if matched:
        reasons.append(
            f"Your resume lists {len(matched)} of the {len(job_skills)} technical skills detected in this listing: "
            + ", ".join(matched[:MAX_LISTED]) + "."
        )
    elif job_skills:
        reasons.append("None of the technical skills detected in this listing were found in your resume.")
    else:
        reasons.append("This listing names few recognizable technical skills, so the score relies on title and experience only.")
    if title_phrase and title_fraction >= 0.5:
        reasons.append(f"The job title overlaps with \"{title_phrase}\" from your resume profile.")
    if exp_hits:
        reasons.append(f"{exp_hits} of your listed role(s) include terms that also appear in this listing.")
    reasons.extend(edu_notes)

    return {
        "match_score": round(score),
        "matched_skills": matched[:MAX_LISTED * 2],
        "missing_skills": missing[:MAX_LISTED],
        "match_reasons": reasons,
        "score_breakdown": {
            k: {"points": round(WEIGHTS[k] * f / applicable * 100, 1), "max": round(WEIGHTS[k] / applicable * 100, 1)}
            for k, f in fractions.items()
        },
        "disclaimer": "Potential gaps only mean a skill was not detected in your resume. This is a text overlap estimate, not an assessment of qualification.",
    }
