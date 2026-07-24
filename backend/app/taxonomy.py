"""
The 12 RADIX skill categories (the backbone of the whole tool).

Every extracted or entered skill is tagged with exactly one CATEGORY CODE below
(plus OTHER as a catch-all). This module also holds:
  * human-readable names for each code,
  * keyword hints used by the offline/local fallback extractor, and
  * an alias map that normalises messy skill names for matching
    (e.g. "React.js" / "ReactJS" / "react" all collapse to "react").
"""

from __future__ import annotations

# code -> display name
CATEGORIES: dict[str, str] = {
    "COD":   "Coding",
    "DSA":   "Data Structures & Algorithms",
    "OOD":   "Object-Oriented Design",
    "APTI":  "Aptitude",
    "COMM":  "Communication",
    "AI":    "AI / Machine Learning",
    "CLOUD": "Cloud",
    "SQL":   "SQL / Databases",
    "SWE":   "Software Engineering",
    "SYSD":  "System Design",
    "NETW":  "Networking",
    "OS":    "Operating Systems",
    "OTHER": "Other",
}

# The 12 "real" skillsets that Talent Check scores against (OTHER is excluded).
SKILLSET_CODES: list[str] = [c for c in CATEGORIES if c != "OTHER"]

VALID_CODES: set[str] = set(CATEGORIES.keys())


# ---------------------------------------------------------------------------
# Keyword hints per category.
# Used ONLY by the local (no-API) fallback extractor. The LLM extractor does
# not need these — it reasons over the categories directly.
# ---------------------------------------------------------------------------
KEYWORDS: dict[str, list[str]] = {
    "COD": [
        "coding", "programming", "write code", "clean code", "efficient code",
        "hands-on programming", "python", "java", "c++", "c#", "javascript",
        "typescript", "golang", " go ", "rust", "ruby", "php", "scala",
        "kotlin", "swift", "git", "version control", "competitive programming",
    ],
    "DSA": [
        "data structures", "algorithms", "dsa", "time and space complexity",
        "time complexity", "space complexity", "big-o", "big o", "dynamic programming",
        "graphs", "trees", "sorting", "searching", "leetcode", "problem solving skills",
    ],
    "OOD": [
        "object-oriented", "object oriented", "oop", "ood", "design patterns",
        "factory", "strategy pattern", "singleton", "solid principles",
        "encapsulation", "inheritance", "polymorphism", "class design",
    ],
    "APTI": [
        "aptitude", "quantitative", "logical reasoning", "analytical",
        "numerical reasoning", "reasoning ability",
    ],
    "COMM": [
        "communication", "written and verbal", "verbal communication",
        "written communication", "explain", "collaborate", "collaboration",
        "stakeholder", "presentation", "documentation", "teamwork",
        "cross-functional", "interpersonal",
    ],
    "AI": [
        "artificial intelligence", " ai ", "machine learning", " ml ",
        "deep learning", "nlp", "natural language processing", "neural network",
        "tensorflow", "pytorch", "scikit-learn", "sklearn", "llm",
        "computer vision", "data science", "predictive model", "statistics",
        "pandas", "numpy",
    ],
    "CLOUD": [
        "cloud", "aws", "azure", "gcp", "google cloud", "kubernetes", "k8s",
        "docker", "container", "serverless", "lambda", "terraform", "devops",
        "microservices deployment",
    ],
    "SQL": [
        "sql", "database", "mysql", "postgres", "postgresql", "oracle database",
        "mongodb", "nosql", "redis", "query", "queries", "data modeling",
        "etl", "data warehouse", "bigquery", "snowflake", "pl/sql", "t-sql",
    ],
    "SWE": [
        "software engineering", "software development", "unit test", "testing",
        "test coverage", "code review", "ci/cd", "continuous integration",
        "technical debt", "agile", "scrum", "maintainable", "debugging",
        "best practices", "sdlc", "refactoring",
    ],
    "SYSD": [
        "system design", "distributed systems", "scalability", "at scale",
        "architecture", "load balancing", "caching", "high availability",
        "design a system", "microservices", "fault tolerance", "throughput",
    ],
    "NETW": [
        "networking", "computer networks", "tcp", "udp", "tcp/ip", "http",
        "https", "dns", "web request", "protocols", "osi", "socket", "rest api",
    ],
    "OS": [
        "operating systems", "operating system", " os ", "processes", "threads",
        "virtual memory", "concurrency", "multithreading", "multithreaded",
        "process scheduling", "linux", "unix", "memory management", "deadlock",
    ],
}


# ---------------------------------------------------------------------------
# Alias map for skill-name normalisation (used by the matcher).
# Left side = things people write; right side = canonical form.
# ---------------------------------------------------------------------------
ALIASES: dict[str, str] = {
    "reactjs": "react", "react.js": "react", "react js": "react",
    "nodejs": "node", "node.js": "node", "node js": "node",
    "js": "javascript", "ts": "typescript",
    "py": "python",
    "postgres": "postgresql", "psql": "postgresql", "pg": "postgresql",
    "k8s": "kubernetes",
    "ml": "machine learning", "ai/ml": "machine learning",
    "dl": "deep learning",
    "nlp": "natural language processing",
    "oop": "object-oriented programming", "ood": "object-oriented design",
    "dsa": "data structures and algorithms",
    "ds&a": "data structures and algorithms",
    "os": "operating systems", "oses": "operating systems",
    "dbms": "database management",
    "gcp": "google cloud", "google cloud platform": "google cloud",
    "aws cloud": "aws", "amazon web services": "aws",
    "cicd": "ci/cd", "ci cd": "ci/cd",
    "restful": "rest", "rest apis": "rest", "restful apis": "rest",
    "tcp/ip": "tcp", "c/c++": "c++", "golang": "go",
    "sklearn": "scikit-learn", "scikit learn": "scikit-learn",
    "tf": "tensorflow", "torch": "pytorch",
}


def category_name(code: str) -> str:
    """Human-readable name for a category code."""
    return CATEGORIES.get(code, "Other")


def coerce_code(code: str | None) -> str:
    """Force any incoming category code into a valid one (defaults to OTHER)."""
    if not code:
        return "OTHER"
    up = code.strip().upper()
    return up if up in VALID_CODES else "OTHER"
