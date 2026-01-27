---
name: Set up SSH server for remote access
description: Sets up secure remote access to your Zo Computer so you can connect from anywhere
metadata:
  author: Zo
  emoji: 🔐
---

# Set Up SSH Server (sshd) Service on Zo Computer

# How to Use This File

This file will be included in a user request. If it is, and the user has provided the necessary inputs, Zo should interpret this as the current task at hand and use its tools to carry out the task until completion. Zo should not ask for user confirmation to continue if it has all required parameters to execute this function. Zo should effectively treat the inclusion of this file as a user request to "run" this task.

## Purpose

This document codifies the procedure for setting up an SSH server (sshd) as a managed user service on Zo Computer, allowing secure remote shell access to the machine. The setup includes configuring authentication (either SSH keys or password), installing necessary packages, configuring sshd, and registering the service to run persistently with automatic restarts.

## Inputs

- **Authentication method:** to set this up either a key or password auth must be specified. If not specified we need to ask the user to pick one and supply the details.
- **Public SSH key:** (Required if authentication method is `key`) The user's SSH public key content to add to `authorized_keys ` - strongly prefer this method and show the user how to create a keypair on their host system, whether that is a mac or a windows machine. Prefer to have them create a new identity vs using an existing identity. give them the correct commands to create a keypair and have it added to their system.
- **Root password:** (Required if authentication method is `password`) The password to set for the root user account

## Procedure

1. **Configure authentication** based on the chosen method:

   **If using public key authentication:**

   ```bash
   echo "<public_key_content>" >> /root/.ssh/authorized_keys
   chmod 600 /root/.ssh/authorized_keys
   ```

   Replace `<public_key_content>` with the actual SSH public key provided by the user.

   **If using password authentication:**

   ```bash
   echo "root:<password>" | chpasswd
   ```

   Replace `<password>` with the password provided by the user.

2. **Create or update sshd configuration file** at `/etc/ssh/sshd_config` with the following settings:

   ```bash
   cat > /etc/ssh/sshd_config << 'EOF'
   # Port will be set via command-line flag (-p)
   Protocol 2

   # Authentication
   PermitRootLogin yes
   PubkeyAuthentication yes
   AuthorizedKeysFile .ssh/authorized_keys
   PasswordAuthentication <password_auth_setting>
   PermitEmptyPasswords no
   ChallengeResponseAuthentication no

   # Security
   X11Forwarding no
   PrintMotd no
   AcceptEnv LANG LC_*

   # Logging
   SyslogFacility AUTH
   LogLevel INFO

   # Subsystems
   Subsystem sftp /usr/lib/openssh/sftp-server
   EOF
   ```

   Replace `<password_auth_setting>` with `yes` if using password authentication, or `no` if using key-only authentication.

3. **Choose an available port** for the SSH service (recommend using a port in the 20000-30000 range to avoid conflicts). DO NOT use port 22:

   ```bash
   # Check if port is available (should return no output if free)
   netstat -tuln | grep :<chosen_port>
   ```

   If port 22222 is already in use, increment to 22223, 22224, etc. until you find a free port.

4. **Register the sshd service** using the `register_user_service` tool:

   ```markdown
   register_user_service(
   label="sshd",
   protocol="tcp",
   local_port=<chosen_port>,
   entrypoint="/usr/sbin/sshd -D -p <chosen_port>"
   )
   ```

   Replace `<chosen_port>` with the port number selected in step 3.

   The service will:
   - Run in daemon mode (`-D` flag prevents backgrounding)
   - Listen on the specified port (`-p` flag)
   - Automatically restart if it crashes
   - Persist across machine restarts
   - Be assigned a public TCP address (e.g., `ts1.zocomputer.io:10991`)

5. **Verify the service is running:**

   ```bash
   # Check service logs for successful startup
   cat /dev/shm/sshd.log
   cat /dev/shm/sshd_err.log

   # Verify sshd process is running
   ps aux | grep sshd | grep -v grep

   # Test local connectivity
   nc -zv localhost <chosen_port>
   ```

6. **Retrieve the public TCP address** from the service registration response (format: `ts1.zocomputer.io:<port>`).

