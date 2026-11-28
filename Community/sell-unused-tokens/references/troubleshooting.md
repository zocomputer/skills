# Troubleshooting

Never echo a provider key, pairing code, or agent token while debugging.

## Pairing

| What you see | What to do |
|---|---|
| A terminal is required | Run the CLI in an interactive macOS or Linux terminal. Do not pass the secret as an argument or pipe it through chat. |
| Invalid or expired pairing code | Create a new code at `/agent`. Codes expire after 10 minutes. |
| Pairing code already used | Create a new code. Never retry the same exchange. |
| Agent session expired | Run `login` again. Sessions expire after eight hours. |
| Not paired | Run `login`; do not manufacture or edit the session file. |

## Probe

| What you see | What to do |
|---|---|
| Provider terms confirmation required | Stop until the user reviews their provider terms. Then rerun with `--confirm-provider-terms`. |
| 504 / Surplus took too long | Retry the `sell` command once. If it repeats, stop and report the timeout. |
| Host rejected the key (401/403) | Stop. The key is inactive, truncated, or from the wrong account. Do not guess. |
| Surplus does not support the host | The key was not checked. Use a catalog provider or an already-supported custom URL. |
| No attainable text models recommended | Review demand with the user or name discovered models explicitly with `--models`. Do not invent IDs. |

## Listing

| What you see | What to do |
|---|---|
| 429 / `retryAfterSec` | The CLI waits and retries that model once. If it still fails, report it and stop retrying. |
| `already_listed` | Treat the model as skipped. The agent token cannot delete or relist it. |
| 502 / 503 / 504 | The CLI retries once. Keep successful rows and report the rest. |
| Mixed created and failed rows | Do not rerun the whole batch. Retry only a failed model if the user asks. |

## Status

| Label | Meaning | Action |
|---|---|---|
| live | Healthy and on the book | None |
| cooling | Temporary quiet | None |
| backing off | Surplus marked it unhealthy | Wait; use the browser to replace a revoked or exhausted key. |
| paused | Daily cap reached or leftover hours are off | Wait or use the browser dashboard. |
| syncing | House book has not settled | Check `status` later. |

## Support

gm@galleonlabs.io. Do not invent providers, model IDs, routes, or environment values.
