# Zo Skills 

Agent Skills Registry for [Zo Computer](https://zo.computer)

## Validation

Run `bun validate`. Must pass in order to commit skills.

## Clawdhub Sync

Add skills to `clawdhub.yml` (one slug per line), then run:

```bash
bun sync
```

This installs each skill into a top-level folder in the repo.

## Manifest

Generate `manifest.json` with each skill's name, description, and raw GitHub URL:

```bash
bun manifest
```
