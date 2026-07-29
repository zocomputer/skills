#!/usr/bin/env python3
"""
Email Verifier
==============
Verifies email addresses through basic checks.
For SMTP verification, use Apify Email Verifier actor.

Input:  JSON array of leads from stdin (each with 'email' field)
Output: JSON array with verification results
"""

import json
import sys
import re
import subprocess
from typing import Optional


def is_generic(email: str) -> bool:
    """Filter out generic/role-based emails."""
    generic_prefixes = [
        "info@", "admin@", "sales@", "support@", "contact@",
        "hello@", "noreply@", "no-reply@", "team@", "service@",
        "enquiry@", "enquiries@", "marketing@", "office@"
    ]
    email_lower = email.lower()
    return any(email_lower.startswith(p) for p in generic_prefixes)


def syntax_check(email: str) -> bool:
    """Basic email syntax validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def extract_domain(email: str) -> str:
    """Extract domain part from email."""
    try:
        return email.split("@")[1]
    except IndexError:
        return ""


def mx_check(email: str) -> dict:
    """Check if domain has MX records via dig."""
    domain = extract_domain(email)
    if not domain:
        return {"has_mx": False, "reason": "invalid domain"}
    
    try:
        result = subprocess.run(
            ["dig", "+short", "MX", domain],
            capture_output=True, text=True, timeout=5
        )
        has_mx = bool(result.stdout.strip())
        return {"has_mx": has_mx, "reason": "" if has_mx else "no mx record"}
    except Exception as e:
        return {"has_mx": False, "reason": str(e)}


def verify_single(email: str) -> dict:
    """Run all checks on a single email."""
    result = {
        "email": email,
        "syntax_valid": False,
        "not_generic": False,
        "mx_ok": False,
        "verified": False,
        "reason": ""
    }
    
    if not syntax_check(email):
        result["reason"] = "invalid syntax"
        return result
    result["syntax_valid"] = True
    
    if is_generic(email):
        result["reason"] = "generic email"
        return result
    result["not_generic"] = True
    
    mx_result = mx_check(email)
    if not mx_result["has_mx"]:
        result["reason"] = f"no MX: {mx_result.get('reason', 'unknown')}"
        return result
    result["mx_ok"] = True
    
    # Passed all basic checks
    result["verified"] = True
    result["reason"] = "basic checks passed"
    return result


def verify_batch(leads: list) -> dict:
    """Verify all leads and return categorized results."""
    results = {"verified": [], "failed": [], "needs_smtp": [], "stats": {}}
    
    for lead in leads:
        email = lead.get("email", "").strip()
        if not email:
            continue
        
        check = verify_single(email)
        check["original"] = lead
        
        if check["verified"]:
            results["verified"].append(check)
        elif check["syntax_valid"] and check["not_generic"] and not check["mx_ok"]:
            results["needs_smtp"].append(check)
        else:
            results["failed"].append(check)
    
    results["stats"] = {
        "total": len(leads),
        "verified": len(results["verified"]),
        "needs_smtp": len(results["needs_smtp"]),
        "failed": len(results["failed"])
    }
    
    return results


def verify_leads_format(leads: list) -> list:
    """Reformat verified leads for the dedup step."""
    return [
        {
            "email": v["email"],
            "name": v.get("original", {}).get("name", ""),
            "company": v.get("original", {}).get("company", ""),
            "source": v.get("original", {}).get("source", "unknown"),
            "verified_at": str(v)
        }
        for v in leads
    ]


if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "no input", "verified": [], "failed": []}))
            sys.exit(0)
        
        leads = json.loads(raw_input)
        if not isinstance(leads, list):
            leads = [leads]
        
        results = verify_batch(leads)
        
        if "--format-only" in sys.argv:
            formatted = verify_leads_format(results["verified"])
            print(json.dumps(formatted, ensure_ascii=False, indent=2))
        else:
            print(json.dumps(results, ensure_ascii=False, indent=2))
        
        stats = results["stats"]
        print(f"\n[Verifier] Total: {stats['total']} | Verified: {stats['verified']} | Needs SMTP: {stats['needs_smtp']} | Failed: {stats['failed']}", file=sys.stderr)
        
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"invalid json: {e}"}))
        sys.exit(1)
