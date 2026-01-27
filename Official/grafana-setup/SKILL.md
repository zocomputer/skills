---
name: Set up Grafana for log visualization
description: Sets up a visual dashboard to explore and analyze your system logs and data
metadata:
  author: Zo
  category: Official
  emoji: 📈
---

## How to Use This File

This file will be included in a user request. Zo should interpret this as the current task at hand and use its tools to carry out the task until completion. Zo should not ask for user confirmation to continue if it has all required parameters to execute this function. Zo should effectively treat the inclusion of this file as a user request to "run" this task.

## Purpose

This document codifies the procedure for setting up Grafana on Zo Computer to visualize logs from an existing Loki installation. This assumes you already have Loki (port 3100) and Promtail running and collecting logs.

---

# Grafana Setup Guide for Existing Loki Stack

This guide will walk you through setting up Grafana to visualize logs from your existing Loki installation on your Zo Computer.

## What You'll Have When Done

- **Grafana** (port 3770): Web interface for querying and visualizing logs
- Public access via `https://grafana-rob.zocomputer.io` (automatic reverse proxy with SSL)
- Pre-configured Loki datasource pointing to `http://localhost:3100`
- Persistent service that auto-restarts if it crashes
- Secure admin authentication

**Note**: The public URL follows the pattern `https://<label>-<username>.zocomputer.io`. For user "rob" with service label "grafana", this will be `https://grafana-rob.zocomputer.io`.

---

## Prerequisites

Before beginning setup, you must have:

- **Loki running** on port 3100 (verify with `curl http://localhost:3100/ready`)
- **Promtail running** and collecting logs

**If not ready**: Make sure you've set up Loki and Promtail first. Refer to the `file loki-stack-setup.md` command file.

**Note**: The Grafana username will be `admin`. You can change it later if desired.

---

## Setup Instructions

### Step 1: Verify Loki is Running

Before installing Grafana, confirm Loki is accessible:

```bash
# Check Loki is responding
curl -s http://localhost:3100/ready
```

**Expected Result**: You should see "ready" after a few seconds (Loki has a warmup period).

**If not ready**: Make sure you've set up Loki and Promtail first. Refer to the `file loki-stack-setup.md` command file.

---

### Step 2: Install Grafana

Install Grafana from the official repository:

```bash
# Update package lists
apt update

# Install required utilities
apt install -y apt-transport-https software-properties-common wget

# Add Grafana GPG key
mkdir -p /etc/apt/keyrings/
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | tee /etc/apt/keyrings/grafana.gpg > /dev/null

# Add Grafana repository
echo 'deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main' | tee /etc/apt/sources.list.d/grafana.list

# Update and install Grafana
apt update
apt install -y grafana
```

**Verify**: Check Grafana is installed:

```bash
grafana-cli --version
```

**Expected Result**: You should see a version number (e.g., `grafana version 12.x.x`).

---

### Step 3: Configure Grafana

Configure Grafana with the public domain that will be assigned when you register the service. The domain follows the pattern `https://<label>-<username>.zocomputer.io`:

```bash
# For user "rob" with service label "grafana", the domain will be grafana-rob.zocomputer.io
# Zo should dynamically construct this based on the actual username

# Set the port
sed -i 's/;http_port = 3000/http_port = 3770/' /etc/grafana/grafana.ini

# Set the domain (replace 'rob' with actual username)
sed -i 's/;domain = localhost/domain = grafana-rob.zocomputer.io/' /etc/grafana/grafana.ini

# Set the root URL with HTTPS (Zo handles the SSL termination)
sed -i 's|;root_url = %(protocol)s://%(domain)s:%(http_port)s/|root_url = https://grafana-rob.zocomputer.io|' /etc/grafana/grafana.ini
```

**Important**: Replace `rob` with the actual username. Zo should construct the domain as `grafana-{username}.zocomputer.io`.

**Verify**: Check the configuration:

```bash
grep "^http_port\|^domain\|^root_url" /etc/grafana/grafana.ini
```

**Expected Result** (for user "rob"):

```markdown
http_port = 3770
domain = grafana-rob.zocomputer.io
root_url = https://grafana-rob.zocomputer.io
```

