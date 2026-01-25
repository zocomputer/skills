import { cp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";

type Issue = {
  skillPath: string;
  message: string;
};

const ROOT_DIR = process.cwd();
const INSTALL_AGENT = "codex";
const CANONICAL_SKILLS_DIR = path.join(ROOT_DIR, ".agents", "skills");
const AGENTS_DIR = path.join(ROOT_DIR, ".agents");
const CODEX_DIR = path.join(ROOT_DIR, ".codex");
// Skip non-skill dirs and any gitignored folders during validation.
const NON_SKILL_DIRS = new Set([
  ".git",
  ".github",
  ".agents",
  ".codex",
  ".clawdhub",
  ".skills",
  "node_modules",
]);
const ALLOWED_SKILL_DIRS = new Set(["assets", "references", "scripts"]);

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const toDisplayPath = (fullPath: string) => path.relative(ROOT_DIR, fullPath);

const isDirectory = async (targetPath: string) => {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
};

const isGitIgnored = (targetPath: string) => {
  const result = Bun.spawnSync(["git", "check-ignore", "-q", targetPath], {
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
};

const loadSkillDirectories = async () => {
  const skillDirs: string[] = [];
  const entries = await readdir(ROOT_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (NON_SKILL_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(ROOT_DIR, entry.name);
    if (isGitIgnored(fullPath)) {
      continue;
    }
    skillDirs.push(fullPath);
  }
  return skillDirs;
};

// External sources live in external.yml (repository + optional skill + notice).
const EXTERNAL_CONFIG = path.join(ROOT_DIR, "external.yml");

type ExternalSkill = {
  repository: string;
  skill?: string;
  notice?: string;
  overrides?: Record<string, unknown>;
};

const parseExternalConfig = (content: string) => {
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const sources: ExternalSkill[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const repository = typeof record.repository === "string" ? record.repository.trim() : "";
    if (!repository) {
      continue;
    }
    const skill = typeof record.skill === "string" ? record.skill.trim() : undefined;
    const notice = typeof record.notice === "string" ? record.notice : undefined;
    const overrides: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === "repository" || key === "skill" || key === "notice") {
        continue;
      }
      overrides[key] = value;
    }
    const source: ExternalSkill = { repository };
    if (skill) {
      source.skill = skill;
    }
    if (notice) {
      source.notice = notice;
    }
    if (Object.keys(overrides).length > 0) {
      source.overrides = overrides;
    }
    sources.push(source);
  }
  return sources;
};

const hasFrontmatter = (content: string) => content.trimStart().startsWith("---");

// Use gray-matter for parsing, but serialize ourselves to keep metadata deterministic.
const parseSkillFile = (content: string) => {
  const parsed = matter(content);
  return {
    data: parsed.data as Record<string, unknown>,
    body: parsed.content,
  };
};

const readSkillFile = async (skillFile: string) => {
  const content = await readFile(skillFile, "utf8");
  if (!hasFrontmatter(content)) {
    return null;
  }
  return parseSkillFile(content);
};

const serializeFrontmatterValue = (value: unknown) => {
  if (typeof value === "string") {
    if (value.includes("\n")) {
      const lines = value.split("\n").map((line) => `  ${line}`);
      return `|\n${lines.join("\n")}`;
    }
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

// Metadata is a YAML block with JSON-serialized nested values.
const serializeMetadataBlock = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return serializeFrontmatterValue(value);
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const lines = ["metadata:"];
  for (const [key, metaValue] of entries) {
    if (metaValue === undefined) {
      continue;
    }
    if (metaValue !== null && typeof metaValue === "object") {
      lines.push(`  ${key}: ${JSON.stringify(metaValue)}`);
    } else {
      lines.push(`  ${key}: ${serializeFrontmatterValue(metaValue)}`);
    }
  }
  return lines.join("\n");
};

// Frontmatter order is stable; metadata keys are alphabetized.
const serializeSkillFile = (data: Record<string, unknown>, body: string) => {
  const preferredOrder = [
    "name",
    "description",
    "homepage",
    "license",
    "compatibility",
    "allowed-tools",
    "metadata",
  ];
  const keys = Object.keys(data);
  const orderedKeys = [
    ...preferredOrder.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !preferredOrder.includes(key)).sort(),
  ];
  const lines = ["---"];
  for (const key of orderedKeys) {
    const value = data[key];
    if (value === undefined) {
      continue;
    }
    if (key === "metadata") {
      const serialized = serializeMetadataBlock(value);
      if (serialized.startsWith("metadata:")) {
        lines.push(serialized);
      } else {
        lines.push(`metadata: ${serialized}`);
      }
      continue;
    }
    const serialized = serializeFrontmatterValue(value);
    lines.push(`${key}: ${serialized}`);
  }
  lines.push("---");
  const trimmedBody = body.replace(/^\s+/, "");
  return `${lines.join("\n")}\n\n${trimmedBody}`;
};

const validateSkill = async (skillDir: string): Promise<Issue[]> => {
  const issues: Issue[] = [];
  const skillName = path.basename(skillDir);
  const skillFile = path.join(skillDir, "SKILL.md");

  try {
    const entries = await readdir(skillDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!ALLOWED_SKILL_DIRS.has(entry.name)) {
        issues.push({
          skillPath: toDisplayPath(skillDir),
          message:
            "Only 'assets', 'references', or 'scripts' directories are allowed at the skill root.",
        });
        break;
      }
    }
  } catch {
    issues.push({
      skillPath: toDisplayPath(skillDir),
      message: "Unable to read skill directory contents.",
    });
    return issues;
  }

  let content: string;
  try {
    content = await readFile(skillFile, "utf8");
  } catch {
    issues.push({
      skillPath: toDisplayPath(skillDir),
      message: "Missing SKILL.md file.",
    });
    return issues;
  }

  if (!hasFrontmatter(content)) {
    issues.push({
      skillPath: toDisplayPath(skillFile),
      message: "Missing frontmatter start '---'.",
    });
    return issues;
  }

  const { data } = parseSkillFile(content);
  const name = typeof data.name === "string" ? data.name : "";
  const description = typeof data.description === "string" ? data.description : "";
  const metadata = data.metadata;
  const author =
    metadata && typeof metadata === "object" && "author" in metadata
      ? String((metadata as Record<string, unknown>).author ?? "")
      : "";

  if (!name) {
    issues.push({
      skillPath: toDisplayPath(skillFile),
      message: "Missing required 'name' field in frontmatter.",
    });
  } else {
    if (name.length > 64) {
      issues.push({
        skillPath: toDisplayPath(skillFile),
        message: "Field 'name' exceeds 64 characters.",
      });
    }
    if (!NAME_PATTERN.test(name)) {
      issues.push({
        skillPath: toDisplayPath(skillFile),
        message:
          "Field 'name' must be lowercase alphanumeric with single hyphens only.",
      });
    }
    if (name !== skillName) {
      issues.push({
        skillPath: toDisplayPath(skillFile),
        message: "Field 'name' must match the parent directory name.",
      });
    }
  }

  if (!description) {
    issues.push({
      skillPath: toDisplayPath(skillFile),
      message: "Missing required 'description' field in frontmatter.",
    });
  } else {
    if (description.length > 1024) {
      issues.push({
        skillPath: toDisplayPath(skillFile),
        message: "Field 'description' exceeds 1024 characters.",
      });
    }
  }

  if (!author) {
    issues.push({
      skillPath: toDisplayPath(skillFile),
      message: "Missing required 'metadata.author' field in frontmatter.",
    });
  }

  return issues;
};

type SkillInfo = {
  slug: string;
  path: string;
} & Record<string, unknown>;

type SkillManifest = {
  tarball_url: string;
  archive_root: string;
  skills: SkillInfo[];
};

const parseGitHubRepo = (remoteUrl: string) => {
  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }
  return null;
};

