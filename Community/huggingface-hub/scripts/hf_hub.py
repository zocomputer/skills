#!/usr/bin/env /usr/local/bin/python3
"""Hugging Face Hub CLI tool. Usage: python3 hf_hub.py <command> [options]"""

import argparse
import os
import sys
from pathlib import Path

try:
    from huggingface_hub import (
        HfApi, hf_hub_download,
        list_models, list_datasets, list_spaces,
        model_info, dataset_info,
    )
except ImportError:
    sys.stderr.write("ERROR: huggingface_hub not installed. Run: pip install huggingface_hub\n")
    sys.exit(1)


def get_token() -> str:
    token = os.environ.get("HF_TOKEN", "")
    if not token:
        try:
            with open("/etc/secrets/HF_TOKEN", "r") as f:
                token = f.read().strip()
        except Exception:
            pass
    return token


def get_api() -> HfApi:
    token = get_token()
    return HfApi(token=token if token else None)


def cmd_whoami(args):
    api = get_api()
    info = api.whoami()
    print(f"Username: {info['name']}")
    print(f"Full name: {info.get('fullname', 'N/A')}")
    print(f"Email: {info.get('email', 'N/A')}")
    print(f"Organizations: {', '.join(info.get('orgs', []))}")


def cmd_list_models(args):
    kwargs = {"sort": args.sort, "direction": args.direction, "limit": args.limit}
    if args.search:
        kwargs["search"] = args.search
    kwargs = {k: v for k, v in kwargs.items() if v is not None}
    for m in list_models(**kwargs):
        print(f"{m.id}  likes={m.likes}")


def cmd_list_datasets(args):
    kwargs = {"sort": args.sort, "direction": args.direction, "limit": args.limit}
    if args.search:
        kwargs["search"] = args.search
    kwargs = {k: v for k, v in kwargs.items() if v is not None}
    for d in list_datasets(**kwargs):
        print(f"{d.id}  likes={d.likes}")


def cmd_list_spaces(args):
    kwargs = {"sort": args.sort, "direction": args.direction, "limit": args.limit}
    if args.search:
        kwargs["search"] = args.search
    kwargs = {k: v for k, v in kwargs.items() if v is not None}
    for s in list_spaces(**kwargs):
        print(f"{s.id}  likes={s.likes}")


def cmd_model_info(args):
    info = model_info(args.model)
    print(f"Model ID: {info.id}")
    print(f"Downloads: {getattr(info, 'downloads', 'N/A')}")
    print(f"Likes: {info.likes}")
    print(f"Tags: {', '.join(info.tags)}")
    print(f"Pipeline tag: {getattr(info, 'pipeline_tag', 'N/A')}")
    print(f"Created at: {info.created_at}")
    print(f"Last modified: {info.last_modified}")


def cmd_dataset_info(args):
    info = dataset_info(args.dataset)
    print(f"Dataset ID: {info.id}")
    print(f"Downloads: {getattr(info, 'downloads', 'N/A')}")
    print(f"Likes: {info.likes}")
    print(f"Tags: {', '.join(info.tags)}")
    print(f"Created at: {info.created_at}")
    print(f"Last modified: {info.last_modified}")


def cmd_download_file(args):
    path = hf_hub_download(
        repo_id=args.repo_id,
        filename=args.filename,
        revision=args.revision or "main",
        token=get_token() or None,
    )
    print(path)


def cmd_upload_file(args):
    api = get_api()
    api.upload_file(
        path_or_fileobj=args.local_path,
        path_in_repo=args.path_in_repo or Path(args.local_path).name,
        repo_id=args.repo_id,
        repo_type=args.repo_type or "model",
        token=get_token() or None,
    )
    print(f"Uploaded {args.local_path} to {args.repo_id}/{args.path_in_repo}")


def build_parser():
    parser = argparse.ArgumentParser(description="Hugging Face Hub CLI")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("whoami", help="Show authenticated user info")
    p = sub.add_parser("list-models", help="List models")
    p.add_argument("--search")
    p.add_argument("--sort", default=None)
    p.add_argument("--direction", default=None)
    p.add_argument("--limit", type=int, default=20)
    p = sub.add_parser("list-datasets", help="List datasets")
    p.add_argument("--search")
    p.add_argument("--sort", default=None)
    p.add_argument("--direction", default=None)
    p.add_argument("--limit", type=int, default=20)
    p = sub.add_parser("list-spaces", help="List spaces")
    p.add_argument("--search")
    p.add_argument("--sort", default=None)
    p.add_argument("--direction", default=None)
    p.add_argument("--limit", type=int, default=20)
    p = sub.add_parser("model-info", help="Get model info")
    p.add_argument("--model", required=True)
    p = sub.add_parser("dataset-info", help="Get dataset info")
    p.add_argument("--dataset", required=True)
    p = sub.add_parser("download-file", help="Download a file from a repo")
    p.add_argument("--repo-id", required=True)
    p.add_argument("--filename", required=True)
    p.add_argument("--revision", default=None)
    p = sub.add_parser("upload-file", help="Upload a file")
    p.add_argument("--local-path", required=True)
    p.add_argument("--repo-id", required=True)
    p.add_argument("--repo-type", default="model")
    p.add_argument("--path-in-repo", default=None)
    return parser


COMMANDS = {
    "whoami": cmd_whoami,
    "list-models": cmd_list_models,
    "list-datasets": cmd_list_datasets,
    "list-spaces": cmd_list_spaces,
    "model-info": cmd_model_info,
    "dataset-info": cmd_dataset_info,
    "download-file": cmd_download_file,
    "upload-file": cmd_upload_file,
}


if __name__ == "__main__":
    parser = build_parser()
    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        sys.exit(1)
    COMMANDS[args.command](args)
