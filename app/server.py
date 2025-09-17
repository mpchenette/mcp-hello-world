"""Barebones FastMCP server secured with GitHub OAuth via the OAuth Proxy."""

from __future__ import annotations

import os
from typing import Any

from fastmcp import FastMCP
from fastmcp.server.auth.providers.github import GitHubProvider
from fastmcp.server.dependencies import get_access_token


def create_server() -> FastMCP:
    """Instantiate the FastMCP server with GitHub OAuth protection."""
    server_name = os.getenv("MCP_SERVER_NAME", "Barebones FastMCP Server")

    # GitHubProvider reads required settings (client id, secret, base URL, etc.)
    # from FASTMCP_SERVER_AUTH_GITHUB_* environment variables.
    auth_provider = GitHubProvider()

    return FastMCP(name=server_name, auth=auth_provider)


mcp = create_server()


@mcp.tool
async def whoami() -> dict[str, Any]:
    """Return basic information about the authenticated GitHub user."""
    token = get_access_token()

    if token is None:
        return {
            "authenticated": False,
            "github_login": None,
            "name": None,
            "email": None,
        }

    claims = token.claims or {}

    return {
        "authenticated": True,
        "github_login": claims.get("login"),
        "name": claims.get("name"),
        "email": claims.get("email"),
    }


if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8000"))
    transport = os.getenv("MCP_TRANSPORT", "http")
    mcp.run(transport=transport, port=port)
