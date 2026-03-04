#!/usr/bin/env bun
import { readdir, stat, readFile, writeFile, access } from "fs/promises";
import { join, basename, extname, relative } from "path";

const WORKSPACE = "/home/workspace";
const SKILL_DIR = join(WORKSPACE, "Skills/zo-security-audit");
const DEFAULT_OUTPUT = join(WORKSPACE, "Documents/security-audit.json");

interface Finding {
  id: string;
  category: "secrets" | "sensitive_files" | "env_files" | "network" | "git_history" | "exposure" | "integrations";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  file?: string;
  line?: number;
  detail?: string;
  remediation: string;
}

interface AuditResult {
  timestamp: string;
  findings: Finding[];
  summary: Record<string, number>;
  metadata: {
    scannedFiles: number;
    scannedDirs: number;
    duration: string;
  };
}

interface PatternDef {
  name: string;
  pattern: string;
  severity: string;
  remediation: string;
}

interface PatternsConfig {
  secrets: PatternDef[];
  sensitive_filenames: string[];
  sensitive_extensions: string[];
  skip_dirs: string[];
  skip_extensions: string[];
}

let findingCounter = 0;
function nextId(): string {
  return `F-${String(++findingCounter).padStart(4, "0")}`;
}

async function loadPatterns(): Promise<PatternsConfig> {
  const raw = await readFile(join(SKILL_DIR, "assets/patterns.json"), "utf-8");
  return JSON.parse(raw);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(
  dir: string,
  skipDirs: Set<string>,
  skipExts: Set<string>,
  callback: (filepath: string) => Promise<void>,
  stats: { files: number; dirs: number }
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  stats.dirs++;

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name) || entry.name.startsWith(".")) continue;
      await walkFiles(fullPath, skipDirs, skipExts, callback, stats);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (skipExts.has(ext)) continue;
      const s = await stat(fullPath).catch(() => null);
      if (!s || s.size > 1_000_000) continue; // skip files > 1MB
      stats.files++;
      await callback(fullPath);
    }
  }
}

async function scanSecrets(config: PatternsConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const skipDirs = new Set(config.skip_dirs);
  const skipExts = new Set(config.skip_extensions);
  const patterns = config.secrets.map((p) => ({
    ...p,
    regex: new RegExp(p.pattern, "gi"),
  }));
  const stats = { files: 0, dirs: 0 };

  await walkFiles(
    WORKSPACE,
    skipDirs,
    skipExts,
    async (filepath) => {
      let content: string;
      try {
        content = await readFile(filepath, "utf-8");
      } catch {
        return;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pat of patterns) {
          pat.regex.lastIndex = 0;
          const match = pat.regex.exec(line);
          if (match) {
            const matchStr = match[0];
            const relPath = relative(WORKSPACE, filepath);
            const isFalsePositive =
              matchStr.includes("fonts.googleapis.com") ||
              matchStr.includes("fonts.gstatic.com") ||
              relPath === "Skills/zo-security-audit/assets/patterns.json" ||
              (pat.name === "Password in URL" && /user:pass@|user:password@/.test(matchStr)) ||
              (pat.name === "Password in URL" && /\$\{[^}]+\}/.test(matchStr)) ||
              (relPath.includes("/tests/") && /test[-_](?:password|secret|key)|password123/.test(matchStr)) ||
              (pat.name === "Slack Token" && matchStr.includes("xxxx"));
            if (isFalsePositive) continue;
            const redacted =
              match[0].length > 8
                ? match[0].slice(0, 4) + "●".repeat(Math.min(match[0].length - 8, 20)) + match[0].slice(-4)
                : "●".repeat(match[0].length);
            findings.push({
              id: nextId(),
              category: "secrets",
              severity: pat.severity as Finding["severity"],
              title: `${pat.name} detected`,
              description: `Found in ${relative(WORKSPACE, filepath)} at line ${i + 1}`,
              file: relative(WORKSPACE, filepath),
              line: i + 1,
              detail: redacted,
              remediation: pat.remediation,
            });
          }
        }
      }
    },
    stats
  );

  return findings;
}

