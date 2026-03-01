#!/usr/bin/env python3
"""
Mengram Setup Script for Zo Computer

Installs and configures self-hosted Mengram memory system.
Run with: python3 setup.py install
"""

import os
import sys
import json
import subprocess
import secrets
import string
from pathlib import Path
from datetime import datetime


# Configuration defaults
DEFAULT_INSTALL_DIR = Path.home() / "mengram"
DEFAULT_VAULT_DIR = DEFAULT_INSTALL_DIR / "vault"
DEFAULT_PORT = 8420
DEFAULT_OLLAMA_MODEL = "llama3.2"
DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def run_command(cmd, cwd=None, check=True):
    """Run a shell command and return output."""
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True
    )
    if check and result.returncode != 0:
        print(f"Error running command: {cmd}")
        print(f"stderr: {result.stderr}")
        sys.exit(1)
    return result.returncode, result.stdout, result.stderr


def check_prerequisites():
    """Check that required tools are installed."""
    print("🔍 Checking prerequisites...")
    
    # Check Python version
    py_version = sys.version_info
    if py_version.major < 3 or (py_version.major == 3 and py_version.minor < 10):
        print("❌ Python 3.10+ required")
        return False
    print(f"  ✅ Python {py_version.major}.{py_version.minor}")
    
    # Check Ollama
    rc, out, _ = run_command("which ollama", check=False)
    if rc != 0:
        print("  ⚠️  Ollama not found. Install from: https://ollama.ai")
        print("     After installing, run: ollama pull llama3.2")
    else:
        print("  ✅ Ollama installed")
        
        # Check if Ollama is running
        rc, out, _ = run_command("curl -s http://localhost:11434/api/tags", check=False)
        if rc == 0 and out:
            print("  ✅ Ollama service running")
        else:
            print("  ⚠️  Ollama not running. Start with: ollama serve")
    
    # Check for required Python packages
    print("  📦 Checking Python packages...")
    required_packages = ["fastapi", "uvicorn", "sentence-transformers", "pyyaml"]
    for pkg in required_packages:
        rc, _, _ = run_command(f"python3 -c 'import {pkg.replace('-', '_')}'", check=False)
        if rc != 0:
            print(f"     Installing {pkg}...")
            run_command(f"pip install {pkg} --quiet")
        print(f"  ✅ {pkg}")
    
    return True


def generate_api_key():
    """Generate a secure API key."""
    alphabet = string.ascii_letters + string.digits
    key = "mg_" + ''.join(secrets.choice(alphabet) for _ in range(44))
    return key


def clone_mengram(install_dir):
    """Clone Mengram repository."""
    print(f"\n📥 Cloning Mengram to {install_dir}...")
    
    if install_dir.exists():
        print(f"  ⚠️  Directory {install_dir} already exists. Skipping clone.")
        return False
    
    rc, _, _ = run_command(
        f"git clone https://github.com/alibaizhanov/mengram.git {install_dir}",
        check=False
    )
    
    if rc != 0:
        print("  ❌ Failed to clone Mengram repository")
        return False
    
    print("  ✅ Mengram cloned successfully")
    return True


def create_config(install_dir, api_key, ollama_model):
    """Create configuration file."""
    print("\n📝 Creating configuration...")
    
    config_content = f"""# Mengram Configuration
# Generated: {datetime.now().isoformat()}

# Memory vault location
vault_path: "{install_dir}/vault"

# LLM Provider (ollama, openai, anthropic, openrouter)
llm:
  provider: "ollama"
  ollama:
    base_url: "http://localhost:11434"
    model: "{ollama_model}"

# Semantic search settings
semantic_search:
  enabled: true
  embedding_model: "{DEFAULT_EMBEDDING_MODEL}"

# Security settings
security:
  enabled: true
  api_keys_file: "{install_dir}/api_keys.json"

# Knowledge graph settings
graph:
  max_depth: 3
  min_relation_strength: 0.3
"""
    
    config_path = install_dir / "config.yaml"
    config_path.write_text(config_content)
    print(f"  ✅ Config created at {config_path}")
    
    return config_path


def create_vault(vault_dir):
    """Create the memory vault directory."""
    print("\n📁 Creating memory vault...")
    
    vault_dir.mkdir(parents=True, exist_ok=True)
    print(f"  ✅ Vault created at {vault_dir}")


def save_api_key(install_dir, api_key):
    """Save API key to keys file."""
    keys_file = install_dir / "api_keys.json"
    
    keys_data = {
        "keys": [
            {
                "key": api_key,
                "created": datetime.now().isoformat(),
                "description": "Primary API key - generated during setup"
            }
        ]
    }
    
    keys_file.write_text(json.dumps(keys_data, indent=2))
    print(f"  ✅ API key saved to {keys_file}")
    
    return keys_file


