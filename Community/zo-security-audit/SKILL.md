---
name: zo-security-audit
description: Comprehensive security audit for Zo Computer. Scans for hardcoded secrets, sensitive files, .env hygiene, open ports, git history leaks, publicly exposed zo.space routes/assets, hosted service security, and integration/agent review. Generates a severity-rated report with actionable remediation steps. Use when the user asks to audit, harden, or review the security posture of their Zo Computer.
metadata:
  author: davidj.zo.computer
  category: Community
  display-name: Security Audit
  emoji: "\U0001F6E1"
---
# Zo Security Audit

Run a full security audit of this Zo Computer. The audit covers six categories:

1. **Secrets & Credentials** — hardcoded API keys, tokens, passwords in source files
2. **Sensitive Files** — private keys, credential files, databases in the workspace
3. **Environment / .env Files** — .env files with hardcoded values instead of Zo Secrets references
4. **Network & Services** — open ports, listening processes
5. **Git History** — secrets leaked in git commit history
6. **Public Exposure** — publicly accessible zo.space routes, assets, hosted services, agents

## How to Run

### Step 1: Filesystem & Network Scan

Run the scanner script:

```bash
bun /home/workspace/Skills/zo-security-audit/scripts/audit.ts
```

This saves initial findings to `/home/workspace/Documents/security-audit.json`.

Use `--help` to see options (e.g., `--category secrets` to scan only one category).

### Step 2: Zo Tool-Based Checks

After running the script, use your Zo tools to check the following and **append findings to the JSON**:

#### 2a. zo.space Route Exposure

1. Call `list_space_routes()` to get all routes.
2. For each route, call `get_space_route(path)` to inspect code and visibility.
3. Flag findings:
   - **All API routes** → severity `medium` with note "API routes are always publicly accessible. Review whether auth is implemented."
   - **Pages with `public=true`** → severity `info` with note "Publicly visible page — verify this is intentional."
   - **API routes without auth pattern** (no header check in code) → severity `high` with remediation "Add authentication to protect this endpoint."
   - **API routes that accept POST/PUT/DELETE without auth** → severity `high`

#### 2b. zo.space Asset Exposure

1. Call `list_space_assets()`.
2. All assets are public. Flag any that look sensitive:
   - Files named like credentials, keys, configs, database dumps → severity `high`
   - Large data files → severity `medium`
   - Normal assets (images, CSS, JS) → severity `info` (just note they're public)

#### 2c. Hosted Services

1. Call `list_user_services()`.
2. For each service with an HTTP URL, flag as severity `info` — note the service is network-accessible.
3. If a service label suggests it handles sensitive data (e.g., "database", "admin", "api"), flag as `medium`.

#### 2d. Agents & Rules

1. Call `list_agents()` (use the tool, not a command).
2. Review each agent's instruction. Flag:
   - Agents that send emails/SMS → severity `info` with note "This agent sends external communications."
   - Agents that reference API keys or secrets in their instruction text → severity `high` with remediation "Don't put secrets in agent instructions. Use Zo Secrets."
   - Agents with very broad permissions or instructions → severity `low` with note for review
3. Call `list_rules()` and review for any rules that might override security behaviors.

#### 2e. Integration Review

Note which external apps are connected (Gmail, Drive, Calendar, Linear, Notion, etc.) as severity `info` findings so the user can review their connected integrations.

### Step 3: Generate Reports

After combining all findings:

1. **Read** the JSON from `/home/workspace/Documents/security-audit.json`
2. **Merge** in the Zo tool-based findings from Step 2
3. **Write** the updated JSON back to `/home/workspace/Documents/security-audit.json`
4. **Generate** a markdown report at `/home/workspace/Documents/security-audit-report.md` with:
   - Executive summary with overall risk score
   - Findings grouped by category, ordered by severity
   - Each finding should include: severity badge, title, description, file/location, and remediation
   - A remediation checklist at the end

### Step 4: Offer Remediation (Interactive Mode Only)

When running interactively (not as a scheduled agent), after presenting the report:

1. Ask the user if they'd like you to fix any findings
2. For each fixable finding, offer specific actions:
   - **Public page that should be private** → "I can set this page to private. Want me to?"
   - **Hardcoded secret** → "I can move this to Zo Secrets and update the code to use `process.env.KEY_NAME`. Want me to?"
   - **Unprotected API route** → "I can add authentication to this route. Want me to?"
   - **.env with hardcoded values** → "I can migrate these values to Zo Secrets. Want me to?"
   - **Sensitive file** → "I can move this to a safer location or remove it. Want me to?"
   - **Git history leak** → "I can help you purge this from git history using git-filter-repo."
3. Execute fixes the user approves

## Severity Levels

| Level | Meaning |
|-------|---------|
| Critical | Immediate action required — active credential exposure |
| High | Should fix soon — significant security risk |
| Medium | Moderate risk — review and address when possible |
| Low | Minor concern — improve when convenient |
| Info | Informational — no action needed, awareness only |

## Output Format

The scanner produces a JSON file with this structure:

```json
{
  "timestamp": "2026-03-04T12:00:00.000Z",
  "findings": [
    {
      "id": "F-0001",
      "category": "secrets",
      "severity": "critical",
      "title": "AWS Access Key detected",
      "description": "Found in src/config.ts at line 42",
      "file": "src/config.ts",
      "line": 42,
      "detail": "AKIA●●●●●●●●●●●●WXYZ",
      "remediation": "Rotate this AWS key immediately and store it in Zo Secrets."
    }
  ],
  "summary": { "critical": 1, "high": 3, "medium": 5, "low": 2, "info": 10 },
  "metadata": { "scannedFiles": 1234, "scannedDirs": 56, "duration": "2.3s" }
}
```

## Notes

- The scanner automatically redacts detected secrets in the output (only first/last 4 chars shown)
- False-positive filtering is built in for Google Fonts URLs, test fixtures, docker-compose variables, and the patterns file itself
- Files larger than 1MB are skipped for performance
- The `patterns.json` file in `assets/` can be extended with additional secret patterns
