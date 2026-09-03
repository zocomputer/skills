---
name: supergrok-setup
description: >-
  Install and authenticate xAI's Grok Build CLI on a Zo Computer with an
  existing SuperGrok or SuperGrok Heavy subscription. Use when a user wants
  subscription-backed Grok coding access on Zo without configuring an API key.
metadata:
  author: ss251
  category: Community
  display-name: SuperGrok Setup
---

# SuperGrok Setup

Set up the official Grok Build CLI on a Zo Computer and authenticate it through
xAI's device-code flow. This uses the user's existing Grok subscription and the
official client; it does not request or copy an OAuth token.

This is a terminal integration. It does not add Grok to Zo's **Settings → AI
Providers** model picker. First-class provider support requires a change to the
Zo application.

## Setup

### 1. Check the host and existing installation

Run:

```bash
uname -s
command -v grok || \
  test -x "${GROK_BIN_DIR:-$HOME/.grok/bin}/grok" || \
  test -x "${GROK_HOME:-$HOME/.grok}/bin/grok"
```

Continue on Linux. If Grok is already installed, preserve the installation and
configuration; do not reinstall it.

### 2. Install Grok Build when missing

Run the bundled idempotent installer wrapper:

```bash
bash Skills/supergrok-setup/scripts/install-grok.sh
```

The wrapper downloads and runs xAI's documented installer from
`https://x.ai/cli/install.sh`. It does nothing when a working Grok binary is
already present. Do not replace this with a third-party package or OAuth proxy.

Resolve the binary for subsequent commands:

```bash
GROK_BIN=""
for candidate in \
  "$(command -v grok 2>/dev/null || true)" \
  "${GROK_BIN_DIR:+$GROK_BIN_DIR/grok}" \
  "${GROK_HOME:+$GROK_HOME/bin/grok}" \
  "$HOME/.grok/bin/grok"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] && \
    "$candidate" version >/dev/null 2>&1; then
    GROK_BIN="$candidate"
    break
  fi
done
test -n "$GROK_BIN"
"$GROK_BIN" version
```

If the installer added Grok to a shell startup file, using the absolute path
above avoids requiring a terminal restart.

### 3. Authenticate the subscription

API keys and custom model endpoints can take precedence over the subscription
session. Detect relevant environment overrides without printing their values:

```bash
GROK_OVERRIDE_VARS=()
for variable_name in \
  XAI_API_KEY \
  GROK_DEFAULT_MODEL \
  GROK_WEB_SEARCH_MODEL \
  GROK_MODELS_BASE_URL \
  GROK_MODELS_LIST_URL \
  GROK_XAI_API_BASE_URL; do
  if printenv "$variable_name" >/dev/null 2>&1; then
    GROK_OVERRIDE_VARS+=("$variable_name")
  fi
done
```

If `GROK_OVERRIDE_VARS` has any entries, list only those variable names and stop
before login. Ask the user whether to keep them and use process-local unsets for
every subscription-backed Grok invocation, or to remove their persistent
definitions. Do not delete variables or edit shell configuration automatically.
If the user keeps them, explicitly warn that an ordinary unprefixed `grok`
command may use the alternate route; use the subscription-safe prefix shown in
the commands below for setup and future work.

Run this in a persistent interactive terminal:

```bash
env \
  -u XAI_API_KEY \
  -u GROK_DEFAULT_MODEL \
  -u GROK_WEB_SEARCH_MODEL \
  -u GROK_MODELS_BASE_URL \
  -u GROK_MODELS_LIST_URL \
  -u GROK_XAI_API_BASE_URL \
  "$GROK_BIN" login --device-auth
```

Grok prints a URL and a short one-time code. Give both to the user and wait for
them to complete authorization in their browser. The user must choose the xAI
account that owns the SuperGrok subscription and handle any password, MFA,
consent, or ambiguous account selection themselves.

Never read, print, copy, upload, or directly edit
`${GROK_HOME:-$HOME/.grok}/auth.json`.

### 4. Verify authentication and configuration

Run:

```bash
env \
  -u XAI_API_KEY \
  -u GROK_DEFAULT_MODEL \
  -u GROK_WEB_SEARCH_MODEL \
  -u GROK_MODELS_BASE_URL \
  -u GROK_MODELS_LIST_URL \
  -u GROK_XAI_API_BASE_URL \
  "$GROK_BIN" inspect --json
GROK_MODELS_OUTPUT="$(
  env \
    -u XAI_API_KEY \
    -u GROK_DEFAULT_MODEL \
    -u GROK_WEB_SEARCH_MODEL \
    -u GROK_MODELS_BASE_URL \
    -u GROK_MODELS_LIST_URL \
    -u GROK_XAI_API_BASE_URL \
    "$GROK_BIN" models
)"
printf '%s\n' "$GROK_MODELS_OUTPUT"
```

