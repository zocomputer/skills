#!/usr/bin/env python3
"""zo-local-backup: Backup and restore your Zo Computer to an encrypted archive.

Usage:
  backup.py backup --passphrase PASS [--config-dir DIR] [--output FILE]
  backup.py restore --passphrase PASS --archive FILE --list-only
  backup.py restore --passphrase PASS --archive FILE --extract-to DIR
  backup.py restore --passphrase PASS --archive FILE --extract-to DIR --diff
  backup.py restore --passphrase PASS --archive FILE --prepare-assets DIR
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

WORKSPACE = Path("/home/workspace")
SPACE_API_BASE = "http://localhost:3099"

EXCLUDE_DIRS = {
    "node_modules", ".git", "Trash", "__pycache__", ".cache",
    ".next", ".nuxt", ".venv", "venv", ".trunk", ".tox",
    "bower_components", ".parcel-cache", ".turbo",
}

EXCLUDE_FILES = {".DS_Store", "Thumbs.db"}

EXCLUDE_EXTENSIONS = {".pyc", ".pyo"}

EXCLUDE_PATTERNS = {"zo-backup-*.enc"}

MAX_FILE_SIZE = 100 * 1024 * 1024  # skip files > 100 MB


def should_exclude(path: Path) -> bool:
    parts = path.relative_to(WORKSPACE).parts
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    if path.name in EXCLUDE_FILES:
        return True
    if path.suffix in EXCLUDE_EXTENSIONS:
        return True
    if path.name.startswith("zo-backup-") and path.name.endswith(".enc"):
        return True
    try:
        if path.is_symlink():
            return True
        if path.stat().st_size > MAX_FILE_SIZE:
            return True
    except OSError:
        return True
    return False


def collect_workspace_files():
    for root, dirs, files in os.walk(WORKSPACE):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS)
        for f in sorted(files):
            fp = Path(root) / f
            if not should_exclude(fp):
                yield fp


def create_backup_zip(zip_path: str, config_dir: str = None):
    count = 0
    total_size = 0

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        print("Collecting workspace files...")
        for fp in collect_workspace_files():
            try:
                rel = fp.relative_to(WORKSPACE)
                arcname = f"workspace/{rel}"
                zf.write(fp, arcname)
                fsize = fp.stat().st_size
                count += 1
                total_size += fsize
                if count % 1000 == 0:
                    print(f"  {count} files ({total_size / 1024 / 1024:.1f} MB)...")
            except (OSError, PermissionError) as e:
                print(f"  Warning: skipping {fp}: {e}", file=sys.stderr)

        if config_dir and Path(config_dir).exists():
            print("Adding Zo configurations...")
            for fp in sorted(Path(config_dir).rglob("*")):
                if fp.is_file():
                    arcname = f"zo-config/{fp.relative_to(config_dir)}"
                    zf.write(fp, arcname)

        manifest = {
            "version": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "file_count": count,
            "total_size_bytes": total_size,
            "excludes": sorted(EXCLUDE_DIRS),
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

    print(f"Zip created: {count} files, {total_size / 1024 / 1024:.1f} MB uncompressed")
    return count, total_size


def encrypt_file(input_path: str, output_path: str, passphrase: str):
    result = subprocess.run(
        [
            "openssl", "enc", "-aes-256-cbc", "-salt", "-pbkdf2",
            "-iter", "600000", "-in", input_path, "-out", output_path,
            "-pass", f"pass:{passphrase}",
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Encryption failed: {result.stderr.strip()}")


def decrypt_file(input_path: str, output_path: str, passphrase: str):
    result = subprocess.run(
        [
            "openssl", "enc", "-d", "-aes-256-cbc", "-salt", "-pbkdf2",
            "-iter", "600000", "-in", input_path, "-out", output_path,
            "-pass", f"pass:{passphrase}",
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Decryption failed (wrong passphrase?): {result.stderr.strip()}")


def cmd_backup(args):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    output = args.output or str(WORKSPACE / f"zo-backup-{timestamp}.enc")

    with tempfile.TemporaryDirectory(prefix="zo-backup-") as tmpdir:
        zip_path = os.path.join(tmpdir, "backup.zip")
        create_backup_zip(zip_path, args.config_dir)

        zip_size = os.path.getsize(zip_path)
        print(f"Compressed zip size: {zip_size / 1024 / 1024:.1f} MB")
        print("Encrypting with AES-256-CBC (PBKDF2, 600k iterations)...")

        encrypt_file(zip_path, output, args.passphrase)
        enc_size = os.path.getsize(output)

    print(f"\nBackup complete: {output}")
    print(f"Encrypted size: {enc_size / 1024 / 1024:.1f} MB")
    return output


def cmd_restore_list(args):
    with tempfile.TemporaryDirectory(prefix="zo-restore-") as tmpdir:
        zip_path = os.path.join(tmpdir, "backup.zip")
        print("Decrypting...")
        decrypt_file(args.archive, zip_path, args.passphrase)

        with zipfile.ZipFile(zip_path, "r") as zf:
            try:
                manifest = json.loads(zf.read("manifest.json"))
                print(f"\n{'='*50}")
                print(f"Backup created: {manifest.get('created_at', 'unknown')}")
                print(f"Version: {manifest.get('version', '?')}")
                print(f"Files: {manifest.get('file_count', '?')}")
                print(f"Original size: {manifest.get('total_size_bytes', 0) / 1024 / 1024:.1f} MB")
                print(f"{'='*50}")
            except KeyError:
                pass

            categories = {}
            for info in zf.infolist():
                if info.filename == "manifest.json":
                    continue
                cat = info.filename.split("/")[0]
                categories.setdefault(cat, []).append(info)

            for cat, items in sorted(categories.items()):
                total_cat_size = sum(i.file_size for i in items)
                print(f"\n[{cat}] — {len(items)} items, {total_cat_size / 1024 / 1024:.1f} MB")
                for item in items[:30]:
                    display = "/".join(item.filename.split("/")[1:])
                    print(f"  {display} ({item.file_size:,} bytes)")
                if len(items) > 30:
                    print(f"  ... and {len(items) - 30} more")


def cmd_restore_extract(args):
    extract_to = args.extract_to
    os.makedirs(extract_to, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="zo-restore-") as tmpdir:
        zip_path = os.path.join(tmpdir, "backup.zip")
        print("Decrypting...")
        decrypt_file(args.archive, zip_path, args.passphrase)

        print(f"Extracting to {extract_to}...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_to)

    print("Extraction complete.")


def cmd_restore_diff(args):
    extract_to = args.extract_to
    source = Path(extract_to) / "workspace"
    if not source.exists():
        print("ERROR: No workspace directory found. Run with --extract-to first.", file=sys.stderr)
        sys.exit(1)

    conflicts = []
    new_files = []
    unchanged = 0

    for fp in sorted(source.rglob("*")):
        if not fp.is_file():
            continue
        rel = fp.relative_to(source)
        dest = WORKSPACE / rel

        if dest.exists():
            try:
                if fp.read_bytes() == dest.read_bytes():
                    unchanged += 1
                else:
                    conflicts.append(str(rel))
            except OSError:
                conflicts.append(str(rel))
        else:
            new_files.append(str(rel))

    zo_config = Path(extract_to) / "zo-config"
    config_items = {}
    if zo_config.exists():
        for fp in sorted(zo_config.rglob("*.json")):
            name = fp.stem
            try:
                data = json.loads(fp.read_text())
                if isinstance(data, list):
                    config_items[name] = len(data)
                elif isinstance(data, dict):
                    config_items[name] = len(data.get("items", data.get("data", [data])))
                else:
                    config_items[name] = 1
            except (json.JSONDecodeError, OSError):
                config_items[name] = "?"

    result = {
        "workspace": {
            "new_files": len(new_files),
            "conflicts": len(conflicts),
            "unchanged": unchanged,
            "conflict_list": conflicts[:100],
            "new_file_list": new_files[:100],
            "has_more_conflicts": len(conflicts) > 100,
            "has_more_new_files": len(new_files) > 100,
        },
        "zo_config": config_items,
    }
    print(json.dumps(result, indent=2))


def copy_new_files(extract_to: str):
    source = Path(extract_to) / "workspace"
    if not source.exists():
        return
    copied = 0
    for fp in sorted(source.rglob("*")):
        if not fp.is_file():
            continue
        rel = fp.relative_to(source)
        dest = WORKSPACE / rel
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(fp.read_bytes())
            copied += 1
    print(f"Copied {copied} new files.")


def copy_specific_files(extract_to: str, file_list_json: str):
    source = Path(extract_to) / "workspace"
    files = json.loads(file_list_json)
    copied = 0
    for rel_str in files:
        src = source / rel_str
        dest = WORKSPACE / rel_str
        if src.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(src.read_bytes())
            copied += 1
    print(f"Overwrote {copied} files.")


def cmd_restore_assets(args):
    """Generate JSON of asset upload commands (helper for efficient restore)."""
    extract_to = args.extract_to
    asset_files_dir = Path(extract_to) / "zo-config" / "asset-files"
    assets_file = Path(extract_to) / "zo-config" / "assets.json"
    
    if not assets_file.exists():
        print(f"ERROR: {assets_file} not found", file=sys.stderr)
        sys.exit(1)
    
    with open(assets_file) as f:
        assets = json.load(f)
    
    # Get list of files that exist locally
    existing_files = set()
    if asset_files_dir.exists():
        for fp in asset_files_dir.rglob("*"):
            if fp.is_file():
                rel = fp.relative_to(asset_files_dir)
                existing_files.add("/" + str(rel).replace(os.sep, "/"))
    
    # Generate tool calls
    calls = []
    for a in assets:
        asset_path = a.get("path", a.get("asset_path", ""))
        if asset_path in existing_files:
            rel_path = asset_path.lstrip("/")
            local_file = str(asset_files_dir / rel_path)
            calls.append({
                "tool": "update_space_asset",
                "params": {
                    "source_file": local_file,
                    "asset_path": asset_path
                }
            })
    
    output = json.dumps(calls, indent=2)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"Generated {len(calls)} asset upload commands → {args.output}")
    else:
        print(output)
    
    return len(calls)


def main():
    parser = argparse.ArgumentParser(
        description="Zo Local Backup — backup and restore your Zo Computer"
    )
    sub = parser.add_subparsers(dest="command")

    bp = sub.add_parser("backup", help="Create an encrypted backup")
    bp.add_argument("--passphrase", required=True)
    bp.add_argument("--config-dir", help="Directory containing exported zo config JSONs")
    bp.add_argument("--output", help="Output file path (default: workspace/zo-backup-DATE.enc)")

    rp = sub.add_parser("restore", help="Restore from an encrypted backup")
    rp.add_argument("--passphrase", required=True)
    rp.add_argument("--archive", required=True, help="Path to .enc backup file")
    rp.add_argument("--list-only", action="store_true", help="List backup contents without extracting")
    rp.add_argument("--extract-to", help="Extract backup to this directory")
    rp.add_argument("--diff", action="store_true", help="Show merge analysis (requires prior --extract-to)")
    rp.add_argument("--copy-new", action="store_true", help="Copy only new files (no conflicts)")
    rp.add_argument("--copy-files", help="JSON array of relative paths to overwrite")
    rp.add_argument("--prepare-assets", metavar="DIR", help="Generate JSON of asset upload commands (helper for efficient restore)")
    rp.add_argument("--output", "-o", help="Output file for --prepare-assets")

    args = parser.parse_args()

    if args.command == "backup":
        cmd_backup(args)
    elif args.command == "restore":
        if args.list_only:
            cmd_restore_list(args)
        elif args.copy_new:
            if not args.extract_to:
                print("--extract-to required with --copy-new", file=sys.stderr)
                sys.exit(1)
            copy_new_files(args.extract_to)
        elif args.copy_files:
            if not args.extract_to:
                print("--extract-to required with --copy-files", file=sys.stderr)
                sys.exit(1)
            copy_specific_files(args.extract_to, args.copy_files)
        elif args.diff:
            if not args.extract_to:
                print("--extract-to required with --diff", file=sys.stderr)
                sys.exit(1)
            cmd_restore_diff(args)
        elif args.prepare_assets:
            args.extract_to = args.prepare_assets
            cmd_restore_assets(args)
        elif args.extract_to:
            cmd_restore_extract(args)
        else:
            print("Specify --list-only, --extract-to DIR, --diff, --copy-new, or --copy-files", file=sys.stderr)
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