async function scanSensitiveFiles(config: PatternsConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const skipDirs = new Set(config.skip_dirs);
  const sensitiveNames = new Set(config.sensitive_filenames);
  const sensitiveExts = new Set(config.sensitive_extensions);
  const stats = { files: 0, dirs: 0 };

  await walkFiles(
    WORKSPACE,
    skipDirs,
    new Set(),
    async (filepath) => {
      const name = basename(filepath);
      const ext = extname(filepath).toLowerCase();
      const rel = relative(WORKSPACE, filepath);

      if (sensitiveNames.has(name)) {
        findings.push({
          id: nextId(),
          category: "sensitive_files",
          severity: name.includes("id_rsa") || name.includes("id_ed25519") ? "critical" : "high",
          title: `Sensitive file: ${name}`,
          description: `Found at ${rel}`,
          file: rel,
          remediation:
            "Consider whether this file needs to be in your workspace. Private keys and credentials should be stored in Zo Secrets or removed entirely.",
        });
      } else if (sensitiveExts.has(ext) && !rel.startsWith("Skills/")) {
        const s = await stat(filepath).catch(() => null);
        const sizeMB = s ? (s.size / 1_000_000).toFixed(1) : "?";
        findings.push({
          id: nextId(),
          category: "sensitive_files",
          severity: [".key", ".pem", ".p12", ".pfx"].includes(ext) ? "high" : "medium",
          title: `Sensitive file type: ${name} (${sizeMB}MB)`,
          description: `Found at ${rel}`,
          file: rel,
          remediation:
            ext === ".key" || ext === ".pem"
              ? "Move cryptographic keys out of the workspace or into Zo Secrets."
              : "Review whether database/SQL files should be stored in the workspace. Consider access controls.",
        });
      }
    },
    stats
  );

  return findings;
}

async function scanEnvFiles(config: PatternsConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const skipDirs = new Set(config.skip_dirs);
  const stats = { files: 0, dirs: 0 };

  await walkFiles(
    WORKSPACE,
    skipDirs,
    new Set(),
    async (filepath) => {
      const name = basename(filepath);
      if (!name.startsWith(".env") && name !== ".env") return;

      const rel = relative(WORKSPACE, filepath);
      let content: string;
      try {
        content = await readFile(filepath, "utf-8");
      } catch {
        return;
      }

      const lines = content.split("\n");
      const hardcodedKeys: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
        if (match) {
          const value = match[2].replace(/^['"]|['"]$/g, "");
          if (value && !value.startsWith("$") && !value.startsWith("${") && value.length > 3) {
            hardcodedKeys.push(match[1]);
          }
        }
      }

      if (hardcodedKeys.length > 0) {
        findings.push({
          id: nextId(),
          category: "env_files",
          severity: "high",
          title: `.env file with hardcoded values: ${name}`,
          description: `${rel} contains ${hardcodedKeys.length} hardcoded value(s): ${hardcodedKeys.slice(0, 5).join(", ")}${hardcodedKeys.length > 5 ? "..." : ""}`,
          file: rel,
          detail: `Keys: ${hardcodedKeys.join(", ")}`,
          remediation:
            "Move these values to Zo Secrets (Settings > Advanced). Reference them as environment variables instead of storing in .env files.",
        });
      }
    },
    stats
  );

  return findings;
}

async function scanNetwork(): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const proc = Bun.spawn(["ss", "-tlnp"], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const lines = output.trim().split("\n").slice(1); // skip header

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const localAddr = parts[3] || "";
      const processInfo = parts.slice(5).join(" ");

      const addrMatch = localAddr.match(/^([\d.*:]+):(\d+)$/);
      if (!addrMatch) continue;

      const [, host, port] = addrMatch;
      const portNum = parseInt(port, 10);

      const knownPorts = new Set([3100, 9090, 9093]); // Loki, Prometheus, etc.
      if (knownPorts.has(portNum)) continue;

      const bindAll = host === "*" || host === "0.0.0.0" || host === "::";

      if (bindAll) {
        findings.push({
          id: nextId(),
          category: "network",
          severity: "medium",
          title: `Service listening on all interfaces: port ${port}`,
          description: `${processInfo || "Unknown process"} is bound to ${host}:${port}`,
          detail: line.trim(),
          remediation: `Consider binding to 127.0.0.1:${port} instead of ${host}:${port} to limit exposure. If this is a Zo-managed service, verify it needs external access.`,
        });
      } else {
        findings.push({
          id: nextId(),
          category: "network",
          severity: "info",
          title: `Service listening on port ${port}`,
          description: `${processInfo || "Unknown process"} bound to ${localAddr}`,
          detail: line.trim(),
          remediation: "No action needed — service is bound to localhost only.",
        });
      }
    }
  } catch (e) {
    findings.push({
      id: nextId(),
      category: "network",
      severity: "info",
      title: "Network scan skipped",
      description: `Could not run ss command: ${e}`,
      remediation: "Ensure ss is installed (apt install iproute2).",
    });
  }

  return findings;
}