**What This Does**: Configures Grafana to work correctly behind Zo's automatic reverse proxy, which provides SSL termination and routes `https://grafana-rob.zocomputer.io` to your Grafana instance on port 3770.

---

### Step 4: Configure Loki Datasource

Create a provisioned Loki datasource in Grafana:

```bash
# Create provisioning directory
mkdir -p /etc/grafana/provisioning/datasources

# Create Loki datasource configuration
cat > /etc/grafana/provisioning/datasources/loki.yaml << 'EOF'
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    isDefault: true
    jsonData:
      maxLines: 1000
    editable: true
EOF
```

**What This Does**: Automatically configures Loki as the default datasource in Grafana, so you can start querying logs immediately after login.

**Verify**: Check the datasource file:

```bash
cat /etc/grafana/provisioning/datasources/loki.yaml
```

---

### Step 5: Register Grafana Service

Register Grafana as a persistent user service:

```bash
# Zo will use tool register_user_service with:
# - label: grafana
# - protocol: http
# - local_port: 3770
# - entrypoint: /usr/share/grafana/bin/grafana server --config=/etc/grafana/grafana.ini --homepath=/usr/share/grafana
```

**Verify**: Use `tool list_user_services` to confirm the `grafana` service is registered.

**Test**: Wait a few seconds for Grafana to start:

```bash
sleep 5
curl -s http://localhost:3770/api/health | jq
```

**Expected Result**: You should see `{"database": "ok", "version": "..."}`.

---

## Accessing Grafana

Once Grafana is running, access it in your browser via the public URL:

```markdown
https://grafana-rob.zocomputer.io
```

**Initial Login Credentials**:

- **Username**: `admin`
- **Password**: `admin`

**Important**: On your first login, Grafana will **require** you to change the default password. Choose a strong password and save it securely.

**How It Works**: When you register a service with Zo, you're automatically assigned a public URL in the format `https://<label>-<username>.zocomputer.io`. Zo handles the reverse proxy and SSL termination for you, so your service is immediately accessible over HTTPS without any additional configuration.

**Alternative Access**: You can also access Grafana locally at `http://localhost:3770` if you're working directly on the Zo Computer. See the Advanced Configuration section for localhost-only setup.

---

## Using Grafana with Loki

### Exploring Logs

1. **Access Grafana**: Open `http://localhost:3770` in your browser
2. **Login** with username `admin` and your password
3. **Navigate to Explore**: Click the compass icon (🧭) in the left sidebar
4. **Query Logs**: The Loki datasource is already selected

### Example LogQL Queries

**View all service logs**:

```markdown
{job="zo_services"}
```

**View system logs**:

```markdown
{job="varlogs"}
```

**Filter for errors**:

```markdown
{job="zo_services"} |= "error"
```

**View logs from a specific service**:

```markdown
{filename="/dev/shm/n8n.log"}
```

**Search for specific text**:

```markdown
{job="zo_services"} |= "startup"
```

**Count log lines over time**:

```markdown
sum by (filename) (count_over_time({job="zo_services"}[5m]))
```

### Creating Dashboards

1. Click the "+" icon in the left sidebar
2. Select "Dashboard"
3. Add panels with your LogQL queries
4. Save the dashboard for future use

---

## Verifying the Setup

### Test Loki Datasource

1. In Grafana, navigate to **Configuration → Data Sources**
2. Click on **Loki**
3. Scroll down and click **Test**
4. You should see "Data source is working"

### Query Recent Logs

In the Explore view, run this query:

```markdown
{job=~".+"}
```

This will show logs from all jobs. If you see log entries, everything is working correctly.

---

## Troubleshooting

### Grafana Won't Start

Check the logs:

```bash
# Service logs are at:
cat /dev/shm/grafana.log
cat /dev/shm/grafana_err.log
```

Common issues:

- Port 3770 already in use
- Permissions on `/var/lib/grafana/`
- Configuration file syntax error

### Can't Login to Grafana

If you forgot the password:

```bash
# Stop Grafana service first
# Ask Zo to "delete the grafana service"

# Reset password to default
grafana-cli admin reset-admin-password admin

# Re-register the service
# Run Step 5 again

# Log in with admin/admin and set a new password
```