def create_security_module(install_dir):
    """Create the security middleware module."""
    print("\n🔐 Creating security module...")
    
    security_code = '''"""
Security middleware for Mengram API.
"""

import os
import json
import secrets
import string
from pathlib import Path
from typing import Optional
from functools import wraps

from fastapi import HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


security = HTTPBearer(auto_error=False)


class AuthConfig:
    """API key management."""
    
    def __init__(self, keys_file: str = None):
        self.keys_file = Path(keys_file or os.getenv("MENGRAM_KEYS_FILE", "api_keys.json"))
        self._keys = self._load_keys()
    
    def _load_keys(self) -> set:
        """Load API keys from file."""
        if not self.keys_file.exists():
            return set()
        
        with open(self.keys_file) as f:
            data = json.load(f)
        
        return {k["key"] for k in data.get("keys", [])}
    
    def is_valid_key(self, key: str) -> bool:
        """Check if API key is valid."""
        return key in self._keys
    
    def generate_key(self, description: str = "") -> str:
        """Generate a new API key."""
        alphabet = string.ascii_letters + string.digits
        key = "mg_" + ''.join(secrets.choice(alphabet) for _ in range(44))
        
        self._keys.add(key)
        self._save_keys()
        
        return key
    
    def _save_keys(self):
        """Save keys to file."""
        keys_data = {
            "keys": [
                {"key": k, "created": "unknown", "description": ""}
                for k in self._keys
            ]
        }
        with open(self.keys_file, "w") as f:
            json.dump(keys_data, f, indent=2)


def verify_auth(request: Request, config: AuthConfig) -> bool:
    """Verify authentication from request."""
    # Get Authorization header
    auth_header = request.headers.get("Authorization", "")
    
    if not auth_header.startswith("Bearer "):
        return False
    
    token = auth_header[7:].strip()
    return config.is_valid_key(token)


def require_auth(config: AuthConfig):
    """Decorator to require authentication."""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            if not verify_auth(request, config):
                raise HTTPException(
                    status_code=401,
                    detail="Unauthorized. Include: Authorization: Bearer <api_key>"
                )
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
'''
    
    security_path = install_dir / "api" / "security.py"
    security_path.parent.mkdir(parents=True, exist_ok=True)
    security_path.write_text(security_code)
    print(f"  ✅ Security module created at {security_path}")


def create_cli_tool(install_dir):
    """Create CLI tool for memory operations."""
    print("\n🛠️  Creating CLI tool...")
    
    cli_code = f'''#!/usr/bin/env python3
"""
Mengram CLI - Memory operations from command line.

Usage:
    python3 mengram.py status
    python3 mengram.py remember "text to remember"
    python3 mengram.py search "query"
    python3 mengram.py profile
"""

import os
import sys
import json
import urllib.request
import urllib.error

# Configuration
API_URL = os.getenv("MENGRAM_API_URL", "http://localhost:{DEFAULT_PORT}")
API_KEY = os.getenv("MENGRAM_API_KEY", "")


def api_call(endpoint: str, method: str = "GET", data: dict = None) -> dict:
    """Make an API call to Mengram."""
    url = f"{{API_URL}}{{endpoint}}"
    headers = {{
        "Content-Type": "application/json",
        "Authorization": f"Bearer {{API_KEY}}"
    }}
    
    if data:
        body = json.dumps(data).encode("utf-8")
    else:
        body = None
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        return {{"error": str(e), "body": error_body}}
    except Exception as e:
        return {{"error": str(e)}}


def cmd_status():
    """Check system status."""
    result = api_call("/api/health")
    print(json.dumps(result, indent=2))
    
    stats = api_call("/api/stats")
    if "error" not in stats:
        print("\\n📊 Vault Stats:")
        print(f"  Entities: {{stats.get('vault', {{}}).get('total_notes', 0)}}")
        print(f"  Relations: {{stats.get('graph', {{}}).get('total_relations', 0)}}")


def cmd_remember(text: str):
    """Save text to memory."""
    result = api_call("/api/remember/text", method="POST", data={{"text": text}})
    print(json.dumps(result, indent=2))


def cmd_search(query: str, top_k: int = 5):
    """Search memories."""
    result = api_call("/api/search", method="POST", data={{"query": query, "top_k": top_k}})
    
    if "results" in result:
        for r in result["results"]:
            print(f"\\n### {{r['entity']}} ({{r['type']}}) [score: {{r['score']:.3f}}]")
            for fact in r.get("facts", [])[:5]:
                print(f"  - {{fact}}")
    else:
        print(json.dumps(result, indent=2))


def cmd_profile():
    """Get user knowledge profile."""
    result = api_call("/api/profile")
    print(result.get("profile", json.dumps(result, indent=2)))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "status":
        cmd_status()
    elif command == "remember":
        if len(sys.argv) < 3:
            print("Usage: mengram.py remember <text>")
            sys.exit(1)
        cmd_remember(" ".join(sys.argv[2:]))
    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: mengram.py search <query>")
            sys.exit(1)
        cmd_search(" ".join(sys.argv[2:]))
    elif command == "profile":
        cmd_profile()
    else:
        print(f"Unknown command: {{command}}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
'''
    
    cli_path = install_dir / "scripts" / "mengram.py"
    cli_path.parent.mkdir(parents=True, exist_ok=True)
    cli_path.write_text(cli_code)
    cli_path.chmod(0o755)
    print(f"  ✅ CLI tool created at {cli_path}")


