# Mengram Security Best Practices

## Overview

This document outlines security best practices for the Mengram memory system on Zo Computer.

---

## 1. API Key Management

### Generation
```bash
python3 scripts/security.py generate
```

### Storage
- **Never** hardcode API keys in config files
- Store in Zo Secrets: Settings > Advanced > Secrets
- Or use environment variables: `MENGRAM_API_KEY`
- File permissions should be `600` (owner read/write only)

### Rotation
- Rotate keys every 90 days
- Immediately rotate if key is suspected compromised
- Keep a secure backup of keys

---

## 2. Network Security

### HTTPS
- All Zo services automatically get HTTPS
- External URLs use TLS 1.2+
- Never disable HTTPS in production

### Localhost Bypass
- **Default: DISABLED** (`MENGRAM_ALLOW_LOCALHOST=false`)
- Only enable for local development if needed
- Keep disabled for production and scheduled automation

### CORS
- Restrict to specific origins
- Never use `allow_origins=["*"]` in production
- Example:
  ```python
  allow_origins=[
      "https://your-handle.zo.computer",
      "https://your-handle.zo.space"
  ]
  ```

---

## 3. Authentication

### Bearer Token
All protected API requests require authentication.

### Endpoint Policy
- Public:
  - `/api/health`
  - `/docs`
  - `/openapi.json`
  - `/`
  - `/static/*`
- Protected:
  - `/api/remember`
  - `/api/remember/text`
  - `/api/recall/gated`
  - `/api/search/gated`
  - `/api/recall` (raw)
  - `/api/search` (raw)
  - `/api/profile`
  - `/api/stats`
  - `/api/graph`

---

## 4. External Agent Access

### Secure Access Pattern
1. Generate a dedicated API key for the external agent
2. Store key securely in agent's environment
3. Include key in all requests

Example for Claude Code:
```bash
# In agent's environment
export MENGRAM_API_KEY="mg_YOUR_KEY"

# In requests
curl -H "Authorization: Bearer $MENGRAM_API_KEY" \
     https://your-service.zocomputer.io/api/profile
```

### Never
- Never share keys via email, chat, or code
- Never commit keys to git repositories
- Never log keys in application logs

---

## 5. Monitoring

### Health + Gate Checks
Monitor these daily:
```bash
curl -s http://localhost:8420/api/health
curl -s http://localhost:8420/api/profile                      # should be Unauthorized
curl -s -H "Authorization: Bearer $MENGRAM_API_KEY" \
  http://localhost:8420/api/profile                            # should succeed
curl -s -X POST http://localhost:8420/api/recall/gated \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MENGRAM_API_KEY" \
  -d '{"query":"hello","top_k":5}'                         # should skip/query decision
```

### Logs
Check for suspicious activity:
```bash
tail -f /dev/shm/mengram-api.log
```

Look for:
- Multiple failed authentication attempts
- Unusual request patterns
- Unknown IP addresses

---

## 6. Incident Response

### If Key is Compromised
1. Immediately generate a new key
2. Update all services and clients with new key
3. Revoke old key
4. Audit logs for unauthorized access

### If Service is Breached
1. Stop the service
2. Rotate all API keys
3. Review access logs
4. Check for data exfiltration
5. Patch vulnerability before restarting

---

## 7. Operational Defaults

- Use gated endpoints by default (`/api/recall/gated`, `/api/search/gated`).
- Use raw endpoints only for break-glass debugging.

---

## Security Checklist

| Item | Status |
|------|--------|
| HTTPS enabled | ✅ Auto (Zo) |
| Auth required | ✅ Verify |
| Localhost bypass disabled | ✅ Verify |
| CORS restricted | ✅ Verify |
| Keys in secrets (not code) | ✅ Verify |
| File permissions correct (600) | ✅ Verify |
| Health endpoint monitored | ⚠️ Optional |
| Logs monitored | ⚠️ Optional |
| Key rotation schedule | ⚠️ Recommended |

---

*Last updated: 2026-02-26*
