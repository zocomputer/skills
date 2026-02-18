#!/usr/bin/env python3
"""
Self-improvement audit script.
Gathers system state for reflection: skills inventory, workspace structure,
file stats, and recent records.

Usage:
    python3 audit.py full      Full audit report (JSON)
    python3 audit.py skills    Skills inventory only
    python3 audit.py identity  Identity file stats only (if applicable)
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime

WORKSPACE = Path(os.environ.get("WORKSPACE", "/home/workspace"))
SKILLS_DIR = WORKSPACE / "Skills"
RECORDS_DIR = WORKSPACE / "Records"


def run(cmd, cwd=None):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    return result.stdout.strip()


def skills_inventory():
    """Inventory all skills with their descriptions and file counts."""
    skills = []
    if not SKILLS_DIR.exists():
        return skills

    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue

        description = ""
        name = skill_dir.name
        lines = skill_md.read_text().splitlines()

        in_frontmatter = False
        for line in lines:
            if line.strip() == "---":
                in_frontmatter = not in_frontmatter
                continue
            if in_frontmatter:
                if line.startswith("description:"):
                    description = line.split(":", 1)[1].strip().strip("'\"")
                elif line.startswith("name:"):
                    name = line.split(":", 1)[1].strip()

        file_count = int(run(f"find '{skill_dir}' -type f | wc -l"))
        has_scripts = (skill_dir / "scripts").exists()
        has_references = (skill_dir / "references").exists()
        has_assets = (skill_dir / "assets").exists()

        skills.append({
            "name": name,
            "dir": str(skill_dir.relative_to(WORKSPACE)),
            "description": description[:200],
            "file_count": file_count,
            "has_scripts": has_scripts,
            "has_references": has_references,
            "has_assets": has_assets,
        })

    return skills


def identity_files():
    """Check for common identity/persona file patterns."""
    files = {}
    # Check common locations for persona/identity files
    candidates = [
        WORKSPACE / "Persona" / "SOUL.md",
        WORKSPACE / "Persona" / "IDENTITY.md",
        WORKSPACE / "PERSONA.md",
        WORKSPACE / "IDENTITY.md",
        WORKSPACE / "SOUL.md",
    ]
    for path in candidates:
        if path.exists():
            content = path.read_text()
            files[str(path.relative_to(WORKSPACE))] = {
                "lines": len(content.splitlines()),
                "chars": len(content),
                "last_modified": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
            }

    # Also check for any *.md files in common persona directories
    for persona_dir in [WORKSPACE / "Persona", WORKSPACE / "AI"]:
        if persona_dir.exists() and persona_dir.is_dir():
            for md in persona_dir.glob("*.md"):
                key = str(md.relative_to(WORKSPACE))
                if key not in files:
                    content = md.read_text()
                    files[key] = {
                        "lines": len(content.splitlines()),
                        "chars": len(content),
                        "last_modified": datetime.fromtimestamp(md.stat().st_mtime).isoformat(),
                    }

    return files


def workspace_structure():
    """Top-level workspace structure."""
    dirs = []
    for item in sorted(WORKSPACE.iterdir()):
        if item.name.startswith(".") or item.name == "Trash":
            continue
        if item.is_dir():
            file_count = int(run(f"find '{item}' -type f 2>/dev/null | wc -l"))
            dirs.append({"name": item.name, "file_count": file_count})
    return dirs


def recent_records():
    """Check what's in Records/ for patterns."""
    if not RECORDS_DIR.exists():
        return []
    items = []
    for sub in sorted(RECORDS_DIR.iterdir()):
        if sub.is_dir():
            count = int(run(f"find '{sub}' -type f 2>/dev/null | wc -l"))
            items.append({"folder": sub.name, "file_count": count})
    return items


def memory_stats():
    """Try to query supermemory for basic stats."""
    script = SKILLS_DIR / "supermemory" / "scripts" / "memory.py"
    if not script.exists():
        return "Supermemory skill not installed"
    try:
        result = run(f"python3 '{script}' search --query 'capability improvement' --limit 5")
        return result[:2000] if result else "No results"
    except Exception as e:
        return f"Error querying memory: {e}"


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"

    if mode == "full":
        report = {
            "timestamp": datetime.now().isoformat(),
            "identity_files": identity_files(),
            "skills": skills_inventory(),
            "workspace": workspace_structure(),
            "records": recent_records(),
            "memory_sample": memory_stats(),
        }
        print(json.dumps(report, indent=2))

    elif mode == "skills":
        skills = skills_inventory()
        print(json.dumps(skills, indent=2))

    elif mode == "identity":
        files = identity_files()
        print(json.dumps(files, indent=2))

    else:
        print(f"Unknown mode: {mode}. Use: full, skills, identity")
        sys.exit(1)


if __name__ == "__main__":
    main()
