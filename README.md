# mcp-hello-world

This repository contains a barebones [FastMCP](https://gofastmcp.com/) server that exposes a single `whoami` tool and enforces GitHub OAuth 2.1 authentication through FastMCP's OAuth Proxy.

## Prerequisites

- Python 3.11+
- GitHub OAuth application credentials (Client ID and Client Secret)

## Setup

1. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Copy the example environment file and fill in your GitHub OAuth details:
   ```bash
   cp .env.example .env
   ```
3. Export the environment variables before running the server:
   ```bash
   set -a
   source .env
   set +a
   ```

## Running the server

Start the HTTP transport (required for OAuth redirect flows):

```bash
fastmcp run app/server.py:mcp --transport http --port 8000
```

Once running, connect with an MCP-compatible client that supports OAuth (for example the FastMCP client) and invoke the `whoami` tool to confirm the authenticated GitHub identity.

## Configuration

Key environment variables:

- `MCP_SERVER_NAME` – optional display name for the server (default: `Barebones FastMCP Server`)
- `MCP_PORT` – port exposed by the HTTP transport (default: `8000`)
- `FASTMCP_SERVER_AUTH_GITHUB_CLIENT_ID` – GitHub OAuth app client ID (required)
- `FASTMCP_SERVER_AUTH_GITHUB_CLIENT_SECRET` – GitHub OAuth app client secret (required)
- `FASTMCP_SERVER_AUTH_GITHUB_BASE_URL` – public base URL for OAuth callbacks (required; use `http://localhost:8000` for local development)
- `FASTMCP_SERVER_AUTH_GITHUB_REDIRECT_PATH` – optional callback path override (default: `/auth/callback`)

Refer to [FastMCP's OAuth Proxy guide](https://gofastmcp.com/servers/auth/oauth-proxy) for full configuration details.
