#!/usr/bin/env python3
"""zo-openclaw-backup: Backup and restore a local OpenClaw instance.

Usage:
  backup.py backup [--passphrase PASS] [--no-include-workspace] [--only-config] [--verify] [--output DIR]
  backup.py restore --archive FILE [--passphrase PASS] --list-only
  backup.py restore --archive FILE [--passphrase PASS] --extract-to DIR
  backup.py verify --archive FILE [--passphrase PASS]
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

WORKSPACE = Path("/home/workspace")
DEFAULT_OUTPUT_DIR = WORKSPACE


def check_openclaw():
    try:
        result = subprocess.run(
            ["openclaw", "--version"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            version = result.stdout.strip() or result.stderr.strip()
            print(f"OpenClaw found: {version}")
            return True
    except FileNotFoundError:
        pass
    except subprocess.TimeoutExpired:
        pass
    print("ERROR: openclaw not found on PATH. Install from https://docs.openclaw.ai/install", file=sys.stderr)
    return False


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


def is_encrypted(archive_path: str) -> bool:
    return archive_path.endswith(".enc")


def resolve_archive(archive_path: str, passphrase: str = None, tmpdir: str = None):
    """If archive is encrypted, decrypt to tmpdir and return path to .tar.gz. Otherwise return as-is."""
    if is_encrypted(archive_path):
        if not passphrase:
            print("ERROR: Encrypted archive requires --passphrase", file=sys.stderr)
            sys.exit(1)
        decrypted = os.path.join(tmpdir, "openclaw-backup.tar.gz")
        print("Decrypting archive...")
        decrypt_file(archive_path, decrypted, passphrase)
        return decrypted
    return archive_path


def cmd_backup(args):
    if not check_openclaw():
        sys.exit(1)

    output_dir = args.output or str(DEFAULT_OUTPUT_DIR)
    os.makedirs(output_dir, exist_ok=True)

    cmd = ["openclaw", "backup", "create", "--output", output_dir]

    if args.no_include_workspace:
        cmd.append("--no-include-workspace")
    if args.only_config:
        cmd.append("--only-config")
    if args.verify:
        cmd.append("--verify")

    if args.dry_run:
        cmd.extend(["--dry-run", "--json"])
        print(f"Dry run: {' '.join(cmd)}")

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if result.returncode != 0:
        print(f"ERROR: openclaw backup create failed (exit {result.returncode})", file=sys.stderr)
        sys.exit(1)

    # Find the created archive — openclaw writes a timestamped .tar.gz
    tar_path = None
    for line in (result.stdout + result.stderr).splitlines():
        line = line.strip()
        if line.endswith(".tar.gz") and os.path.isfile(line):
            tar_path = line
            break

    if not tar_path:
        # Fallback: find the most recent .tar.gz in output_dir
        candidates = sorted(
            Path(output_dir).glob("*-openclaw-backup.tar.gz"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if candidates:
            tar_path = str(candidates[0])

    if not tar_path or not os.path.isfile(tar_path):
        print("ERROR: Could not locate the created backup archive.", file=sys.stderr)
        print("Check the output above for the archive path.", file=sys.stderr)
        sys.exit(1)

    tar_size = os.path.getsize(tar_path)
    print(f"\nBackup archive: {tar_path}")
    print(f"Archive size: {tar_size / 1024 / 1024:.1f} MB")

    # Encrypt if passphrase provided
    if args.passphrase:
        enc_path = tar_path + ".enc"
        print(f"Encrypting with AES-256-CBC (PBKDF2, 600k iterations)...")
        encrypt_file(tar_path, enc_path, args.passphrase)

        enc_size = os.path.getsize(enc_path)
        os.remove(tar_path)
        print(f"Encrypted backup: {enc_path}")
        print(f"Encrypted size: {enc_size / 1024 / 1024:.1f} MB")
        print(f"(Unencrypted archive removed)")
        return enc_path
    else:
        print("\nNote: Backup is NOT encrypted. Use --passphrase to encrypt.")
        return tar_path


def cmd_restore_list(args):
    with tempfile.TemporaryDirectory(prefix="oc-restore-") as tmpdir:
        tar_path = resolve_archive(args.archive, args.passphrase, tmpdir)

        print(f"\nArchive contents:")
        result = subprocess.run(
            ["tar", "tzf", tar_path],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"ERROR: Failed to list archive: {result.stderr.strip()}", file=sys.stderr)
            sys.exit(1)

        entries = result.stdout.strip().splitlines()
        dirs = set()
        files = []
        total = 0
        for entry in entries:
            if entry.endswith("/"):
                dirs.add(entry)
            else:
                files.append(entry)
                total += 1

        # Group by top-level directory
        groups = {}
        for f in files:
            parts = f.split("/", 1)
            top = parts[0] if len(parts) > 1 else "(root)"
            groups.setdefault(top, []).append(f)

        print(f"{'=' * 50}")
        print(f"Total entries: {total} files in {len(dirs)} directories")
        print(f"{'=' * 50}")

        for group, items in sorted(groups.items()):
            print(f"\n[{group}] — {len(items)} files")
            for item in items[:20]:
                print(f"  {item}")
            if len(items) > 20:
                print(f"  ... and {len(items) - 20} more")

        # Check for manifest
        if "manifest.json" in files:
            print("\n✓ manifest.json found in archive")


def cmd_restore_extract(args):
    extract_to = args.extract_to
    os.makedirs(extract_to, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="oc-restore-") as tmpdir:
        tar_path = resolve_archive(args.archive, args.passphrase, tmpdir)

        print(f"Extracting to {extract_to}...")
        result = subprocess.run(
            ["tar", "xzf", tar_path, "-C", extract_to],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"ERROR: Extraction failed: {result.stderr.strip()}", file=sys.stderr)
            sys.exit(1)

    print(f"Extraction complete: {extract_to}")

    # Show what was extracted
    for item in sorted(Path(extract_to).iterdir()):
        if item.is_dir():
            count = sum(1 for _ in item.rglob("*") if _.is_file())
            print(f"  {item.name}/ — {count} files")
        else:
            print(f"  {item.name} — {item.stat().st_size:,} bytes")


def cmd_verify(args):
    with tempfile.TemporaryDirectory(prefix="oc-verify-") as tmpdir:
        tar_path = resolve_archive(args.archive, args.passphrase, tmpdir)

        # Use openclaw's built-in verify if available
        if check_openclaw():
            print(f"Running openclaw backup verify...")
            result = subprocess.run(
                ["openclaw", "backup", "verify", tar_path],
                capture_output=True, text=True,
            )
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(result.stderr, file=sys.stderr)
            if result.returncode == 0:
                print("✓ Archive verification passed")
            else:
                print("✗ Archive verification failed", file=sys.stderr)
                sys.exit(1)
        else:
            # Fallback: basic tar integrity check
            print("OpenClaw not available, running basic tar integrity check...")
            result = subprocess.run(
                ["tar", "tzf", tar_path],
                capture_output=True, text=True,
            )
            if result.returncode == 0:
                count = len(result.stdout.strip().splitlines())
                print(f"✓ Archive is valid ({count} entries)")
            else:
                print(f"✗ Archive is corrupt: {result.stderr.strip()}", file=sys.stderr)
                sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Zo OpenClaw Backup — backup and restore your OpenClaw instance"
    )
    sub = parser.add_subparsers(dest="command")

    bp = sub.add_parser("backup", help="Create a backup of your OpenClaw instance")
    bp.add_argument("--passphrase", help="Encrypt the backup with this passphrase (AES-256-CBC)")
    bp.add_argument("--no-include-workspace", action="store_true", help="Skip workspace directories")
    bp.add_argument("--only-config", action="store_true", help="Back up only the config file")
    bp.add_argument("--verify", action="store_true", help="Verify the archive after creation")
    bp.add_argument("--dry-run", action="store_true", help="Show what would be backed up without creating")
    bp.add_argument("--output", help="Output directory (default: /home/workspace/)")

    rp = sub.add_parser("restore", help="Restore from a backup archive")
    rp.add_argument("--archive", required=True, help="Path to .tar.gz or .tar.gz.enc backup file")
    rp.add_argument("--passphrase", help="Passphrase for encrypted archives")
    rp.add_argument("--list-only", action="store_true", help="List archive contents without extracting")
    rp.add_argument("--extract-to", help="Extract archive to this directory")

    vp = sub.add_parser("verify", help="Verify a backup archive")
    vp.add_argument("--archive", required=True, help="Path to .tar.gz or .tar.gz.enc backup file")
    vp.add_argument("--passphrase", help="Passphrase for encrypted archives")

    args = parser.parse_args()

    if args.command == "backup":
        cmd_backup(args)
    elif args.command == "restore":
        if args.list_only:
            cmd_restore_list(args)
        elif args.extract_to:
            cmd_restore_extract(args)
        else:
            print("Specify --list-only or --extract-to DIR", file=sys.stderr)
            sys.exit(1)
    elif args.command == "verify":
        cmd_verify(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
