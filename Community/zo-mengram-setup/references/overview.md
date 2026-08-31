# zo-mengram-setup

Install and secure a self-hosted Mengram memory stack on Zo Computer.

## Scope

This skill is for **installation and hardening**.

- repository clone + dependency install
- local runtime config
- API auth setup
- basic service verification

For day-to-day memory usage, use **zo-mengram-memory**.

## Quick start

```bash
cd /home/workspace/Skills/zo-mengram-setup/scripts
python3 setup.py install
python3 security.py generate
python3 mengram.py status
```

## Security baseline

- protect endpoints with Bearer auth
- keep localhost bypass disabled by default
- prefer gated endpoints in runtime workflows

## Output

After this skill, you should have:
- Mengram API on `http://localhost:8420`
- auth key in secrets/env
- a working vault and profile endpoint