Alternatively, you can set a specific password directly:

```bash
# Stop Grafana service first
# Ask Zo to "delete the grafana service"

# Set a new password
grafana-cli admin reset-admin-password YOUR_NEW_PASSWORD

# Re-register the service
# Run Step 5 again
```

### Loki Datasource Not Working

1. Verify Loki is running: `curl http://localhost:3100/ready`
2. Check the datasource URL is `http://localhost:3100` in Grafana
3. In Grafana, go to **Configuration → Data Sources → Loki** and click **Test**

### No Logs Appearing in Queries

Check Loki has logs:

```bash
# Check Loki labels (should show your configured jobs)
curl -s http://localhost:3100/loki/api/v1/labels | jq

# Check label values for job
curl -s http://localhost:3100/loki/api/v1/label/job/values | jq
```

If no labels appear, the issue is with Loki/Promtail, not Grafana.

---

## Managing the Grafana Service

### View Service Status

Ask Zo: "List my user services"

Or check directly:

```bash
curl http://localhost:3770/api/health
```

### Restart Grafana

Ask Zo: "Restart the grafana service"

Or use `tool update_user_service` with a dummy env var change to trigger restart.

### Stop/Delete Grafana

Ask Zo: "Delete the grafana service"

Or use `tool delete_user_service` with the service ID.

### View Logs

Service logs are written to `/dev/shm/`:

```bash
tail -f /dev/shm/grafana.log
```

---

## Advanced Configuration

### Adding Additional Datasources

Create additional datasource files in `/etc/grafana/provisioning/datasources/`:

```bash

```

Restart Grafana to load the new datasource.

### Configuring SMTP for Alerts

Edit `/etc/grafana/grafana.ini`:

```ini
[smtp]
enabled = true
host = smtp.gmail.com:587
user = your-email@gmail.com
password = your-app-password
from_address = your-email@gmail.com
from_name = Grafana
```

Restart Grafana after making changes.

### Enabling Anonymous Access

To allow viewing dashboards without login:

```bash
sed -i 's/;enabled = false/enabled = true/' /etc/grafana/grafana.ini
sed -i 's/;org_role = Viewer/org_role = Viewer/' /etc/grafana/grafana.ini
```

Under the `[auth.anonymous]` section. Restart Grafana.

### Running Behind a Reverse Proxy

If you want to expose Grafana through a reverse proxy (e.g., Nginx, Caddy, Traefik) with a custom domain, you need to configure the domain name so Grafana can render links and redirects correctly.

**Step 1: Update Grafana Configuration**

Edit `/etc/grafana/grafana.ini` to set your domain and root URL:

```bash
# For a domain like grafana.example.com
sed -i 's/^domain = grafana-rob.zocomputer.io/domain = grafana.example.com/' /etc/grafana/grafana.ini
sed -i 's|^root_url = https://grafana-rob.zocomputer.io|root_url = https://grafana.example.com|' /etc/grafana/grafana.ini
```

Or manually edit the `[server]` section:

```ini
[server]
http_port = 3770
domain = grafana.example.com
root_url = https://grafana.example.com
```

**Important Notes**:

- Use `https://` in `root_url` if your reverse proxy handles SSL/TLS
- The `domain` should match the hostname you're using to access Grafana
- If Grafana is served from a subpath (e.g., `example.com/grafana`), set `root_url = https://example.com/grafana`

**Step 2: Configure Your Reverse Proxy**

Example Nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name grafana.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3770;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Example Caddy configuration:

```caddy
grafana.example.com {
    reverse_proxy localhost:3770
}
```

**Step 3: Restart Grafana**

After changing the configuration:

```bash
# Ask Zo to restart the grafana service
# Or use update_user_service to trigger a restart
```

**Verification**: Access Grafana via your domain (e.g., `https://grafana.example.com`) and verify that links and redirects work correctly.

### Localhost-Only Configuration

If you prefer to run Grafana without public access (localhost only), configure it differently:

**Step 1: Update Grafana Configuration**

```bash
# Set localhost domain and HTTP root URL
sed -i 's/^domain = .*/domain = localhost/' /etc/grafana/grafana.ini
sed -i 's|^root_url = .*|root_url = http://localhost:3770|' /etc/grafana/grafana.ini
```

