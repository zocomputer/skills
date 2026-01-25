# Zo Skills 

Agent Skills Registry for [Zo Computer](https://zo.computer)

## Structure

- Each skill is a top-level directory with a required `SKILL.md`.
- Allowed subdirectories: `assets/`, `references/`, `scripts/`.
- `SKILL.md` frontmatter must include `name`, `description`, and `metadata.author`.

## Validation

Run `bun validate`. Must pass in order to commit skills.

## External Sync

Add external skill sources to `external.yml` (list of objects with a `repository`, optional `skill`, and optional multiline `notice`), then run:

```bash
bun sync
```

This installs skills using the canonical `npx add-skill` flow (invoked via `skills`). See the CLI docs at [skills.sh](https://skills.sh/docs/cli).

If `skill` is provided, it is passed as `--skill` to the CLI. If `notice` is provided, it is inserted at the top of the skill as a `# Notice` section. Sync runs non-interactively and copies installed skills into the repo root.

## Manifest

Generate `manifest.json` with each skill's name, description, and relative path, plus a top-level tarball URL:

```bash
bun manifest
```

The manifest includes a top-level `tarball_url` plus each skill's `path` (directory name). Clients can install a skill by extracting just that directory from the tarball:

```bash
slug="bird"; dest="Skills"; manifest_url="https://raw.githubusercontent.com/zocomputer/skills/main/manifest.json"; mkdir -p "$dest" && tarball_url="$(curl -fsSL "$manifest_url" | jq -r '.tarball_url')" && archive_root="$(curl -fsSL "$manifest_url" | jq -r '.archive_root')" && curl -L "$tarball_url" | tar -xz -C "$dest" --strip-components=1 "$archive_root/$slug"
```

Notes:
- The tarball URL downloads the entire repository archive. The `tar` command extracts only the requested skill directory.
- `archive_root` is the tarball root folder created by GitHub: `<repo>-<branch>`.
