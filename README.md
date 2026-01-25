# Zo Skills 

Agent Skills Registry for [Zo Computer](https://zo.computer)

# Usage

Inside Zo, you can browse the skills in this registry and install them.

## Manual skill installation command

Choose a skill by slug (directory name), then run:

```bash
slug="bird"; dest="Skills"; manifest_url="https://raw.githubusercontent.com/zocomputer/skills/main/manifest.json"; mkdir -p "$dest" && tarball_url="$(curl -fsSL "$manifest_url" | jq -r '.tarball_url')" && archive_root="$(curl -fsSL "$manifest_url" | jq -r '.archive_root')" && curl -L "$tarball_url" | tar -xz -C "$dest" --strip-components=1 "$archive_root/$slug"
```

> Gets repo tarball in temp dir, extracts the skill directory. `archive_root` is the tarball root folder created by GitHub: `<repo>-<branch>`.

# Contributing

## Structure

`bun validate` to ensure all skills follow this structure:

- Each skill is a top-level directory with a required `SKILL.md`.
- Allowed subdirectories: `assets/`, `references/`, `scripts/`.
- `SKILL.md` frontmatter must include `name`, `description`, and `metadata.author`.

## External Skills

- External skills are defined in `external.yml` and pulled from [skills.sh](https://skills.sh/docs/cli)
- Add a `notice` field (optional) to prefix SKILL.md with Zo-specific instructions
- Run `bun sync` to sync and build external skills

## Manifest

- A `manifest.json` lists all the skills along with installation metadata
- Run `bun manifest` to generate the manifest

