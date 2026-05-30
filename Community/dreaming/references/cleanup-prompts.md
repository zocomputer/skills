# Cleanup Interaction Prompts

Use these literal prompt templates when running the `dreaming` skill in deep mode. Adjust wording for tone, but preserve the structure.

## Per Stale Folder

> Folder: `<path>`
> Last touched: `<date>` (`<N>` days ago)
> Contents: `<file count>` files, `<size>` total
> Best guess at purpose: `<one line>`
>
> Choose:
> 1. **Archive** → move to `Archive/<YYYY>/<folder name>/` and add a one-line note in the heartbeat report
> 2. **Delete** → `rm -rf <path>` (requires you to type the literal folder name to confirm)
> 3. **Keep** → record "still needed as of <today>" so the next heartbeat won't surface it
> 4. **Defer** → leave it, surface again next run
>
> Reply with 1, 2, 3, or 4.

## Per Context-Bleed File

> File: `<source path>`
> Suspected correct location: `<destination path>`
> Why I think it's misplaced: `<one-line reason>`
>
> Choose:
> 1. **Move** → relocate to suggested path
> 2. **Keep here** → record an exception so I stop flagging it
> 3. **Different location** → tell me where
> 4. **Defer** → surface again next run

## Per Skill Candidate

> Workflow detected: `<short name>`
> Occurrences in last 30 days: `<count>` (`<dates>`)
> Proposed scope: `<project | global>`
>
> Proposed `SKILL.md` skeleton:
> ```
> ---
> name: <slug>
> description: <one line>
> ---
> # <Title>
> ## When to use
> ## Steps
> ## Output
> ```
>
> Choose:
> 1. **Scaffold it** → create the SKILL.md and open for me to flesh out
> 2. **Defer** → keep watching, surface again if it happens a 4th time
> 3. **Reject** → mark as "not a skill, just a coincidence" so I stop suggesting it

## Per Idle Automation

> `<name>` last fired: `<date>` (`<N>` days ago)
> Last status: `<ok | error | throttled>`
> Runs: `<what it does in one line>`
>
> Choose:
> 1. **Pause** → disable but keep the config
> 2. **Delete** → remove entirely
> 3. **Fix** → leave running, but tell me what to look at
> 4. **Defer** → leave it, surface again next run

## Per Stale Persona

> `<persona name>` last activated: `<date>` (`<N>` days ago)
> Purpose: `<one line from the Persona description>`
>
> Choose:
> 1. **Retire** → remove the Persona
> 2. **Keep** → record "still needed as of <today>"
> 3. **Defer** → surface again next run

## Per Stale Rule

> Rule: `<rule text>`
> Added: `<date>` (`<N>` days ago)
> Conflict: `<other rule or skill that may supersede this, or "none">`
>
> Choose:
> 1. **Remove** → rule no longer applies
> 2. **Keep** → still relevant
> 3. **Edit** → tell me how to adjust the wording
> 4. **Defer** → surface again next run

## Per Hosted Site / Service

> `<URL>` last updated: `<date>` (`<N>` days ago)
> Reachable: `<yes | no | timeout>`
> Purpose: `<one line, or "unclear">`
>
> Choose:
> 1. **Keep** → still in use
> 2. **Sleep** → take down the public surface but keep the files
> 3. **Retire** → remove the hosted service entirely (after typed confirmation)
> 4. **Defer** → surface again next run

## Confirmation Discipline

For any **Delete** choice, require the user to type the literal item name back. Examples:

> To confirm deleting `Active Projects/Old Campaign/`, type: `Active Projects/Old Campaign/`

This prevents fast-yes mistakes. The friction is the feature.