**Step 2: Register Service as TCP Instead of HTTP**

When registering the service, use `protocol: tcp` instead of `protocol: http`. This prevents Zo from creating a public URL.

```bash
# Zo will use tool register_user_service with:
# - label: grafana
# - protocol: tcp
# - local_port: 3770
# - entrypoint: /usr/share/grafana/bin/grafana server --config=/etc/grafana/grafana.ini --homepath=/usr/share/grafana
```

**Step 3: Access Locally**

Access Grafana only via `http://localhost:3770`. It will not have a public URL.

**When to Use This**:

- You only need local access to Grafana
- You're setting up a development/testing environment
- You want to avoid public exposure for security reasons

### Changing the Port

To run Grafana on a different port:

1. Edit `/etc/grafana/grafana.ini`:

   ```ini
   [server]
   http_port = 3001
   ```

2. Update the user service with the new port

3. Update `root_url` to match: `http://localhost:3001`

---

## Security Considerations

**Access Control**:

- Grafana requires password authentication by default
- Only accessible on localhost unless explicitly exposed
- Change the default admin password immediately

**User Management**:

- Create additional users with limited permissions
- Use teams and organizations for access control
- Enable LDAP/OAuth for enterprise authentication

**Network Exposure**:

- Grafana runs on localhost only by default
- Can be exposed via external URL but may have CSRF issues
- Use localhost access for Grafana to avoid CSRF/origin problems

---

## Backup and Recovery

### Backing Up Grafana

```bash
# Backup Grafana data (dashboards, users, settings)
tar -czf grafana-backup-$(date +%Y%m%d).tar.gz /var/lib/grafana/

# Backup configuration
tar -czf grafana-config-backup-$(date +%Y%m%d).tar.gz /etc/grafana/
```

### Restoring from Backup

```bash
# Stop Grafana service
# Ask Zo to "delete the grafana service"

# Restore data
tar -xzf grafana-backup-YYYYMMDD.tar.gz -C /
tar -xzf grafana-config-backup-YYYYMMDD.tar.gz -C /

# Re-register service
# Run Step 6 again
```

---

## Integration with Alerting

### Setting Up Alerts

1. Create a dashboard panel with a LogQL query
2. Go to the **Alert** tab in the panel editor
3. Configure alert conditions (e.g., log volume threshold)
4. Set up notification channels (email, Slack, PagerDuty)
5. Save the alert rule

### Example Alert Rule

Alert when error rate is high:

```markdown
rate({job="zo_services"} |= "error"[5m]) > 0.1
```

This triggers when more than 0.1 error logs per second are detected.

---

## Performance Tuning

### For Large Dashboards

If dashboards are slow:

1. **Reduce time range**: Use shorter time windows (e.g., last 6 hours instead of 7 days)

2. **Use specific queries**: Add more label selectors to narrow results

3. **Increase cache**: Edit `/etc/grafana/grafana.ini`:

   ```ini
   [caching]
   enabled = true
   ```

### For Many Concurrent Users

Increase Grafana resources:

```ini
[database]
max_open_conn = 100
max_idle_conn = 100
```

Consider using an external database (PostgreSQL) instead of SQLite.

---

## Summary

You now have Grafana running and connected to your Loki logging stack! Access it at `https://grafana-rob.zocomputer.io` to start exploring and visualizing your logs.

**Key Points**:

- Grafana is pre-configured with Loki as the default datasource
- Access via your public URL: `https://grafana-rob.zocomputer.io`
- Zo automatically handles reverse proxy and SSL termination
- Use the Explore view to query logs with LogQL
- Create dashboards to visualize log patterns over time
- The service is persistent and will survive reboots

For questions or issues, refer to the troubleshooting section or consult the Zo Discord community.

**Official Documentation**:

- Grafana: [https://grafana.com/docs/grafana/latest/](https://grafana.com/docs/grafana/latest/)
- Grafana with Loki: [https://grafana.com/docs/grafana/latest/datasources/loki/](https://grafana.com/docs/grafana/latest/datasources/loki/)
- LogQL: [https://grafana.com/docs/loki/latest/logql](https://grafana.com/docs/loki/latest/logql/)

