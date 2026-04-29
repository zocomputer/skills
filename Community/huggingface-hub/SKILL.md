---
name: huggingface-hub
description: Access Hugging Face Hub models, datasets, and spaces via the huggingface_hub Python library. Use when you need to list, search, download, or upload HF assets.
compatibility: Created for Zo Computer
metadata:
  author: jaknyfe.zo.computer
---

# Hugging Face Hub Skill

Interact with Hugging Face Hub — browse models/datasets/spaces, download files, upload artifacts, and more.

## Prerequisites

Install the library:
```bash
pip install huggingface_hub
```

Save your HF token to [Settings > Advanced](/?t=settings&s=advanced) as `HF_TOKEN` (get one at https://huggingface.co/settings/tokens).

## Usage

```bash
python3 /home/workspace/Skills/huggingface-hub/scripts/hf_hub.py <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `list-models` | List models. Options: `--search`, `--sort`, `--direction`, `--limit` |
| `list-datasets` | List datasets. Options: `--search`, `--sort`, `--direction`, `--limit` |
| `list-spaces` | List spaces. Options: `--search`, `--sort`, `--direction`, `--limit` |
| `model-info` | Get model info. Options: `--model` |
| `dataset-info` | Get dataset info. Options: `--dataset` |
| `download-file` | Download a file from a repo. Options: `--repo-id`, `--filename`, `--revision` |
| `upload-file` | Upload a file. Options: `--local-path`, `--repo-id`, `--repo-type`, `--path-in-repo` |
| `whoami` | Show authenticated user info |

### Examples

```bash
# Search for text-to-image models
python3 .../hf_hub.py list-models --search "text-to-image" --limit 10

# Download a model file
python3 .../hf_hub.py download-file --repo-id "stabilityai/stable-diffusion-xl-base-1.0" --filename "pytorch_model.bin"

# Upload a file
python3 .../hf_hub.py upload-file --local-path ./model.pt --repo-id "your-username/my-model" --repo-type "model"

# List top-rated datasets
python3 .../hf_hub.py list-datasets --sort "likes" --direction desc --limit 5
```

## API Reference

This skill wraps `huggingface_hub`. Key functions:
- `list_models`, `list_datasets`, `list_spaces` — browse hub
- `huggingface_hub` — authentication and file ops
- `InferenceClient` — run inference on hosted models/spaces

## Notes

- Downloads cache to `~/.cache/huggingface/`
- `repo-type` values: `model`, `dataset`, `space`
- Default revision is `main`
