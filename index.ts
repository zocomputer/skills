import { cp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type Issue = {
  skillPath: string;
  message: string;
};

const ROOT_DIR = process.cwd();
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
    skillDirs.push(path.join(ROOT_DIR, entry.name));
  }
  return skillDirs;
};

const EXTERNAL_CONFIG = path.join(ROOT_DIR, "external.yml");

type ExternalSkill = {
  repository: string;
  skill?: string;
  notice?: string;
};

const parseExternalConfig = (content: string) => {
  const sources: ExternalSkill[] = [];
  const lines = content.split(/\r?\n/);
  let current: ExternalSkill | null = null;

  const pushCurrent = () => {
    if (current?.repository) {
      sources.push(current);
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      continue;
    }
    const repoMatch = line.match(/^\s*-\s*repository:\s*(.+)$/);
    if (repoMatch) {
      pushCurrent();
      current = { repository: repoMatch[1].trim() };
      continue;
    }
    const skillMatch = line.match(/^\s+skill:\s*(.+)$/);
    if (skillMatch && current) {
      current.skill = skillMatch[1].trim();
      continue;
    }
    const noticeMatch = line.match(/^\s+notice:\s*(.*)$/);
    if (noticeMatch && current) {
      const noticeValue = noticeMatch[1].trim();
      if (noticeValue === "|" || noticeValue === ">") {
        const baseIndent = line.match(/^\s*/)?.[0].length ?? 0;
        const noticeLines: string[] = [];
        let contentIndent: number | null = null;
        let j = i + 1;
        for (; j < lines.length; j += 1) {
          const nextLine = lines[j];
          if (nextLine.trim() === "") {
            noticeLines.push("");
            continue;
          }
          const indent = nextLine.match(/^\s*/)?.[0].length ?? 0;
          if (indent <= baseIndent) {
            break;
          }
          if (contentIndent === null) {
            contentIndent = indent;
          }
          if (indent < contentIndent) {
            break;
          }
          noticeLines.push(nextLine.slice(contentIndent));
        }
        const rawNotice =
          noticeValue === ">"
            ? noticeLines
                .map((noticeLine) => noticeLine.trim())
                .filter(Boolean)
                .join(" ")
            : noticeLines.join("\n");
        current.notice = rawNotice.trim();
        i = j - 1;
        continue;
      }
      if (noticeValue) {
        current.notice = noticeValue;
      }
      continue;
    }
  }

  pushCurrent();
  return sources;
};

const parseFrontmatter = (content: string) => {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return { frontmatter: "", body: content, issue: "Missing frontmatter start '---'." };
  }
  const endIndex = lines.slice(1).indexOf("---");
  if (endIndex === -1) {
    return { frontmatter: "", body: content, issue: "Missing frontmatter end '---'." };
  }
  const frontmatterLines = lines.slice(1, endIndex + 1);
  const body = lines.slice(endIndex + 2).join("\n");
  return {
    frontmatter: frontmatterLines.join("\n"),
    body,
    issue: null as string | null,
  };
};

const extractFrontmatterFields = (frontmatter: string) => {
  const fields: Record<string, string> = {};
  const lines = frontmatter.split(/\r?\n/);
  let currentKey: string | null = null;
  let blockType: "|" | ">" | null = null;
  let blockIndent: number | null = null;
  let blockLines: string[] = [];

  const commitBlock = () => {
    if (!currentKey) return;
    const raw = blockLines.join("\n");
    const value =
      blockType === ">"
        ? raw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .join(" ")
        : raw;
    fields[currentKey] = value.trim();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (blockType) {
      if (line.trim() === "") {
        blockLines.push("");
        continue;
      }
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (blockIndent === null) {
        blockIndent = indent;
      }
      if (indent >= blockIndent) {
        blockLines.push(line.slice(blockIndent));
        continue;
      }
      commitBlock();
      currentKey = null;
      blockType = null;
      blockIndent = null;
      blockLines = [];
    }

    if (line.trim() === "" || line.trim().startsWith("#")) {
      continue;
    }
    if (line.trim() === "metadata:") {
      let j = i + 1;
      for (; j < lines.length; j += 1) {
        const metaLine = lines[j];
        if (metaLine.trim() === "") {
          continue;
        }
        const indent = metaLine.match(/^\s*/)?.[0].length ?? 0;
        if (indent === 0) {
          break;
        }
        const metaMatch = metaLine.match(/^\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (metaMatch) {
          const [, metaKey, metaValue] = metaMatch;
          fields[`metadata.${metaKey}`] = metaValue.trim();
        }
      }
      i = j - 1;
      continue;
    }

    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    if (value === "|" || value === ">") {
      currentKey = key;
      blockType = value as "|" | ">";
      blockIndent = null;
      blockLines = [];
      continue;
    }
    fields[key] = value.trim();
  }

  if (blockType && currentKey) {
    commitBlock();
  }

  return fields;
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

  const { frontmatter, issue } = parseFrontmatter(content);
  if (issue) {
    issues.push({ skillPath: toDisplayPath(skillFile), message: issue });
    return issues;
  }

  const fields = extractFrontmatterFields(frontmatter);
  const name = fields.name ?? "";
  const description = fields.description ?? "";
  const author = fields["metadata.author"] ?? "";

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
  name: string;
  description: string;
  path: string;
};

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
    const content = await readFile(skillFile, "utf8");
    const { frontmatter, issue } = parseFrontmatter(content);
    if (issue) {
      return null;
    }
    const fields = extractFrontmatterFields(frontmatter);
    const name = fields.name ?? "";
    const description = fields.description ?? "";
    if (!name || !description) {
      return null;
    }
    return { name, description };
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
  const noticeSection = `# Notice\n\n${normalized}\n`;
  let content = await readFile(skillFile, "utf8");
  const sectionRegex = /^(# Notice[\s\S]*?)\n(?=# )/m;
  if (sectionRegex.test(content)) {
    content = content.replace(sectionRegex, `${noticeSection.trimEnd()}\n`);
  } else {
    const insertAt = content.indexOf("# ");
    if (insertAt === -1) {
      content = `${noticeSection}\n${content.trimStart()}`;
    } else {
      content = `${content.slice(0, insertAt)}${noticeSection}\n${content.slice(insertAt)}`;
    }
  }
  await writeFile(skillFile, content);
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
      slug,
      name: info.name,
      description: info.description,
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
      "--yes",
      "add-skill",
      source.repository,
      "--yes",
      "--agent",
      "codex",
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
      const repoName = source.skill ?? source.repository.split("/").pop();
      if (!repoName) {
        continue;
      }
      const canonicalPath = path.join(ROOT_DIR, ".agents", "skills", repoName);
      const targetPath = path.join(ROOT_DIR, repoName);
      try {
        await rm(targetPath, { recursive: true, force: true });
        await cp(canonicalPath, targetPath, { recursive: true });
      } catch {
        console.log(`Unable to copy ${repoName} into repo root.`);
        continue;
      }
      if (source.notice) {
        const skillFile = path.join(targetPath, "SKILL.md");
        try {
          await upsertNoticeSection(skillFile, source.notice);
        } catch {
          console.log(`Unable to insert notice for ${source.repository}.`);
        }
      }
      await rm(path.join(ROOT_DIR, ".agents"), { recursive: true, force: true });
      await rm(path.join(ROOT_DIR, ".codex"), { recursive: true, force: true });
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
    console.log("Hello world");
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