const appendCompatibilityNote = (current: unknown, note: string) => {
  if (typeof current !== "string" || !current.trim()) {
    return note;
  }
  if (current.includes(note)) {
    return current;
  }
  return `${current}; ${note}`;
};

const inferCompatibilityNote = (data: Record<string, unknown>) => {
  const metadata = data.metadata;
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const clawdbot = (metadata as Record<string, unknown>).clawdbot;
  if (!clawdbot || typeof clawdbot !== "object") {
    return undefined;
  }
  const requires = (clawdbot as Record<string, unknown>).requires;
  if (!requires || typeof requires !== "object") {
    return undefined;
  }
  return "see metadata.clawdbot.requires";
};

const normalizeClawdbotInstall = (data: Record<string, unknown>) => {
  const metadata = data.metadata;
  if (!metadata || typeof metadata !== "object") {
    return { data, changed: false };
  }
  const metadataRecord = metadata as Record<string, unknown>;
  const clawdbot = metadataRecord.clawdbot;
  if (!clawdbot || typeof clawdbot !== "object") {
    return { data, changed: false };
  }
  const clawdbotRecord = clawdbot as Record<string, unknown>;
  const install = clawdbotRecord.install;
  if (!Array.isArray(install)) {
    return { data, changed: false };
  }
  const filtered = install.filter((entry) => {
    if (!entry || typeof entry !== "object") {
      return true;
    }
    return (entry as Record<string, unknown>).kind !== "brew";
  });
  if (filtered.length === install.length) {
    return { data, changed: false };
  }
  const updatedClawdbot = { ...clawdbotRecord };
  if (filtered.length > 0) {
    updatedClawdbot.install = filtered;
  } else {
    delete updatedClawdbot.install;
  }
  const updatedMetadata = { ...metadataRecord, clawdbot: updatedClawdbot };
  return { data: { ...data, metadata: updatedMetadata }, changed: true };
};

