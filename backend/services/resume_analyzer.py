"""Rule-based extraction of a structured candidate profile from resume text."""

import re

SECTION_ALIASES = {
    "skills": {
        "skills", "technical skills", "core skills", "key skills", "core competencies",
        "technologies", "skills & tools", "skills and tools", "tools & technologies",
    },
    "education": {"education", "academic background", "education & training", "education and training"},
    "experience": {
        "experience", "work experience", "professional experience", "employment history",
        "work history", "career history", "relevant experience", "employment",
    },
    "certifications": {
        "certifications", "certification", "licenses & certifications", "certifications & licenses",
        "licenses and certifications", "professional certifications", "certificates",
    },
}
# Headings that end a section without being one we extract.
OTHER_HEADINGS = {
    "summary", "professional summary", "objective", "profile", "projects", "awards",
    "publications", "references", "interests", "volunteer experience", "languages", "activities",
}

KNOWN_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "C#", "C++", "Go", "Rust", "Ruby", "PHP", "SQL",
    "Bash", "PowerShell", "React", "Next.js", "Node.js", "Angular", "Vue", "Django", "Flask",
    "FastAPI", "Spring Boot", ".NET", "HTML", "CSS", "Tailwind CSS", "GraphQL", "REST APIs",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB", "AWS", "Azure", "Google Cloud", "GCP",
    "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "GitLab CI",
    "CI/CD", "Linux", "Windows Server", "Active Directory", "VMware", "Git", "Cisco", "TCP/IP",
    "DNS", "DHCP", "VPN", "Firewalls", "Routing", "Switching", "VLAN", "Wireshark", "Splunk",
    "Nagios", "Prometheus", "Grafana", "Machine Learning", "TensorFlow", "PyTorch", "Pandas",
    "NumPy", "Tableau", "Power BI", "Excel", "Jira", "Agile", "Scrum", "Figma", "Selenium",
    "Cybersecurity", "Network Security", "Troubleshooting", "Help Desk",
]

KNOWN_CERTIFICATIONS = [
    r"AWS Certified [A-Za-z\- ]+?(?=\s*(?:[,;|(\n]|$|-\s))", r"Azure [A-Z][A-Za-z\- ]*(?:Fundamentals|Associate|Expert|Administrator|Engineer)",
    r"Google Cloud (?:Certified )?[A-Za-z\- ]+", r"CompTIA [A-Za-z+ ]+", r"\bCCNA\b", r"\bCCNP\b",
    r"\bCISSP\b", r"\bCISM\b", r"\bCEH\b", r"\bPMP\b", r"\bCKA\b", r"\bCKAD\b",
    r"Security\+", r"Network\+", r"A\+", r"Terraform Associate", r"Certified Kubernetes [A-Za-z ]+",
    r"Certified ScrumMaster", r"\bITIL\b[A-Za-z0-9 ]*",
]

TITLE_WORDS = (
    "engineer|developer|administrator|analyst|architect|specialist|technician|manager|"
    "consultant|scientist|designer|programmer|intern|assistant|coordinator|officer"
)
TITLE_PATTERN = re.compile(rf"(?:[A-Za-z/&+.\-]+\s+){{0,5}}(?:{TITLE_WORDS})(?:\s+(?:I|II|III|IV))?", re.I)
HEADER_SPLIT = re.compile(r"\s+(?:at|@)\s+|\s*[|,–—]\s*|\s+-\s+", re.I)
PARENTHETICAL = re.compile(r"\s*\([^)]*\)")
SENIORITY = re.compile(r"^(?:(?:senior|sr\.?|junior|jr\.?|lead|principal|staff|associate)\s+)+", re.I)
MONTH = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?"
DATE_RANGE = re.compile(
    rf"(?:{MONTH}\s+)?\d{{4}}\s*(?:-|–|—|to)\s*(?:(?:{MONTH}\s+)?\d{{4}}|present|current)",
    re.I,
)
# A standalone date or range, optionally prefixed such as "Expected May 2026".
DATE_LINE = re.compile(
    rf"(?:(?:expected|graduated)\s+)?(?:{MONTH}\s+)?(?:19|20)\d{{2}}"
    rf"(?:\s*(?:-|–|—|to)\s*(?:(?:{MONTH}\s+)?(?:19|20)\d{{2}}|present|current))?",
    re.I,
)
DEGREE_PATTERN = re.compile(
    r"(?<!\w)(?:bachelor|master|associate|doctor|ph\.?d|b\.?sc?|m\.?sc?|b\.?a|m\.?a|m\.?b\.?a|diploma)(?!\w)",
    re.I,
)
INSTITUTION_PATTERN = re.compile(r"\b(?:university|college|institute|school|academy|polytechnic)\b", re.I)
US_LOCATION = re.compile(r"[A-Z][A-Za-z.'\- ]+,\s*[A-Z]{2}")
BULLET_CHARS = "•●▪■◦∙·*-–—"
BULLET = re.compile(rf"^[\s{re.escape(BULLET_CHARS)}]+")
MAX_HEADER_LENGTH = 100

