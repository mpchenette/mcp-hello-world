# FastMCP OAuth Hello World

A minimal FastMCP server that protects all tools behind a GitHub OAuth 2.1 proxy. The server exposes a single `ping` tool and is intentionally barebones so you can focus on the OAuth wiring.

## Prerequisites

- Python 3.12 (install with Homebrew: `brew install python@3.12`)
- Node.js 22.7+ for the MCP Inspector (get it from <https://nodejs.org/en/download/package-manager>)
- A GitHub OAuth App (create one at <https://github.com/settings/developers>)

## Setup

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then edit with your secrets
```

### Configure OAuth

1. Create (or edit) a GitHub **OAuth App**.
2. Set the **Homepage URL** to your server base URL (e.g. `http://localhost:8000`).
3. Set the **Authorization callback URL** to `<SERVER_BASE_URL>/auth/callback` (default `http://localhost:8000/auth/callback`).
4. Copy the **Client ID** and **Client Secret** into your `.env` file.
5. (Optional) Adjust scopes and allowed redirect URIs in `.env`.

## Run the server

```bash
source .venv/bin/activate
python -m app.server
```

The server listens on `http://127.0.0.1:8000` by default. Update `MCP_HOST`/`MCP_PORT` in `.env` if you need different values.

## Test with MCP Inspector

1. Start the inspector in another terminal:
   ```bash
   npx @modelcontextprotocol/inspector
   ```
2. Open `http://localhost:6274` in your browser.
3. Add a new MCP connection:
   - **Transport**: HTTP
   - **Server URL**: `http://127.0.0.1:8000/mcp`
4. During the first tool call you'll be redirected to GitHub to authorize. Approve the OAuth request and you will return to the inspector.
5. Invoke the `ping` tool to confirm you get a `"pong"` response.

## Environment variables

| Name | Description |
| --- | --- |
| `SERVER_NAME` | Friendly display name for the MCP server. |
| `SERVER_BASE_URL` | Public base URL used by FastMCP when constructing the OAuth callback. |
| `MCP_HOST` / `MCP_PORT` | Bind address and port for the HTTP server. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Credentials from your GitHub OAuth App. |
| `GITHUB_SCOPES` | Optional comma-separated scopes (default `user`). |
| `ALLOWED_REDIRECT_URIS` | Optional comma-separated list of allowed client redirect URIs. |

## Repository structure

- `app/server.py` — FastMCP server entrypoint and OAuth configuration.
- `.env.example` — Template of required configuration values.
- `docs/BUILD_STEPS.md` — Full build log for this setup.
