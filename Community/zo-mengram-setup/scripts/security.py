#!/usr/bin/env python3
"""
Security module for Mengram API.

Provides API key authentication for all endpoints.

API keys are loaded from environment variables (best practice):
  - MENGRAM_API_KEY: Primary key (supports comma-separated for multiple keys)
  - ZO_API_KEY: Cross-system auth with Zo

On Zo Computer, store keys via Settings > Advanced > Secrets.
"""

import os
import secrets
from typing import Optional, Set
from functools import wraps

try:
    from fastapi import HTTPException, Request
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False


class AuthConfig:
    """API key management for Mengram."""

    def __init__(self):
        """
        Initialize auth configuration from environment variables.

        Reads:
          MENGRAM_API_KEY - comma-separated API keys
          ZO_API_KEY - optional cross-system auth
          MENGRAM_REQUIRE_AUTH - "true" (default) or "false"
          MENGRAM_ALLOW_LOCALHOST - "false" (default) or "true"
        """
        self.require_auth = os.environ.get(
            "MENGRAM_REQUIRE_AUTH", "true"
        ).lower() == "true"
        self.allow_localhost = os.environ.get(
            "MENGRAM_ALLOW_LOCALHOST", "false"
        ).lower() == "true"

        # Load API keys from environment
        env_key = os.environ.get("MENGRAM_API_KEY", "")
        self._keys: Set[str] = set(
            k.strip() for k in env_key.split(",") if k.strip()
        )

        # Also accept Zo API key for cross-system auth
        zo_key = os.environ.get("ZO_API_KEY", "")
        if zo_key:
            self._keys.add(zo_key)

    def is_valid_key(self, key: str) -> bool:
        """Check if an API key is valid."""
        if not key:
            return False
        return key in self._keys

    def is_configured(self) -> bool:
        """Check if any API keys are configured."""
        return len(self._keys) > 0

    @staticmethod
    def generate_key() -> str:
        """
        Generate a new secure API key.

        Returns:
            API key in format: mg_<43 url-safe chars>
        """
        return f"mg_{secrets.token_urlsafe(32)}"


def get_client_ip(request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip.strip()

    if hasattr(request, "client") and request.client:
        return request.client.host

    return "unknown"


def is_localhost(ip: str) -> bool:
    """Check if IP is localhost."""
    localhost_ips = {"127.0.0.1", "::1", "localhost", "0.0.0.0"}
    return ip in localhost_ips or ip.startswith("::ffff:127.")


def verify_auth(request, config: AuthConfig) -> tuple[bool, str]:
    """
    Verify authentication from a request.

    Returns:
        (is_valid, error_message)
    """
    if not config.require_auth:
        return True, ""

    if config.allow_localhost:
        client_ip = get_client_ip(request)
        if is_localhost(client_ip):
            return True, ""

    if not config.is_configured():
        return False, (
            "Server misconfiguration: no API keys set. "
            "Set MENGRAM_API_KEY environment variable."
        )

    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return False, (
            "Missing Authorization header. "
            "Include: Authorization: Bearer <api_key>"
        )

    if not auth_header.startswith("Bearer "):
        return False, "Invalid Authorization header format. Use: Bearer <api_key>"

    token = auth_header[7:].strip()

    if config.is_valid_key(token):
        return True, ""

    return False, "Invalid API key"


def get_auth_dependency(config: AuthConfig):
    """
    Create a FastAPI dependency for authentication.

    Usage:
        auth_config = AuthConfig()
        auth_dep = get_auth_dependency(auth_config)

        @app.get("/protected")
        async def protected_route(auth: bool = Depends(auth_dep)):
            return {"message": "authenticated"}
    """
    from fastapi import Depends
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

    security = HTTPBearer(auto_error=False)

    async def auth_dependency(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ) -> bool:
        if credentials is None:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Missing Authorization header. "
                    "Include: Authorization: Bearer <api_key>"
                ),
            )

        if not config.is_valid_key(credentials.credentials):
            raise HTTPException(status_code=401, detail="Invalid API key")

        return True

    return auth_dependency


def create_auth_middleware(config: Optional[AuthConfig] = None):
    """Create ASGI middleware for authentication."""
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import JSONResponse

    config = config or AuthConfig()

    PUBLIC_PATHS = {"/api/health", "/", "/docs", "/openapi.json", "/favicon.ico"}

    class AuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            if request.url.path in PUBLIC_PATHS:
                return await call_next(request)

            if request.url.path.startswith("/static/"):
                return await call_next(request)

            is_valid, error = verify_auth(request, config)
            if not is_valid:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Unauthorized", "detail": error},
                )

            return await call_next(request)

    return AuthMiddleware


def main():
    """CLI for managing API keys."""
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  security.py generate          Generate a new API key")
        print("  security.py verify <key>       Verify a key is configured")
        print("  security.py check              Check if auth is configured")
        sys.exit(1)

    command = sys.argv[1]
    config = AuthConfig()

    if command == "generate":
        key = config.generate_key()
        print(f"Generated API key: {key}")
        print()
        print("Store this key securely. On Zo Computer:")
        print("  Settings > Advanced > Secrets > Add MENGRAM_API_KEY")
        print()
        print("Or export in your shell:")
        print(f"  export MENGRAM_API_KEY={key}")

    elif command == "verify":
        if len(sys.argv) < 3:
            print("Usage: security.py verify <key>")
            sys.exit(1)
        key = sys.argv[2]
        if config.is_valid_key(key):
            print("Valid API key")
        else:
            print("Invalid API key")

    elif command == "check":
        print(f"Auth required: {config.require_auth}")
        print(f"Localhost bypass: {config.allow_localhost}")
        print(f"Keys configured: {config.is_configured()} ({len(config._keys)} keys)")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