// Manifest points to repo tarball + archive root to enable tar extraction.
const resolveGitHubArchive = () => {
  const remote = Bun.spawnSync(["git", "remote", "get-url", "origin"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const remoteUrl = remote.success ? remote.stdout.toString().trim() : "";
  const repo = remoteUrl ? parseGitHubRepo(remoteUrl) : null;
  const branch = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const ref = branch.success ? branch.stdout.toString().trim() : "main";
  const safeRef = ref.replaceAll("/", "-");
  if (!repo) {
    return {
      tarball_url: `https://codeload.github.com/zocomputer/skills/tar.gz/refs/heads/${ref}`,
      archive_root: `skills-${safeRef}`,
    };
  }
  return {
    tarball_url: `https://codeload.github.com/${repo.owner}/${repo.repo}/tar.gz/refs/heads/${ref}`,
    archive_root: `${repo.repo}-${safeRef}`,
  };
};

const loadSkillInfo = async (skillDir: string) => {
  const skillFile = path.join(skillDir, "SKILL.md");
  try {
    const parsed = await readSkillFile(skillFile);
    if (!parsed) {
      return null;
    }
    const { data } = parsed;
    const name = typeof data.name === "string" ? data.name : "";
    const description = typeof data.description === "string" ? data.description : "";
    if (!name || !description) {
      return null;
    }
    let normalized = normalizeClawdbotInstall(data).data;
    const note = inferCompatibilityNote(normalized);
    if (note) {
      normalized = {
        ...normalized,
        compatibility: appendCompatibilityNote(normalized.compatibility, note),
      };
    }
    return normalized;
  } catch {
    return null;
  }
};

const normalizeNotice = (notice: string) => {
  let normalized = notice.trim();
  if (normalized.toLowerCase().startsWith("# notice")) {
    normalized = normalized.replace(/^# notice\s*/i, "").trim();
  }
  return normalized;
};

const upsertNoticeSection = async (skillFile: string, notice: string) => {
  const normalized = normalizeNotice(notice);
  if (!normalized) {
    return;
  }
  const parsed = await readSkillFile(skillFile);
  if (!parsed) {
    return;
  }
  const noticeSection = `# Notice\n\n${normalized}\n`;
  const sectionRegex = /^(# Notice[\s\S]*?)\n(?=# )/m;
  let body = parsed.body.trimStart();
  if (sectionRegex.test(body)) {
    body = body.replace(sectionRegex, `${noticeSection.trimEnd()}\n`);
  } else {
    body = `${noticeSection}\n${body}`;
  }
  const updated = serializeSkillFile(parsed.data, body);
  await writeFile(skillFile, updated);
};

const ensureMetadataAuthor = async (skillFile: string, author: string) => {
  const parsed = await readSkillFile(skillFile);
  if (!parsed) {
    return;
  }
  const metadata = parsed.data.metadata;
  if (metadata && typeof metadata === "object" && "author" in metadata) {
    return;
  }
  const updatedMetadata =
    metadata && typeof metadata === "object" ? { ...metadata } : {};
  (updatedMetadata as Record<string, unknown>).author = author;
  parsed.data.metadata = updatedMetadata;
  const updated = serializeSkillFile(parsed.data, parsed.body);
  await writeFile(skillFile, updated);
};

const ensureCompatibility = async (skillFile: string) => {
  const parsed = await readSkillFile(skillFile);
  if (!parsed) {
    return;
  }
  let updatedData = parsed.data;
  let changed = false;
  // Append a compatibility hint when clawdbot declares requirements.
  const note = inferCompatibilityNote(parsed.data);
  if (note) {
    const merged = appendCompatibilityNote(updatedData.compatibility, note);
    if (merged !== updatedData.compatibility) {
      updatedData = { ...updatedData, compatibility: merged };
      changed = true;
    }
  }
  const normalized = normalizeClawdbotInstall(updatedData);
  if (normalized.changed) {
    updatedData = normalized.data;
    changed = true;
  }
  if (!changed) {
    return;
  }
  const updated = serializeSkillFile(updatedData, parsed.body);
  await writeFile(skillFile, updated);
};

const isPlainObject = (value: unknown) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const applyFrontmatterOverrides = async (
  skillFile: string,
  overrides: Record<string, unknown>,
) => {
  if (!overrides || Object.keys(overrides).length === 0) {
    return;
  }
  const parsed = await readSkillFile(skillFile);
  if (!parsed) {
    return;
  }
  const { slug: _slug, ...frontmatterOverrides } = overrides;
  if (Object.keys(frontmatterOverrides).length === 0) {
    return;
  }
  const updatedData = { ...parsed.data };
  for (const [key, value] of Object.entries(frontmatterOverrides)) {
    const existing = updatedData[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      updatedData[key] = {
        ...(existing as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    } else {
      updatedData[key] = value;
    }
  }
  const updated = serializeSkillFile(updatedData, parsed.body);
  await writeFile(skillFile, updated);
};

const getRepositoryOwner = (repository: string) => {
  const owner = repository.split("/")[0]?.trim() ?? "";
  if (!owner) {
    return "";
  }
  return owner.charAt(0).toUpperCase() + owner.slice(1);
};

const resolveSkillSlug = (source: ExternalSkill) =>
  source.skill ?? source.repository.split("/").pop() ?? "";

const resolveTargetSlug = (source: ExternalSkill) => {
  const override = source.overrides?.slug;
  if (typeof override === "string" && override.trim()) {
    return override.trim();
  }
  return resolveSkillSlug(source);
};

const copySkillIntoRepo = async (source: ExternalSkill) => {
  const canonicalSlug = resolveSkillSlug(source);
  const targetSlug = resolveTargetSlug(source);
  const canonicalPath = path.join(CANONICAL_SKILLS_DIR, canonicalSlug);
  const targetPath = path.join(ROOT_DIR, targetSlug);
  await rm(targetPath, { recursive: true, force: true });
  await cp(canonicalPath, targetPath, { recursive: true });
  return targetPath;
};

const cleanupAgentDirs = async () => {
  await rm(AGENTS_DIR, { recursive: true, force: true });
  await rm(CODEX_DIR, { recursive: true, force: true });
};

const validateAllSkills = async () => {
  const skillDirs = await loadSkillDirectories();
  if (skillDirs.length === 0) {
    console.log("No skills found at the repository root.");
    return 0;
  }

  const allIssues: Issue[] = [];
  for (const skillDir of skillDirs) {
    const issues = await validateSkill(skillDir);
    allIssues.push(...issues);
  }

  if (allIssues.length === 0) {
    console.log(`Validated ${skillDirs.length} skills. No issues found.`);
    return 0;
  }

  console.log(`Detected ${allIssues.length} issue(s):`);
  for (const issue of allIssues) {
    console.log(`- ${issue.skillPath}: ${issue.message}`);
  }
  return 1;
};

const writeManifest = async () => {
  const skillDirs = await loadSkillDirectories();
  if (skillDirs.length === 0) {
    console.log("No skills found at the repository root.");
    return 1;
  }

  const { tarball_url, archive_root } = resolveGitHubArchive();
  const skills: SkillInfo[] = [];

  for (const skillDir of skillDirs) {
    const info = await loadSkillInfo(skillDir);
    if (!info) {
      continue;
    }
    const relPath = toDisplayPath(skillDir);
    const slug = path.basename(skillDir);
    skills.push({
      ...info,
      slug,
      path: relPath,
    });
  }

  const manifest: SkillManifest = {
    tarball_url,
    archive_root,
    skills,
  };

  await writeFile(
    path.join(ROOT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(`Wrote manifest.json with ${skills.length} skill(s).`);
  return 0;
};

// Sync external skills via add-skill CLI non-interactively.
// We install into Codex (.agents/skills) to avoid TTY prompts, then copy the
// canonical skill into the repo root and clean up agent dirs.
const syncExternalSkills = async () => {
  let config: string;
  try {
    config = await readFile(EXTERNAL_CONFIG, "utf8");
  } catch {
    console.log("No external.yml found. Nothing to sync.");
    return 0;
  }

  const sources = parseExternalConfig(config);
  if (sources.length === 0) {
    console.log("No external skills listed in external.yml.");
    return 0;
  }

  let failures = 0;
  for (const source of sources) {
    console.log(`Installing ${source.repository}...`);
    const args = [
      "npx",
      "add-skill",
      source.repository,
      "--yes",
      "--agent",
      INSTALL_AGENT,
    ];
    if (source.skill) {
      args.push("--skill", source.skill);
    }
    const proc = Bun.spawn(
      args,
      {
        cwd: ROOT_DIR,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      failures += 1;
    }
    if (exitCode === 0) {
      const targetSlug = resolveTargetSlug(source);
      if (!targetSlug) {
        continue;
      }
      let targetPath: string;
      try {
        targetPath = await copySkillIntoRepo(source);
      } catch {
        console.log(`Unable to copy ${targetSlug} into repo root.`);
        continue;
      }
      const skillFile = path.join(targetPath, "SKILL.md");
      const author = getRepositoryOwner(source.repository);
      if (author) {
        try {
          await ensureMetadataAuthor(skillFile, author);
        } catch {
          console.log(`Unable to set metadata.author for ${source.repository}.`);
        }
      }
      if (source.notice) {
        try {
          await upsertNoticeSection(skillFile, source.notice);
        } catch {
          console.log(`Unable to insert notice for ${source.repository}.`);
        }
      }
      try {
        await ensureCompatibility(skillFile);
      } catch {
        console.log(`Unable to infer compatibility for ${source.repository}.`);
      }
      if (source.overrides) {
        try {
          await applyFrontmatterOverrides(skillFile, source.overrides);
        } catch {
          console.log(`Unable to apply overrides for ${source.repository}.`);
        }
      }
      await cleanupAgentDirs();
    }
  }

  if (failures > 0) {
    console.log(`Failed to install ${failures} external skill source(s).`);
    return 1;
  }

  console.log(`Installed ${sources.length} external skill source(s).`);
  return 0;
};

const main = async () => {
  const [command] = process.argv.slice(2);
  if (!command) {
    return;
  }
  if (command === "validate") {
    const exitCode = await validateAllSkills();
    process.exitCode = exitCode;
    return;
  }
  if (command === "sync") {
    const exitCode = await syncExternalSkills();
    process.exitCode = exitCode;
    return;
  }
  if (command === "manifest") {
    const exitCode = await writeManifest();
    process.exitCode = exitCode;
    return;
  }

  console.log(`Unknown command: ${command}`);
  process.exitCode = 1;
};

await main();