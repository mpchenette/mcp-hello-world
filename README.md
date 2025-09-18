# mcp-hello-world

This project contains a minimal [FastMCP](https://gofastmcp.com/getting-started/welcome) server that advertises OAuth 2.1 discovery metadata and authenticates incoming requests with a proxy authorization server.

## Requirements

- Node.js 20+

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

The script launches three services on `127.0.0.1`:

- Upstream OAuth server: `http://127.0.0.1:4102`
- OAuth proxy (authorization server + discovery): `http://127.0.0.1:4101`
- FastMCP HTTP streaming endpoint: `http://127.0.0.1:4100/mcp`

Demo OAuth client credentials are printed on startup. The default redirect URIs are
- http://localhost:5173/oauth/callback
- http://127.0.0.1:5173/oauth/callback

To integrate with a client, complete the OAuth authorization code flow against the proxy and include the issued Bearer access token in requests to the FastMCP server.

```bash
./scripts/get_token.sh             # prints authorize URL, prompts for code, displays token
./scripts/get_token.sh --inspector # same, then launches MCP Inspector with the token
```

YOU WILL NEED TO MANUALLY COPY AND PASTE THE BEARER TOKEN INTO THE INSPECTOR WEB UI.

Press `Ctrl+C` to stop all services.
