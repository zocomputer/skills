import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type Issue = {
  skillPath: string;
  message: string;
};

const ROOT_DIR = process.cwd();
const SKILL_COLLECTIONS = ["Official", "Community"];
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
  for (const collection of SKILL_COLLECTIONS) {
    const collectionPath = path.join(ROOT_DIR, collection);
    if (!(await isDirectory(collectionPath))) {
      continue;
    }
    const entries = await readdir(collectionPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      skillDirs.push(path.join(collectionPath, entry.name));
    }
  }
  return skillDirs;
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

const validateAllSkills = async () => {
  const skillDirs = await loadSkillDirectories();
  if (skillDirs.length === 0) {
    console.log("No skills found under Official/ or Community/.");
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

  console.log(`Unknown command: ${command}`);
  process.exitCode = 1;
};

await main();