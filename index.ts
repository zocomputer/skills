import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

type Issue = {
  skillPath: string;
  message: string;
  level: "error" | "warning";
};

const ROOT_DIR = process.cwd();
const INSTALL_AGENT = "codex";
const ZO_DIR = "Zo";
const EXTERNAL_DIR = "External";
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

const getCategoryDirs = async () => {
  const categories: string[] = [];
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
    categories.push(entry.name);
  }
  return categories;
};

const getCategorySet = async () => new Set(await getCategoryDirs());

const isSkillDirectory = async (targetPath: string) => {
  try {
    return (await stat(path.join(targetPath, "SKILL.md"))).isFile();
  } catch {
    return false;
  }
};

const loadSkillDirectories = async () => {
  const skillDirs: string[] = [];
  const categories = await getCategoryDirs();
  for (const category of categories) {
    const groupPath = path.join(ROOT_DIR, category);
    const entries = await readdir(groupPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(groupPath, entry.name);
      if (isGitIgnored(fullPath)) {
        continue;
      }
      if (await isSkillDirectory(fullPath)) {
        skillDirs.push(fullPath);
      }
    }
  }
  // Backward-compatible: catch any skills still at repo root.
  const rootEntries = await readdir(ROOT_DIR, { withFileTypes: true });
  for (const entry of rootEntries) {
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
    if (await isSkillDirectory(fullPath)) {
      skillDirs.push(fullPath);
    }
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
      if (key === "repository" || key === "skill" || key === "notice" || key === "name") {
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

const countExternalMetadataFields = (entry: Record<string, unknown>) => {
  let count = 0;
  for (const key of Object.keys(entry)) {
    if (key === "repository" || key === "skill") {
      continue;
    }
    if (entry[key] !== undefined) {
      count += 1;
    }
  }
  return count;
};

const resolveRecordSlug = (entry: Record<string, unknown>) => {
  const overrideSlug = typeof entry.slug === "string" ? entry.slug.trim() : "";
  if (overrideSlug) {
    return overrideSlug;
  }
  const skill = typeof entry.skill === "string" ? entry.skill.trim() : "";
  if (skill) {
    return skill;
  }
  const repository = typeof entry.repository === "string" ? entry.repository : "";
  return repository.split("/").pop() ?? "";
};

const escapeTableValue = (value: string) => value.replace(/\|/g, "\\|");

const normalizeTableText = (value: string) => value.replace(/\s+/g, " ").trim();

const resolveSkillGroup = (
  slug: string,
  externalSlugs: Set<string>,
  currentCategory: string,
  defaultCategory: string,
) => {
  if (externalSlugs.has(slug)) {
    return EXTERNAL_DIR;
  }
  if (currentCategory) {
    return currentCategory;
  }
  return defaultCategory;
};

const collectSkillDirectoriesForReorg = async () => {
  const skillDirs = new Map<string, string>();
  const rootEntries = await readdir(ROOT_DIR, { withFileTypes: true });
  for (const entry of rootEntries) {
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
    if (await isSkillDirectory(fullPath)) {
      skillDirs.set(entry.name, fullPath);
    }
  }
  const categories = await getCategoryDirs();
  for (const category of categories) {
    const groupPath = path.join(ROOT_DIR, category);
    if (!(await isDirectory(groupPath))) {
      continue;
    }
    const entries = await readdir(groupPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(groupPath, entry.name);
      if (isGitIgnored(fullPath)) {
        continue;
      }
      if (await isSkillDirectory(fullPath)) {
        skillDirs.set(entry.name, fullPath);
      }
    }
  }
  return skillDirs;
};

const reorganizeSkillDirectories = async (externalSlugs: Set<string>) => {
  await mkdir(path.join(ROOT_DIR, EXTERNAL_DIR), { recursive: true });
  const categoryDirs = await getCategoryDirs();
  const sortedCategories = [...categoryDirs].sort((a, b) => a.localeCompare(b));
  const nonExternalCategories = sortedCategories.filter((name) => name !== EXTERNAL_DIR);
  const defaultCategory = nonExternalCategories.includes(ZO_DIR)
    ? ZO_DIR
    : nonExternalCategories[0] ?? EXTERNAL_DIR;
  const categorySet = await getCategorySet();
  categorySet.add(EXTERNAL_DIR);
  categorySet.add(ZO_DIR);
  const skillDirs = await collectSkillDirectoriesForReorg();
  let moved = 0;
  for (const [slug, currentPath] of skillDirs.entries()) {
    const currentCategory = path.basename(path.dirname(currentPath));
    const group = resolveSkillGroup(
      slug,
      externalSlugs,
      categorySet.has(currentCategory) ? currentCategory : "",
      defaultCategory,
    );
    const targetPath = path.join(ROOT_DIR, group, slug);
    if (path.resolve(currentPath) === path.resolve(targetPath)) {
      continue;
    }
    try {
      await mkdir(path.join(ROOT_DIR, group), { recursive: true });
      await rm(targetPath, { recursive: true, force: true });
      await rename(currentPath, targetPath);
      moved += 1;
    } catch {
      console.log(`Unable to move ${slug} to ${group}.`);
    }
  }
  return moved;
};

const ensureMetadataCategoryForAllSkills = async () => {
  const categorySet = await getCategorySet();
  const skillDirs = await loadSkillDirectories();
  let updated = 0;
  for (const skillDir of skillDirs) {
    const skillFile = path.join(skillDir, "SKILL.md");
    try {
      const parsed = await readSkillFile(skillFile);
      if (!parsed) {
        continue;
      }
      const category = resolveCategoryFromSkillPath(skillFile, categorySet);
      if (!category) {
        continue;
      }
      const metadata = parsed.data.metadata;
      const updatedMetadata =
        metadata && typeof metadata === "object" ? { ...metadata } : {};
      const current = (updatedMetadata as Record<string, unknown>).category;
      if (current === category) {
        continue;
      }
      (updatedMetadata as Record<string, unknown>).category = category;
      parsed.data.metadata = updatedMetadata;
      const updatedFile = serializeSkillFile(parsed.data, parsed.body);
      await writeFile(skillFile, updatedFile);
      updated += 1;
    } catch {
      console.log(`Unable to set metadata.category for ${skillDir}.`);
    }
  }
  return updated;
};

const ensureSkillNameSlugForAllSkills = async () => {
  const skillDirs = await loadSkillDirectories();
  let updated = 0;
  for (const skillDir of skillDirs) {
    const skillFile = path.join(skillDir, "SKILL.md");
    const slug = path.basename(skillDir);
    try {
      const parsed = await readSkillFile(skillFile);
      if (!parsed) {
        continue;
      }
      const currentName = typeof parsed.data.name === "string" ? parsed.data.name : "";
      if (!currentName || currentName === slug) {
        if (!currentName) {
          parsed.data.name = slug;
          const updatedFile = serializeSkillFile(parsed.data, parsed.body);
          await writeFile(skillFile, updatedFile);
          updated += 1;
        }
        continue;
      }
      const metadata =
        parsed.data.metadata && typeof parsed.data.metadata === "object"
          ? { ...(parsed.data.metadata as Record<string, unknown>) }
          : {};
      if (!("display-name" in metadata) || !metadata["display-name"]) {
        metadata["display-name"] = currentName;
      }
      parsed.data.name = slug;
      parsed.data.metadata = metadata;
      const updatedFile = serializeSkillFile(parsed.data, parsed.body);
      await writeFile(skillFile, updatedFile);
      updated += 1;
    } catch {
      console.log(`Unable to normalize name for ${skillDir}.`);
    }
  }
  return updated;
};

const resolveRecordDescription = (
  entry: Record<string, unknown>,
  manifestDescriptions: Map<string, string>,
) => {
  const slug = resolveRecordSlug(entry);
  if (slug && manifestDescriptions.has(slug)) {
    return escapeTableValue(normalizeTableText(manifestDescriptions.get(slug) ?? ""));
  }
  if (typeof entry.description === "string" && entry.description.trim()) {
    return escapeTableValue(normalizeTableText(entry.description));
  }
  if (typeof entry.name === "string" && entry.name.trim()) {
    return escapeTableValue(normalizeTableText(entry.name));
  }
  return "";
};

const resolveRecordAuthor = (entry: Record<string, unknown>, manifestAuthors: Map<string, string>) => {
  const slug = resolveRecordSlug(entry);
  if (slug && manifestAuthors.has(slug)) {
    return escapeTableValue(normalizeTableText(manifestAuthors.get(slug) ?? ""));
  }
  return "";
};

const SKILLS_TABLE_START = "<!-- skills-table-start -->";
const SKILLS_TABLE_END = "<!-- skills-table-end -->";

const getRepoHttpUrl = () => {
  const remote = Bun.spawnSync(["git", "remote", "get-url", "origin"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const remoteUrl = remote.success ? remote.stdout.toString().trim() : "";
  const repo = remoteUrl ? parseGitHubRepo(remoteUrl) : null;
  if (!repo) {
    return "https://github.com/zocomputer/skills";
  }
  return `https://github.com/${repo.owner}/${repo.repo}`;
};

const getRepoRef = () => {
  const branch = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  return branch.success ? branch.stdout.toString().trim() : "main";
};

const buildSkillsTable = (
  entries: Record<string, unknown>[],
  manifestDescriptions: Map<string, string>,
  manifestAuthors: Map<string, string>,
) => {
  const lines = [
    "| Skill | Author | Description |",
    "| --- | --- | --- |",
  ];
  const repoUrl = getRepoHttpUrl();
  const ref = getRepoRef();
  for (const entry of entries) {
    const slug = resolveRecordSlug(entry);
    if (!slug) {
      continue;
    }
    const description = resolveRecordDescription(entry, manifestDescriptions);
    const author = resolveRecordAuthor(entry, manifestAuthors);
    const link = `${repoUrl}/blob/${ref}/${EXTERNAL_DIR}/${slug}/SKILL.md`;
    lines.push(`| [${slug}](${link}) | ${author} | ${description} |`);
  }
  lines.push("");
  return lines.join("\n");
};

const upsertSkillsTableInReadme = async (table: string) => {
  const readmePath = path.join(ROOT_DIR, "README.md");
  let readme = "";
  try {
    readme = await readFile(readmePath, "utf8");
  } catch {
    console.log("Unable to read README.md.");
    return;
  }

  const tableBlock = `${SKILLS_TABLE_START}\n${table}\n${SKILLS_TABLE_END}`;
  const markerRegex = new RegExp(
    `${SKILLS_TABLE_START}[\\s\\S]*?${SKILLS_TABLE_END}`,
    "m",
  );
  if (markerRegex.test(readme)) {
    const updated = readme.replace(markerRegex, tableBlock);
    await writeFile(readmePath, updated);
    return;
  }

  const section = `## Skills\n\n${tableBlock}\n\n`;
  const contributingIndex = readme.indexOf("# Contributing");
  if (contributingIndex !== -1) {
    const updated =
      readme.slice(0, contributingIndex) + section + readme.slice(contributingIndex);
    await writeFile(readmePath, updated);
    return;
  }

  await writeFile(readmePath, `${readme.trimEnd()}\n\n${section}`);
};

const loadManifestDescriptions = async () => {
  const manifestPath = path.join(ROOT_DIR, "manifest.json");
  let raw = "";
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch {
    console.log("manifest.json not found; using external.yml metadata for descriptions.");
    return new Map<string, string>();
  }

  try {
    const parsed = JSON.parse(raw) as SkillManifest;
    const descriptions = new Map<string, string>();
    for (const skill of parsed.skills ?? []) {
      if (skill && typeof skill.slug === "string" && typeof skill.description === "string") {
        descriptions.set(skill.slug, skill.description.trim());
      }
    }
    return descriptions;
  } catch {
    console.log("Unable to parse manifest.json; using external.yml metadata for descriptions.");
    return new Map<string, string>();
  }
};

const loadManifestAuthors = async () => {
  const manifestPath = path.join(ROOT_DIR, "manifest.json");
  let raw = "";
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch {
    console.log("manifest.json not found; using external.yml metadata for authors.");
    return new Map<string, string>();
  }

  try {
    const parsed = JSON.parse(raw) as SkillManifest;
    const authors = new Map<string, string>();
    for (const skill of parsed.skills ?? []) {
      if (!skill || typeof skill.slug !== "string") {
        continue;
      }
      const metadata = (skill as Record<string, unknown>).metadata;
      if (!metadata || typeof metadata !== "object") {
        continue;
      }
      const author = (metadata as Record<string, unknown>).author;
      if (typeof author === "string" && author.trim()) {
        authors.set(skill.slug, author.trim());
      }
    }
    return authors;
  } catch {
    console.log("Unable to parse manifest.json; using external.yml metadata for authors.");
    return new Map<string, string>();
  }
};

const organizeExternalConfig = async () => {
  let config: string;
  try {
    config = await readFile(EXTERNAL_CONFIG, "utf8");
  } catch {
    console.log("No external.yml found. Nothing to organize.");
    return 0;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(config);
  } catch {
    console.log("Unable to parse external.yml.");
    return 1;
  }
  if (!Array.isArray(parsed)) {
    console.log("external.yml must be a list.");
    return 1;
  }

  const entries = parsed.filter((entry) => entry && typeof entry === "object");
  const grouped = new Map<string, Record<string, unknown>[]>();
  const repoOrder: string[] = [];
  for (const entry of entries) {
    const record = entry as Record<string, unknown>;
    const repository = typeof record.repository === "string" ? record.repository : "";
    if (!repository) {
      continue;
    }
    if (!grouped.has(repository)) {
      grouped.set(repository, []);
      repoOrder.push(repository);
    }
    grouped.get(repository)?.push(record);
  }

  const preferredRepoOrder = ["clawdbot/clawdbot", "clawdbot/skills"];
  const preferredRepos = new Set(preferredRepoOrder);
  const orderedRepos = preferredRepoOrder
    .filter((repo) => repoOrder.includes(repo))
    .concat(
      repoOrder
        .filter((repo) => !preferredRepos.has(repo))
        .sort((a, b) => {
          const sizeA = grouped.get(a)?.length ?? 0;
          const sizeB = grouped.get(b)?.length ?? 0;
          if (sizeA !== sizeB) {
            return sizeA - sizeB;
          }
          return a.localeCompare(b);
        }),
    );

  const organized: Record<string, unknown>[] = [];
  for (const repository of orderedRepos) {
    const group = grouped.get(repository) ?? [];
    group.sort((a, b) => {
      const countA = countExternalMetadataFields(a);
      const countB = countExternalMetadataFields(b);
      if (countA !== countB) {
        return countB - countA;
      }
      const skillA = typeof a.skill === "string" ? a.skill : "";
      const skillB = typeof b.skill === "string" ? b.skill : "";
      return skillA.localeCompare(skillB);
    });
    organized.push(
      ...group.map((record) => {
        const { name: _name, ...rest } = record;
        return rest;
      }),
    );
  }

  const output = stringifyYaml(organized, { lineWidth: 0 });
  await writeFile(EXTERNAL_CONFIG, output);
  const externalSlugs = new Set(
    organized.map((entry) => resolveRecordSlug(entry)).filter(Boolean),
  );
  const moved = await reorganizeSkillDirectories(externalSlugs);
  const nameUpdates = await ensureSkillNameSlugForAllSkills();
  const categoryUpdates = await ensureMetadataCategoryForAllSkills();
  const manifestDescriptions = await loadManifestDescriptions();
  const manifestAuthors = await loadManifestAuthors();
  const table = buildSkillsTable(organized, manifestDescriptions, manifestAuthors);
  await upsertSkillsTableInReadme(table);
  console.log(`Organized ${organized.length} external skill entries.`);
  if (moved > 0) {
    console.log(`Moved ${moved} skill(s) into category folders.`);
  }
  if (nameUpdates > 0) {
    console.log(`Normalized name field for ${nameUpdates} skill(s).`);
  }
  if (categoryUpdates > 0) {
    console.log(`Updated metadata.category for ${categoryUpdates} skill(s).`);
  }
  return 0;
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
  const parentCategory = path.basename(path.dirname(skillDir));
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
          level: parentCategory === EXTERNAL_DIR ? "warning" : "error",
        });
        break;
      }
    }
  } catch {
    issues.push({
      skillPath: toDisplayPath(skillDir),
      message: "Unable to read skill directory contents.",
      level: "error",
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
      level: "error",
    });
    return issues;
  }

  if (!hasFrontmatter(content)) {
    issues.push({
      skillPath: toDisplayPath(skillFile),
      message: "Missing frontmatter start '---'.",
      level: "error",
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
      level: "error",
    });
  } else {
    if (name.length > 64) {
      issues.push({
        skillPath: toDisplayPath(skillFile),
        message: "Field 'name' exceeds 64 characters.",
        level: "error",
      });
    }
    if (!NAME_PATTERN.test(name)) {
      issues.push({
        skillPath: toDisplayPath(skillFile),
        message:
          "Field 'name' must be lowercase alphanumeric with single hyphens only.",
        level: "error",
      });
    }
    if (name !== skillName) {
      issues.push({
        skillPath: toDisplayPath(skillFile),
        message: "Field 'name' must match the parent directory name.",
        level: "error",
      });
    }
  }

  if (!description) {
    issues.push({
      skillPath: toDisplayPath(skillFile),
      message: "Missing required 'description' field in frontmatter.",
      level: parentCategory === EXTERNAL_DIR ? "warning" : "error",
    });
  } else {
    if (description.length > 1024) {
      issues.push({
        skillPath: toDisplayPath(skillFile),
        message: "Field 'description' exceeds 1024 characters.",
        level: "error",
      });
    }
  }

  if (!author) {
    issues.push({
      skillPath: toDisplayPath(skillFile),
      message: "Missing required 'metadata.author' field in frontmatter.",
      level: "error",
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
  if (install.length <= 1) {
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

const resolveCategoryFromSkillPath = (skillFile: string, categorySet: Set<string>) => {
  const skillDir = path.dirname(skillFile);
  const parentDir = path.basename(path.dirname(skillDir));
  return categorySet.has(parentDir) ? parentDir : "";
};

const ensureMetadataCategory = async (skillFile: string, categorySet: Set<string>) => {
  const category = resolveCategoryFromSkillPath(skillFile, categorySet);
  if (!category) {
    return;
  }
  const parsed = await readSkillFile(skillFile);
  if (!parsed) {
    return;
  }
  const metadata = parsed.data.metadata;
  const updatedMetadata =
    metadata && typeof metadata === "object" ? { ...metadata } : {};
  const current = (updatedMetadata as Record<string, unknown>).category;
  if (current === category) {
    return;
  }
  (updatedMetadata as Record<string, unknown>).category = category;
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
  if (owner.toLowerCase() === "anthropics") {
    return "Anthropic";
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

const hasClawdMentionInBody = async (skillFile: string) => {
  const parsed = await readSkillFile(skillFile);
  if (!parsed) {
    return false;
  }
  return /clawd/i.test(parsed.body);
};

const hasClawdbotInstallInFrontmatter = async (skillFile: string) => {
  const parsed = await readSkillFile(skillFile);
  if (!parsed) {
    return false;
  }
  const metadata = parsed.data.metadata;
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  const clawdbot = (metadata as Record<string, unknown>).clawdbot;
  if (!clawdbot || typeof clawdbot !== "object") {
    return false;
  }
  const install = (clawdbot as Record<string, unknown>).install;
  return Array.isArray(install) && install.length > 0;
};

const maybeWarnClawdWithoutNotice = async (source: ExternalSkill, skillFile: string) => {
  if (source.notice) {
    return;
  }
  if (await hasClawdMentionInBody(skillFile)) {
    const slug = resolveTargetSlug(source) || resolveSkillSlug(source);
    console.log(
      `Warning: ${slug} references "clawd" outside frontmatter without a notice in external.yml.`,
    );
  }
};

const maybeLogClawdbotInstall = async (source: ExternalSkill, skillFile: string) => {
  if (await hasClawdbotInstallInFrontmatter(skillFile)) {
    const slug = resolveTargetSlug(source) || resolveSkillSlug(source);
    console.log(`Detected metadata.clawdbot.install in ${slug}.`);
  }
};

const copySkillIntoRepo = async (source: ExternalSkill, canonicalSkillsDir: string) => {
  const canonicalSlug = resolveSkillSlug(source);
  const targetSlug = resolveTargetSlug(source);
  const canonicalPath = path.join(canonicalSkillsDir, canonicalSlug);
  const targetPath = path.join(ROOT_DIR, EXTERNAL_DIR, targetSlug);
  await mkdir(path.join(ROOT_DIR, EXTERNAL_DIR), { recursive: true });
  await rm(targetPath, { recursive: true, force: true });
  await cp(canonicalPath, targetPath, { recursive: true });
  return targetPath;
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

  const errors = allIssues.filter((issue) => issue.level === "error");
  const warnings = allIssues.filter((issue) => issue.level === "warning");
  console.log(`Detected ${allIssues.length} issue(s):`);
  for (const issue of allIssues) {
    const prefix = issue.level === "warning" ? "Warning" : "Error";
    console.log(`- ${prefix}: ${issue.skillPath}: ${issue.message}`);
  }
  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}`);
  }
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    return 1;
  }
  return 0;
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
// canonical skill into External and clean up agent dirs.
const createSyncWorkspace = async () => mkdtemp(path.join(tmpdir(), "skills-sync-"));

const readStream = async (stream: ReadableStream<Uint8Array> | null | undefined) => {
  if (!stream) {
    return "";
  }
  return new Response(stream).text();
};

const stripAnsi = (value: string) =>
  value.replace(
    /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    "",
  );

const trimFailureOutput = (output: string) => {
  const trimmed = output.trim();
  if (!trimmed) {
    return "";
  }
  const lines = trimmed.split("\n");
  const tail = lines.slice(-12);
  return tail.join("\n");
};

const runAddSkill = async (source: ExternalSkill, workdir: string) => {
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
  const proc = Bun.spawn(args, {
    cwd: workdir,
    stdin: "inherit",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
};

type SyncResult = {
  source: ExternalSkill;
  ok: boolean;
  message?: string;
};

const syncExternalSource = async (source: ExternalSkill): Promise<SyncResult> => {
  const workdir = await createSyncWorkspace();
  try {
    console.log(`Installing ${source.repository}...`);
    const { exitCode, stdout, stderr } = await runAddSkill(source, workdir);
    if (exitCode !== 0) {
      const combined = [stderr, stdout].filter(Boolean).join("\n");
      const reason = trimFailureOutput(combined);
      return {
        source,
        ok: false,
        message: reason || "Install failed.",
      };
    }

    const canonicalSkillsDir = path.join(workdir, ".agents", "skills");
    const targetSlug = resolveTargetSlug(source);
    if (!targetSlug) {
      return { source, ok: false, message: "Missing target slug." };
    }

    let targetPath: string;
    try {
      targetPath = await copySkillIntoRepo(source, canonicalSkillsDir);
    } catch {
      return { source, ok: false, message: `Unable to copy ${targetSlug} into External.` };
    }

    const skillFile = path.join(targetPath, "SKILL.md");
    const author = getRepositoryOwner(source.repository);
    if (author) {
      try {
        await ensureMetadataAuthor(skillFile, author);
      } catch {
        console.log(`Unable to set metadata.author for ${targetSlug} (${source.repository}).`);
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
      // Compatibility is optional; skip if we cannot infer.
    }
    if (source.overrides) {
      try {
        await applyFrontmatterOverrides(skillFile, source.overrides);
      } catch {
        console.log(`Unable to apply overrides for ${source.repository}.`);
      }
    }
    try {
      const slug = path.basename(path.dirname(skillFile));
      const parsed = await readSkillFile(skillFile);
      if (parsed) {
        const currentName = typeof parsed.data.name === "string" ? parsed.data.name : "";
        if (currentName && currentName !== slug) {
          const metadata =
            parsed.data.metadata && typeof parsed.data.metadata === "object"
              ? { ...(parsed.data.metadata as Record<string, unknown>) }
              : {};
          if (!("display-name" in metadata) || !metadata["display-name"]) {
            metadata["display-name"] = currentName;
          }
          parsed.data.name = slug;
          parsed.data.metadata = metadata;
          const updatedFile = serializeSkillFile(parsed.data, parsed.body);
          await writeFile(skillFile, updatedFile);
        } else if (!currentName) {
          parsed.data.name = slug;
          const updatedFile = serializeSkillFile(parsed.data, parsed.body);
          await writeFile(skillFile, updatedFile);
        }
      }
    } catch {
      console.log(`Unable to normalize name for ${source.repository}.`);
    }
    try {
      const categorySet = await getCategorySet();
      await ensureMetadataCategory(skillFile, categorySet);
    } catch {
      console.log(`Unable to set metadata.category for ${source.repository}.`);
    }
    await maybeWarnClawdWithoutNotice(source, skillFile);
    await maybeLogClawdbotInstall(source, skillFile);

    return { source, ok: true };
  } catch {
    return { source, ok: false, message: "Unexpected sync error." };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
};

const reportSyncResults = (results: SyncResult[], total: number) => {
  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    console.log(`Failed to install ${failures.length} external skill source(s).`);
    console.log("Failed slugs:");
    for (const failed of failures) {
      const slug = resolveTargetSlug(failed.source);
      console.log(`- ${slug ? `${slug} (${failed.source.repository})` : failed.source.repository}`);
      if (failed.message) {
        const lines = failed.message.split("\n");
        for (const line of lines) {
          console.log(`  ${line}`);
        }
      }
    }
    return 1;
  }
  console.log(`Installed ${total} external skill source(s).`);
  return 0;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SLUG_BLOCKLIST = new Set(["opengraph-image", "favicon", "icon", "apple-icon"]);

const extractSkillSlugs = (repository: string, text: string) => {
  const slugs = new Set<string>();
  const cleaned = stripAnsi(text);
  const headingRegex = /###\s+([a-z0-9-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(cleaned)) !== null) {
    const slug = match[1];
    if (!SLUG_BLOCKLIST.has(slug)) {
      slugs.add(slug);
    }
  }
  const repoPath = escapeRegex(repository);
  const linkRegex = new RegExp(`${repoPath}/([a-z0-9-]+)\\b`, "g");
  while ((match = linkRegex.exec(cleaned)) !== null) {
    const slug = match[1];
    if (!SLUG_BLOCKLIST.has(slug)) {
      slugs.add(slug);
    }
  }
  return Array.from(slugs);
};

const runSkillsListFromRepo = async (repository: string) => {
  const args = ["npx", "-y", "skills@1.1.0", "add", repository, "--list"];
  const proc = Bun.spawn(args, {
    cwd: ROOT_DIR,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    const combined = [stderr, stdout].filter(Boolean).join("\n");
    const reason = trimFailureOutput(combined);
    console.log(`Unable to list skills for ${repository}.`);
    if (reason) {
      console.log(reason);
    }
    return [];
  }
  return extractSkillSlugs(repository, [stdout, stderr].filter(Boolean).join("\n"));
};

const fetchSkillSlugsFromRepo = async (repository: string) => {
  const target = `https://skills.sh/${repository}`;
  let text = "";
  try {
    const response = await fetch(target);
    if (!response.ok) {
      console.log(`Unable to fetch ${target} (status ${response.status}).`);
      return await runSkillsListFromRepo(repository);
    }
    text = await response.text();
  } catch {
    console.log(`Unable to fetch ${target}.`);
    return await runSkillsListFromRepo(repository);
  }
  const slugs = extractSkillSlugs(repository, text);
  if (slugs.length === 0) {
    return await runSkillsListFromRepo(repository);
  }
  return slugs;
};

const appendExternalSkills = async (repository: string, slugs: string[]) => {
  if (slugs.length === 0) {
    console.log(`No skills found for ${repository}.`);
    return 0;
  }
  let config: string;
  try {
    config = await readFile(EXTERNAL_CONFIG, "utf8");
  } catch {
    config = "";
  }
  const existingEntries = parseExternalConfig(config);
  const existingKeys = new Set(
    existingEntries
      .filter((entry) => entry.repository === repository && entry.skill)
      .map((entry) => `${entry.repository}::${entry.skill}`),
  );
  const newLines: string[] = [];
  for (const slug of slugs) {
    const key = `${repository}::${slug}`;
    if (existingKeys.has(key)) {
      continue;
    }
    newLines.push(`- repository: ${repository}`, `  skill: ${slug}`);
  }
  if (newLines.length === 0) {
    console.log(`No new skills to add for ${repository}.`);
    return 0;
  }
  const separator = config.trimEnd() ? "\n" : "";
  const updated = `${config.trimEnd()}${separator}${newLines.join("\n")}\n`;
  await writeFile(EXTERNAL_CONFIG, updated);
  console.log(`Added ${newLines.length / 2} skill(s) from ${repository}.`);
  return 0;
};

const grabExternalSkillsFromRepo = async (repository: string) => {
  if (!repository) {
    console.log("Missing repository (example: bun grab anthropics/skills).");
    return 1;
  }
  const slugs = await fetchSkillSlugsFromRepo(repository);
  return appendExternalSkills(repository, slugs);
};

const syncExternalSkillsAll = async () => {
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

  const settled = await Promise.allSettled(sources.map((source) => syncExternalSource(source)));
  const results: SyncResult[] = settled.map((entry, index) => {
    if (entry.status === "fulfilled") {
      return entry.value;
    }
    return { source: sources[index], ok: false, message: "Sync threw an error." };
  });
  return reportSyncResults(results, sources.length);
};

const syncExternalSkillLatest = async () => {
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

  const latest = sources[0];
  const result = await syncExternalSource(latest);
  return reportSyncResults([result], 1);
};

const syncExternalSkillBySlug = async (slug: string) => {
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

  const target = sources.find((source) => resolveTargetSlug(source) === slug);
  if (!target) {
    console.log(`No external skill found with slug '${slug}'.`);
    return 1;
  }

  const result = await syncExternalSource(target);
  return reportSyncResults([result], 1);
};

const syncExternalMetadata = async () => {
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

  const categorySet = await getCategorySet();
  let updated = 0;
  let missing = 0;
  for (const source of sources) {
    const targetSlug = resolveTargetSlug(source);
    if (!targetSlug) {
      continue;
    }
    const targetPath = path.join(ROOT_DIR, EXTERNAL_DIR, targetSlug);
    if (!(await isDirectory(targetPath))) {
      missing += 1;
      continue;
    }
    const skillFile = path.join(targetPath, "SKILL.md");
    const author = getRepositoryOwner(source.repository);
    if (author) {
      try {
        await ensureMetadataAuthor(skillFile, author);
      } catch {
        console.log(`Unable to set metadata.author for ${targetSlug} (${source.repository}).`);
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
      // Compatibility is optional; skip if we cannot infer.
    }
    if (source.overrides) {
      try {
        await applyFrontmatterOverrides(skillFile, source.overrides);
      } catch {
        console.log(`Unable to apply overrides for ${source.repository}.`);
      }
    }
    try {
      await ensureMetadataCategory(skillFile, categorySet);
    } catch {
      console.log(`Unable to set metadata.category for ${source.repository}.`);
    }
    await maybeWarnClawdWithoutNotice(source, skillFile);
    await maybeLogClawdbotInstall(source, skillFile);
    updated += 1;
  }

  if (missing > 0) {
    console.log(`Skipped ${missing} skill(s) missing from the repo.`);
  }
  console.log(`Synced metadata for ${updated} skill(s).`);
  const categoryUpdates = await ensureMetadataCategoryForAllSkills();
  if (categoryUpdates > 0) {
    console.log(`Updated metadata.category for ${categoryUpdates} skill(s).`);
  }
  const nameUpdates = await ensureSkillNameSlugForAllSkills();
  if (nameUpdates > 0) {
    console.log(`Normalized name field for ${nameUpdates} skill(s).`);
  }
  return 0;
};

const syncExternalSkillsByRepository = async (repository: string) => {
  let config: string;
  try {
    config = await readFile(EXTERNAL_CONFIG, "utf8");
  } catch {
    console.log("No external.yml found. Nothing to sync.");
    return 0;
  }

  const sources = parseExternalConfig(config).filter(
    (source) => source.repository === repository,
  );
  if (sources.length === 0) {
    console.log(`No external skills found for ${repository}.`);
    return 0;
  }

  const settled = await Promise.allSettled(sources.map((source) => syncExternalSource(source)));
  const results: SyncResult[] = settled.map((entry, index) => {
    if (entry.status === "fulfilled") {
      return entry.value;
    }
    return { source: sources[index], ok: false, message: "Sync threw an error." };
  });
  return reportSyncResults(results, sources.length);
};

const main = async () => {
  const [command, subcommand] = process.argv.slice(2);
  if (!command) {
    return;
  }
  if (command === "validate") {
    const exitCode = await validateAllSkills();
    process.exitCode = exitCode;
    return;
  }
  if (command === "sync") {
    const exitCode =
      subcommand === "metadata"
        ? await syncExternalMetadata()
        : subcommand === "all"
        ? await syncExternalSkillsAll()
        : subcommand?.includes("/")
          ? await syncExternalSkillsByRepository(subcommand)
          : subcommand
            ? await syncExternalSkillBySlug(subcommand)
            : await syncExternalSkillLatest();
    process.exitCode = exitCode;
    return;
  }
  if (command === "grab") {
    const exitCode = await grabExternalSkillsFromRepo(subcommand ?? "");
    process.exitCode = exitCode;
    return;
  }
  if (command === "organize") {
    const exitCode = await organizeExternalConfig();
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