`grok models` can list built-in models even before authentication, so its output
alone does not prove that login succeeded. Report the CLI version, whether
models were returned, and a concise summary of the discovered configuration
sources. Do not paste credential files or secret values into the response.

Before the smoke test, check configuration files for model credential or
endpoint overrides without printing their values:

```bash
GROK_HOME_DIR="${GROK_HOME:-$HOME/.grok}"
GROK_OVERRIDE_FILES=()
for config_file in \
  "$GROK_HOME_DIR/config.toml" \
  "$GROK_HOME_DIR/managed_config.toml" \
  "$GROK_HOME_DIR/requirements.toml" \
  /etc/grok/managed_config.toml \
  /etc/grok/requirements.toml; do
  if [ -r "$config_file" ] && \
    grep -Eq '(^|[^[:alnum:]_-])(api_key|env_key|base_url)[[:space:]]*=' "$config_file"; then
    GROK_OVERRIDE_FILES+=("$config_file")
  fi
done
```

If `GROK_OVERRIDE_FILES` has any entries, list only those filenames and stop
before the smoke test. A configured `model.api_key`, `model.env_key`, or custom
endpoint can take precedence over the active session and use a different billing
path. Ask the user to confirm the intended model/billing path or to authorize a
clean, dedicated `GROK_HOME` followed by another device-code login. Do not disable
or rewrite an existing model configuration automatically.

If there are no overrides, parse the `Default model:` line from `grok models`
and store that exact ID as `SUBSCRIPTION_MODEL`. Stop if no default model can be
identified; do not guess a model ID:

```bash
SUBSCRIPTION_MODEL="$(
  printf '%s\n' "$GROK_MODELS_OUTPUT" |
    sed -n 's/^Default model:[[:space:]]*//p' |
    head -n 1
)"
test -n "$SUBSCRIPTION_MODEL"
```

Before opening a sensitive repository, review the `inspect` result for inherited
rules, skills, plugins, hooks, and MCP servers. Start the TUI and show the user
`/privacy`; explain the current data-retention setting, but do not change it
without the user's explicit choice.

### 5. Run a minimal smoke test

Run the test from a new empty temporary directory so Grok does not ingest an
unrelated repository:

```bash
(
  GROK_TEST_DIR="$(mktemp -d)"
  trap 'cd /tmp && rmdir "$GROK_TEST_DIR" 2>/dev/null || true' EXIT
  cd "$GROK_TEST_DIR"
  env \
    -u XAI_API_KEY \
    -u GROK_DEFAULT_MODEL \
    -u GROK_WEB_SEARCH_MODEL \
    -u GROK_MODELS_BASE_URL \
    -u GROK_MODELS_LIST_URL \
    -u GROK_XAI_API_BASE_URL \
    "$GROK_BIN" -p \
      "Reply with exactly GROK_OK. Do not call tools." \
      --model "$SUBSCRIPTION_MODEL" \
      --max-turns 1 --no-plan --no-subagents --disable-web-search
)
```

The expected response is `GROK_OK`. This consumes a small amount of the shared
weekly Grok allowance. Do not use `--always-approve` or `--yolo` for setup or
verification.

If environment overrides were retained, use the same `env -u ...` prefix for
every later subscription-backed Grok command and include that requirement in the
completion report. Do not claim that plain `grok` is subscription-backed while a
routing override remains set.

## Troubleshooting

- **`grok: command not found` after installation:** use
  `${GROK_BIN_DIR:-$HOME/.grok/bin}/grok` in the current terminal. A new terminal
  should load the PATH entry written by the official installer.
- **The subscription is not recognized:** verify that device authorization used
  the same xAI sign-in method and account as the subscription. Do not log out or
  clear cached credentials until the user approves replacing the current login.
- **The CLI is installed but outdated:** run `grok update --check`. Update only
  when the user asks; setup should not silently replace an existing version.
- **The wrong billing path is used:** check for `XAI_API_KEY` and custom model
  entries in the `grok inspect --json` summary. Subscription verification should
  use the session login, not a first-party API key.

## Official documentation

- [Grok Build overview and installer](https://docs.x.ai/build/overview)
- [CLI commands](https://docs.x.ai/build/cli/reference)
- [Device-code authentication](https://docs.x.ai/build/enterprise#device-code)
- [Configuration scopes and inspection](https://docs.x.ai/build/settings)
- [Configuration and environment-variable reference](https://docs.x.ai/build/settings/reference)
- [SuperGrok usage and limits](https://docs.x.ai/grok/faq#how-do-supergroks-weekly-usage-limits-work)