async function scanGitHistory(): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Find all git repos in workspace
  try {
    const proc = Bun.spawn(["find", WORKSPACE, "-name", ".git", "-type", "d", "-maxdepth", "4"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const gitDirs = output.trim().split("\n").filter(Boolean);

    for (const gitDir of gitDirs) {
      const repoDir = join(gitDir, "..");
      const repoName = relative(WORKSPACE, repoDir);

      // Check for secrets in recent git history (last 50 commits)
      const highRiskPatterns = [
        "AKIA[0-9A-Z]{16}",
        "sk_(live|test)_[a-zA-Z0-9]{24,}",
        "-----BEGIN.*PRIVATE KEY-----",
        "ghp_[A-Za-z0-9_]{36}",
      ];

      for (const pattern of highRiskPatterns) {
        try {
          const grepProc = Bun.spawn(
            ["git", "-C", repoDir, "log", "--all", "-n", "50", "-p", "--grep-reflog=.", "-G", pattern],
            { stdout: "pipe", stderr: "pipe" }
          );
          const grepOut = await new Response(grepProc.stdout).text();
          if (grepOut.trim().length > 0) {
            findings.push({
              id: nextId(),
              category: "git_history",
              severity: "critical",
              title: `Secret pattern in git history: ${repoName}`,
              description: `Repository "${repoName}" has commits matching a secret pattern. Even deleted secrets persist in git history.`,
              file: repoName,
              remediation:
                "Use git-filter-repo or BFG Repo Cleaner to purge secrets from history. Rotate the exposed credential immediately.",
            });
            break; // one finding per repo is enough
          }
        } catch {
          // skip
        }
      }

      // Check for .env files committed
      try {
        const lsProc = Bun.spawn(["git", "-C", repoDir, "ls-files", "--", "*.env", ".env*"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const lsOut = await new Response(lsProc.stdout).text();
        const envFiles = lsOut.trim().split("\n").filter(Boolean);
        if (envFiles.length > 0) {
          findings.push({
            id: nextId(),
            category: "git_history",
            severity: "high",
            title: `Env files tracked in git: ${repoName}`,
            description: `${envFiles.length} env file(s) are tracked: ${envFiles.join(", ")}`,
            file: repoName,
            detail: envFiles.join(", "),
            remediation: "Add .env* to .gitignore and remove tracked env files with: git rm --cached .env",
          });
        }
      } catch {
        // skip
      }
    }
  } catch {
    // no git repos found
  }

  return findings;
}

function summarize(findings: Finding[]): Record<string, number> {
  const summary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    summary[f.severity] = (summary[f.severity] || 0) + 1;
  }
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Zo Security Audit Scanner

Usage: bun audit.ts [--output <path>] [--category <name>] [--json]

Options:
  --output <path>     Save JSON results to file (default: ${DEFAULT_OUTPUT})
  --category <name>   Run only a specific category:
                        secrets, sensitive_files, env_files, network, git_history
  --json              Output raw JSON to stdout (for piping)
  --help, -h          Show this help

Categories scanned:
  secrets             Scans files for hardcoded API keys, tokens, passwords
  sensitive_files     Finds private keys, credentials files, databases
  env_files           Checks .env files for hardcoded values
  network             Lists open ports and listening services
  git_history         Checks git repos for leaked secrets in history

Note: This script handles filesystem/network scanning. Zo tool-based checks
(zo.space routes, services, agents, integrations) are done by Zo directly
when running the full skill per SKILL.md instructions.
`);
    process.exit(0);
  }

  const outputIdx = args.indexOf("--output");
  const outputPath = outputIdx >= 0 && args[outputIdx + 1] ? args[outputIdx + 1] : DEFAULT_OUTPUT;
  const categoryIdx = args.indexOf("--category");
  const onlyCategory = categoryIdx >= 0 ? args[categoryIdx + 1] : null;
  const jsonMode = args.includes("--json");

  const start = Date.now();
  const config = await loadPatterns();
  const allFindings: Finding[] = [];

  const categories: Record<string, () => Promise<Finding[]>> = {
    secrets: () => scanSecrets(config),
    sensitive_files: () => scanSensitiveFiles(config),
    env_files: () => scanEnvFiles(config),
    network: () => scanNetwork(),
    git_history: () => scanGitHistory(),
  };

  if (onlyCategory) {
    if (!categories[onlyCategory]) {
      console.error(`Unknown category: ${onlyCategory}`);
      process.exit(1);
    }
    if (!jsonMode) console.log(`Scanning: ${onlyCategory}...`);
    allFindings.push(...(await categories[onlyCategory]()));
  } else {
    for (const [name, fn] of Object.entries(categories)) {
      if (!jsonMode) process.stdout.write(`Scanning: ${name}...`);
      const results = await fn();
      allFindings.push(...results);
      if (!jsonMode) console.log(` ${results.length} finding(s)`);
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  const result: AuditResult = {
    timestamp: new Date().toISOString(),
    findings: allFindings,
    summary: summarize(allFindings),
    metadata: { scannedFiles: 0, scannedDirs: 0, duration: `${duration}s` },
  };

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    await writeFile(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Scan complete in ${duration}s`);
    console.log(`   Findings: ${allFindings.length} total`);
    console.log(
      `   🔴 ${result.summary.critical} critical  🟠 ${result.summary.high} high  🟡 ${result.summary.medium} medium  🔵 ${result.summary.low} low  ⚪ ${result.summary.info} info`
    );
    console.log(`   Report saved to: ${outputPath}`);
  }
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
