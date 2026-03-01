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
- Only enable for development (`MENGRAM_ALLOW_LOCALHOST=true`)
- Never enable in production

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
All API requests require authentication:
```bash
curl -H "Authorization: Bearer mg_YOUR_API_KEY" \
     https://your-service.zocomputer.io/api/profile
```

### Public Endpoints
Only these endpoints are public (no auth required):
- `/api/health` - Health check
- `/docs` - API documentation
- `/openapi.json` - OpenAPI spec
- `/` - Root (if configured)
- `/static/*` - Static files

### Protected Endpoints
All other endpoints require authentication:
- `/api/remember` - Store memories
- `/api/recall` - Retrieve memories
- `/api/profile` - User profile
- `/api/search` - Search memories

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

### Health Check
Monitor service health regularly:
```bash
curl https://your-service.zocomputer.io/api/health
# {"status":"ok","version":"2.14.5","auth":true}
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