# A job-search area is only suggested when the resume shows at least `min_hits` of these skills.
SKILL_CLUSTERS = [
    ("Cloud Engineer", {"AWS", "Azure", "Google Cloud", "GCP", "Terraform"}, 2),
    ("DevOps Engineer", {"Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "CI/CD", "GitHub Actions", "GitLab CI"}, 2),
    ("Network Engineer", {"Cisco", "TCP/IP", "Routing", "Switching", "VLAN", "VPN", "Firewalls", "DNS", "DHCP"}, 3),
    ("Systems Administrator", {"Linux", "Windows Server", "Active Directory", "VMware", "PowerShell", "Bash"}, 3),
    ("Software Developer", {"Python", "Java", "JavaScript", "TypeScript", "C#", "C++", "Go", "Rust", "Ruby", "PHP"}, 2),
    ("Data Analyst", {"SQL", "Tableau", "Power BI", "Excel", "Pandas"}, 3),
    ("Machine Learning Engineer", {"Machine Learning", "TensorFlow", "PyTorch"}, 2),
    ("Security Analyst", {"Cybersecurity", "Network Security", "Splunk", "Wireshark"}, 2),
    ("IT Support Specialist", {"Help Desk", "Troubleshooting", "Active Directory", "Windows Server"}, 2),
]

MAX_ITEMS = 15
MAX_LINE_LENGTH = 160


def _clean(line: str) -> str:
    return BULLET.sub("", line).strip()


def _split_sections(text: str) -> dict[str, list[str]]:
    """Group lines under the resume headings we recognise."""
    sections: dict[str, list[str]] = {name: [] for name in SECTION_ALIASES}
    current: str | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        heading = line.rstrip(":").strip().lower()
        matched = next((n for n, aliases in SECTION_ALIASES.items() if heading in aliases), None)
        if matched:
            current = matched
        elif heading in OTHER_HEADINGS:
            current = None
        elif current:
            sections[current].append(line)
    return sections


def _unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result = []
    for item in items:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def _extract_skills(text: str, section_lines: list[str]) -> list[str]:
    found = [
        skill for skill in KNOWN_SKILLS
        if re.search(rf"(?<![\w+#.]){re.escape(skill)}(?![\w+#])", text, re.I)
    ]
    # Skills listed in the Skills section are kept even if they are not in our dictionary.
    listed = []
    for line in section_lines:
        content = line.split(":", 1)[1] if ":" in line else line
        content = PARENTHETICAL.sub("", content)
        for part in re.split(r"[,;|•●▪]", content):
            part = _clean(part)
            if 1 < len(part) <= 40 and len(part.split()) <= 4:
                listed.append(part)
    return _unique(found + listed)[:MAX_ITEMS * 3]


def _is_bullet(line: str) -> bool:
    return line[:1] in BULLET_CHARS


def _is_title(part: str) -> bool:
    return bool(TITLE_PATTERN.fullmatch(PARENTHETICAL.sub("", part).strip()))


def _split_header(header: str) -> tuple[str, str] | None:
    """Split a header like "Title | Company" or "Company, Title"; None if no job title is found."""
    parts = [p.strip() for p in HEADER_SPLIT.split(header) if p.strip()]
    for index, part in enumerate(parts):
        if _is_title(part):
            return part, ", ".join(parts[:index] + parts[index + 1:])
    return None


def _looks_like_header(line: str) -> bool:
    return not _is_bullet(line) and len(line) <= MAX_HEADER_LENGTH and not line.endswith(".")


def _extract_experience(lines: list[str]) -> list[dict[str, str]]:
    """Build one record per job, anchored on each date range found in the section."""
    records = []
    for i, line in enumerate(lines):
        if _is_bullet(line):
            continue

        title = company = dates = ""
        if DATE_RANGE.fullmatch(line):
            if i == 0 or not _looks_like_header(lines[i - 1]):
                continue
            dates = line
            header = lines[i - 1]
            split = _split_header(header)
            title, company = split if split else (header, "")
            if not company and i + 1 < len(lines):
                following = lines[i + 1]
                after = lines[i + 2] if i + 2 < len(lines) else ""
                # A line followed by another date range is the next job's title, not this company.
                if _looks_like_header(following) and not DATE_RANGE.fullmatch(following) and not DATE_RANGE.fullmatch(after):
                    company = following
        else:
            match = DATE_RANGE.search(line)
            if not match or len(line) > MAX_LINE_LENGTH:
                continue
            dates = match.group()
            header = (line[:match.start()] + " " + line[match.end():]).strip(" |,–—-()")
            split = _split_header(header)
            if not split:
                continue
            title, company = split

        records.append({"title": title, "company": company, "dates": dates})

    if not records:
        for line in lines:
            split = None if _is_bullet(line) or len(line) > MAX_HEADER_LENGTH else _split_header(line)
            if split:
                records.append({"title": split[0], "company": split[1], "dates": ""})
    return _unique_records(records)[:MAX_ITEMS]


def _unique_records(records: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, ...]] = set()
    result = []
    for record in records:
        key = tuple(v.lower() for v in record.values())
        if key not in seen:
            seen.add(key)
            result.append(record)
    return result


def _tidy(value: str) -> str:
    # Drop a trailing sentence period but keep abbreviations such as "B.S.".
    return re.sub(r"(?<=[a-z]{3})\.$", "", value.strip())


def _parse_education_line(line: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    if US_LOCATION.fullmatch(line) and not INSTITUTION_PATTERN.search(line):
        return {"location": line}

    parts = [p.strip() for p in re.split(r"\s*[,|]\s*", line) if p.strip()]
    previous_was_institution = False
    for part in parts:
        is_institution = False
        if DATE_LINE.fullmatch(part):
            fields.setdefault("dates", part)
        elif DEGREE_PATTERN.search(part):
            fields.setdefault("degree", _tidy(part))
        elif INSTITUTION_PATTERN.search(part):
            fields.setdefault("institution", _tidy(part))
            is_institution = True
        elif previous_was_institution and len(part.split()) <= 2:
            fields.setdefault("location", part)
        previous_was_institution = is_institution
    return fields


def _extract_education(text: str, section_lines: list[str]) -> list[dict[str, str]]:
    lines = section_lines or [
        ln.strip() for ln in text.splitlines()
        if DEGREE_PATTERN.search(ln) or INSTITUTION_PATTERN.search(ln)
    ]
    records: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for line in lines:
        if _is_bullet(line) or len(line) > MAX_LINE_LENGTH:
            continue
        fields = _parse_education_line(line)
        if not fields:
            continue
        # A field that is already filled means this line starts a new entry.
        if any(key in current for key in fields):
            records.append(current)
            current = {}
        current.update(fields)
    records.append(current)

    return _unique_records([
        {
            "degree": r.get("degree", ""),
            "institution": r.get("institution", ""),
            "location": r.get("location", ""),
            "dates": r.get("dates", ""),
        }
        for r in records if r.get("degree") or r.get("institution")
    ])[:MAX_ITEMS]


def _extract_certifications(text: str, section_lines: list[str]) -> list[str]:
    certs = [_clean(ln) for ln in section_lines if len(ln) <= MAX_LINE_LENGTH]
    for pattern in KNOWN_CERTIFICATIONS:
        certs.extend(m.group().strip(" ,;-") for m in re.finditer(pattern, text))
    # Drop matches that are substrings of a longer certification already found.
    certs = _unique([c for c in certs if c])
    return [c for c in certs if not any(c != o and c.lower() in o.lower() for o in certs)][:MAX_ITEMS]


def _suggest_search_terms(experience: list[dict[str, str]], skills: list[str]) -> list[str]:
    terms = []
    for record in experience:
        title = PARENTHETICAL.sub("", record["title"]).strip()
        if _is_title(title):
            terms.append(SENIORITY.sub("", title).strip())
    skill_set = set(skills)
    for term, cluster, min_hits in SKILL_CLUSTERS:
        if len(cluster & skill_set) >= min_hits:
            terms.append(term)
    return _unique(terms)[:8]


def analyze_resume(text: str) -> dict[str, list]:
    sections = _split_sections(text)
    skills = _extract_skills(text, sections["skills"])
    experience = _extract_experience(sections["experience"])
    return {
        "skills": skills,
        "education": _extract_education(text, sections["education"]),
        "experience": experience,
        "certifications": _extract_certifications(text, sections["certifications"]),
        "job_search_terms": _suggest_search_terms(experience, skills),
    }
