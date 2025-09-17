"""Barebones FastMCP server with GitHub OAuth 2.1 proxy."""

from __future__ import annotations

import os
from typing import List, Optional

from dotenv import load_dotenv
from fastmcp import FastMCP
from fastmcp.server.auth.providers.github import GitHubProvider

load_dotenv()


def _get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}."
            " Set it in your .env file or shell before starting the server."
        )
    return value


def _get_optional_list(name: str) -> Optional[List[str]]:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return None
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _get_optional_scopes(name: str) -> Optional[List[str]]:
    return _get_optional_list(name)


def build_auth_provider() -> GitHubProvider:
    """Configure the GitHub OAuth proxy using environment variables."""

    allowed_redirects = _get_optional_list("ALLOWED_REDIRECT_URIS")
    scopes = _get_optional_scopes("GITHUB_SCOPES")

    kwargs: dict[str, object] = {}
    if allowed_redirects:
        kwargs["allowed_client_redirect_uris"] = allowed_redirects
    if scopes:
        kwargs["required_scopes"] = scopes

    return GitHubProvider(
        client_id=_get_required_env("GITHUB_CLIENT_ID"),
        client_secret=_get_required_env("GITHUB_CLIENT_SECRET"),
        base_url=_get_required_env("SERVER_BASE_URL"),
        **kwargs,
    )


mcp = FastMCP(
    name=os.getenv("SERVER_NAME", "FastMCP OAuth Demo"),
    auth=build_auth_provider(),
)


@mcp.tool
def ping() -> str:
    """Return a static response so clients can confirm connectivity."""

    return "pong"


def main() -> None:
    """Start the FastMCP HTTP server."""

    host = os.getenv("MCP_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_PORT", "8000"))

    # HTTP transport is required for OAuth flows handled by FastMCP.
    mcp.run(transport="http", host=host, port=port)


if __name__ == "__main__":
    main()
