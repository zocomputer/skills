

"""Shared helpers for sec-edgar scripts.

Provides: checksums, atomic writes, token counting, file utilities.
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import errno
import fcntl
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any


# ── Token counting ────────────────────────────────────────────────────────────

def count_tokens(text: str, model: str | None = None) -> int:
    """Approximate token count for a string.

    Uses a simple word-boundary estimator tuned for SEC filing text.
    For more accurate counts, pass a model name and call an LLM API.
    """
    if not text:
        return 0
    words = text.split()
    # Rough heuristic: ~4 chars per token on average for financial English
    # Add 2 tokens overhead per chunk boundary
    return max(1, len(words) * 3 // 2)


# ── Checksums ─────────────────────────────────────────────────────────────────

def sha256_path(path: Path) -> str:
    """Return sha256 hexdigest of a file."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_str(data: str) -> str:
    """Return sha256 hexdigest of a string."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


# ── Atomic writes ─────────────────────────────────────────────────────────────

def atomic_write_json(path: Path, data: dict, indent: int = 2) -> None:
    """Write JSON atomically: write to temp file, then rename.

    Use this for all manifest and config writes to avoid partial writes
    on crash. Includes a pre-flight flush to flush_parent_dirs.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=indent, ensure_ascii=False), encoding="utf-8")
    _flush_parent_dirs(tmp)
    os.replace(str(tmp), str(path))


def atomic_write_text(path: Path, content: str) -> None:
    """Write text atomically."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(content, encoding="utf-8")
    _flush_parent_dirs(tmp)
    os.replace(str(tmp), str(path))


def _flush_parent_dirs(path: Path) -> None:
    """Flush parent directories of a path to reduce risk of data loss."""
    try:
        for parent in path.parents:
            fd = os.open(str(parent), os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
    except OSError:
        pass


# ── File locking ───────────────────────────────────────────────────────────────

class FileLock:
    """Context manager for exclusive file locking using fcntl.flock.

    Usage:
        with FileLock(path) as acquired:
            if acquired:
                # do exclusive work
            else:
                # could not acquire lock
    """

    def __init__(self, path: Path | str, nonblock: bool = False):
        self.path = Path(path) if isinstance(path, str) else path
        self.nonblock = nonblock
        self.fd: int | None = None
        self.acquired = False

    def __enter__(self) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch()
        self.fd = os.open(str(self.path), os.O_RDWR)
        op = fcntl.LOCK_EX | (fcntl.LOCK_NB if self.nonblock else 0)
        try:
            fcntl.flock(self.fd, op)
            self.acquired = True
        except OSError:
            os.close(self.fd)
            self.fd = None
            self.acquired = False
        return self.acquired

    def __exit__(self, *args: Any) -> None:
        if self.fd is not None:
            try:
                fcntl.flock(self.fd, fcntl.LOCK_UN)
                os.close(self.fd)
            except OSError:
                pass
            self.fd = None


# ── Safe JSON read ─────────────────────────────────────────────────────────────

def read_json(path: Path) -> dict:
    """Read JSON from a file. Returns empty dict on file-not-found."""
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


# ── Misc utils ─────────────────────────────────────────────────────────────────

def ensure_dir(path: Path) -> None:
    """Ensure a directory exists, creating it if necessary."""
    path.mkdir(parents=True, exist_ok=True)


def file_size_mb(path: Path) -> float:
    """Return file size in MB."""
    return path.stat().st_size / (1024 * 1024)


def dir_size_mb(path: Path) -> float:
    """Return total size of a directory tree in MB."""
    total = 0
    for entry in path.rglob("*"):
        if entry.is_file():
            total += entry.stat().st_size
    return total / (1024 * 1024)


def ensure_sec_dir() -> Path:
    """Ensure the global sec/ directory exists."""
    path = Path("/home/workspace/sec")
    ensure_dir(path)
    return path


def now_iso() -> str:
    """Return current UTC time as ISO-8601 string."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