## Expected Output

- Authentication is configured (either public key added to authorized_keys, or root password set)
- sshd configuration file exists at `/etc/ssh/sshd_config` with appropriate security settings
- sshd service is registered as a managed user service
- Service is running and listening on the chosen port
- Public TCP address is available for remote connections

## Notification to the User

After each successful run of this procedure, communicate to the user:

- Confirmation that the SSH server has been installed and configured
- The authentication method that was configured (key or password)
- The local port the service is listening on
- **The public TCP address** where they can connect (e.g., `ts1.zocomputer.io:10991`)
- The SSH connection command they should use:
  - For key authentication: `ssh -p <public_port> root@<public_host>`
  - For password authentication: `ssh -p <public_port> root@<public_host>` (they will be prompted for the password)
- That the service will automatically restart if it crashes and persist across reboots

### Optional SSH Config Setup

Suggest to the user that they can create a convenient SSH shortcut on their personal computer by adding an entry to their `~/.ssh/config` file:

```
Host myzo
  HostName <public_host>
  Port <public_port>
  User root
  ServerAliveInterval 30
  ServerAliveCountMax 3
  IdentityFile ~/.ssh/<users_key_file>
```

Replace the placeholders:

- `<public_host>` with the actual hostname (e.g., `ts1.zocomputer.io`)
- `<public_port>` with the actual port number
- `<users_key_file>` with their SSH private key filename (e.g., `id_ed25519` or `id_rsa`)

After adding this entry, they can simply connect with:

```bash
ssh myzo
```

The `ServerAliveInterval` and `ServerAliveCountMax` settings help keep the connection alive and detect dropped connections more reliably.

### Next Steps and Use Cases

Now that SSH access is configured, inform the user they have several options for leveraging this connection:

**Development Tools:**

- Connect their IDE (VS Code, JetBrains IDEs, etc.) via Remote SSH for direct code editing on their Zo Computer
- Set up remote debugging sessions
- Use remote terminals directly in their editor

**File Transfer:**

- Connect SFTP clients like Cyberduck, FileZilla, or Transmit for graphical file management
- Use `scp` or `rsync` for command-line file transfers
- Mount the remote filesystem using SSHFS

**Other Possibilities:**

- Set up SSH tunnels for secure access to other services
- Use SSH port forwarding to access web services running on Zo
- Run remote commands and scripts from their local machine
- Set up automated deployments or backups over SSH

Ask the user: **"What would you like to do with your SSH connection?"** This helps guide them toward the next configuration steps based on their specific needs.

## Service Management Notes

- The sshd service runs as a managed user service that automatically restarts if it crashes
- Logs are written to `/dev/shm/sshd.log` and `/dev/shm/sshd_err.log`
- To update the service configuration, use the `update_user_service` tool
- To stop the service, use the `delete_user_service` tool with the service_id
- The service will persist across machine restarts
- Changes to `/etc/ssh/sshd_config` require service restart to take effect

## Technical Notes

- Zo Computer runs in a container environment managed by gVisor without systemd
- The `-D` flag is required for sshd to run in the foreground (managed services expect foreground processes)
- Public key authentication is more secure than password authentication and is recommended
- The service is accessible via the public TCP address provided by Zo's infrastructure
- Port 22 (standard SSH port) is not used; instead, a high-numbered port is chosen to avoid conflicts
- Root login is permitted because Zo runs as root by default in its container environment
- SFTP is supported via the configured subsystem
- Multiple SSH keys can be added by appending additional lines to `authorized_keys`

## Security Considerations

- When using password authentication, choose a strong password (minimum 16 characters, mix of letters, numbers, symbols)
- Public key authentication is strongly preferred over password authentication
- The SSH service is exposed to the public internet via the TCP address
- Consider restricting `PasswordAuthentication no` if you're using key-based auth only
- Regularly monitor `/dev/shm/sshd.log` for unauthorized access attempts
- Keep OpenSSH updated: `apt-get update && apt-get upgrade -y openssh-server`

---

This document will be maintained and updated as SSH configuration needs evolve, but will always reflect the core action of establishing a secure, managed SSH server service on Zo Computer.