def create_service_script(install_dir, port):
    """Create a service management script."""
    print("\n🚀 Creating service script...")
    
    service_code = f'''#!/bin/bash
# Mengram Service Manager

INSTALL_DIR="{install_dir}"
PORT={port}
LOG_FILE="/dev/shm/mengram-api.log"
ERR_LOG="/dev/shm/mengram-api_err.log"

case "$1" in
    start)
        echo "Starting Mengram API on port $PORT..."
        cd "$INSTALL_DIR"
        nohup python3 -m api.rest_server config.yaml \\
            --port $PORT \\
            > "$LOG_FILE" 2> "$ERR_LOG" &
        sleep 2
        curl -s http://localhost:$PORT/api/health && echo " ✅ Started" || echo " ❌ Failed to start"
        ;;
    stop)
        echo "Stopping Mengram API..."
        pkill -f "api.rest_server config.yaml" || true
        echo " ✅ Stopped"
        ;;
    restart)
        $0 stop
        sleep 1
        $0 start
        ;;
    status)
        if curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
            echo "Mengram API is running on port $PORT"
            curl -s http://localhost:$PORT/api/health | python3 -m json.tool
        else
            echo "Mengram API is not running"
        fi
        ;;
    logs)
        echo "=== STDOUT ==="
        tail -50 "$LOG_FILE"
        echo ""
        echo "=== STDERR ==="
        tail -50 "$ERR_LOG"
        ;;
    *)
        echo "Usage: $0 {{start|stop|restart|status|logs}}"
        exit 1
        ;;
esac
'''
    
    service_path = install_dir / "scripts" / "service.sh"
    service_path.write_text(service_code)
    service_path.chmod(0o755)
    print(f"  ✅ Service script created at {service_path}")


def print_summary(install_dir, api_key, port):
    """Print setup summary."""
    print("\n" + "=" * 60)
    print("🎉 MENGRAM SETUP COMPLETE")
    print("=" * 60)
    
    print(f"""
📁 Installation Directory: {install_dir}
🧠 Memory Vault: {install_dir}/vault
⚙️  Configuration: {install_dir}/config.yaml
🔑 API Key: {api_key}
🌐 API URL: http://localhost:{port}

📋 NEXT STEPS:

1. Start Ollama (if not running):
   ollama serve &

2. Pull the LLM model:
   ollama pull llama3.2

3. Start the Mengram API:
   {install_dir}/scripts/service.sh start

4. Test the API:
   curl -s http://localhost:{port}/api/health

5. Add your first memory:
   curl -X POST http://localhost:{port}/api/remember/text \\
     -H "Content-Type: application/json" \\
     -H "Authorization: Bearer {api_key}" \\
     -d '{{"text": "Hello, this is my first memory!"}}'

📝 SAVE YOUR API KEY:
   MENGRAM_API_KEY={api_key}

   Add this to your Zo secrets or environment variables.
""")


def install(args):
    """Run the full installation."""
    print("🧠 Mengram Setup for Zo Computer")
    print("=" * 40)
    
    # Check prerequisites
    if not check_prerequisites():
        print("\n❌ Prerequisites check failed. Please install missing dependencies.")
        sys.exit(1)
    
    # Determine install directory
    install_dir = Path(args.install_dir) if args.install_dir else DEFAULT_INSTALL_DIR
    
    # Clone repository
    clone_mengram(install_dir)
    
    # Generate API key
    api_key = generate_api_key()
    
    # Create configuration
    create_config(install_dir, api_key, args.model)
    
    # Create vault
    vault_dir = install_dir / "vault"
    create_vault(vault_dir)
    
    # Save API key
    save_api_key(install_dir, api_key)
    
    # Create security module
    create_security_module(install_dir)
    
    # Create CLI tool
    create_cli_tool(install_dir)
    
    # Create service script
    create_service_script(install_dir, args.port)
    
    # Print summary
    print_summary(install_dir, api_key, args.port)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Mengram Setup for Zo Computer")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Install command
    install_parser = subparsers.add_parser("install", help="Install Mengram")
    install_parser.add_argument(
        "--install-dir",
        help=f"Installation directory (default: {DEFAULT_INSTALL_DIR})"
    )
    install_parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"API port (default: {DEFAULT_PORT})"
    )
    install_parser.add_argument(
        "--model",
        default=DEFAULT_OLLAMA_MODEL,
        help=f"Ollama model to use (default: {DEFAULT_OLLAMA_MODEL})"
    )
    
    args = parser.parse_args()
    
    if args.command == "install":
        install(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
