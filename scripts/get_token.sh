#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--inspector]

Options:
  --inspector  Launch MCP Inspector using the retrieved access token.
  -h, --help   Show this help message.
USAGE
}

INSPECTOR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --inspector)
      INSPECTOR=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

CLIENT_ID="demo-client-id"
CLIENT_SECRET="demo-client-secret"
REDIRECT_URI="http://127.0.0.1:5173/oauth/callback"
AUTH_URL="http://127.0.0.1:4101/authorize"
TOKEN_URL="http://127.0.0.1:4101/token"
INSPECTOR_URL="http://127.0.0.1:4100/mcp"

if [[ $INSPECTOR -eq 1 ]] && ! command -v npx >/dev/null 2>&1; then
  echo 'npx is required to launch MCP Inspector. Install Node.js >= 18.' >&2
  exit 1
fi

VERIFIER=$(openssl rand -base64 64 | tr '+/' '-_' | tr -d '=' | cut -c1-86)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 | openssl base64 -e | tr '+/' '-_' | tr -d '=')

encoded_redirect=$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$REDIRECT_URI")
state=$(openssl rand -hex 8)

auth_query="client_id=${CLIENT_ID}&redirect_uri=${encoded_redirect}&response_type=code&scope=profile%20email&state=${state}&code_challenge_method=S256&code_challenge=${CHALLENGE}"

cat <<INFO
PKCE verifier: $VERIFIER
PKCE challenge: $CHALLENGE

Authorize URL:
  ${AUTH_URL}?${auth_query}

After visiting the URL and completing the authorization flow, paste the 'code' parameter below.
INFO

read -r -p "Authorization code: " AUTH_CODE

if [[ -z "$AUTH_CODE" ]]; then
  echo "No authorization code provided." >&2
  exit 1
fi

response=$(curl -sS -X POST "$TOKEN_URL" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=authorization_code" \
  -d "code=${AUTH_CODE}" \
  -d "redirect_uri=${REDIRECT_URI}" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "code_verifier=${VERIFIER}")

access_token=$(python3 -c 'import json, sys
try:
    data = json.loads(sys.stdin.read())
except json.JSONDecodeError:
    print("", end="")
else:
    print(data.get("access_token", ""), end="")
' <<<"$response")

echo
echo "Token response:"; echo "$response"

echo
if [[ -n "$access_token" ]]; then
  echo "Access token: $access_token"
  if [[ "$INSPECTOR" -eq 1 ]]; then
    echo
    echo "Starting MCP Inspector..."
    npx @modelcontextprotocol/inspector \
      --transport http \
      --server-url "$INSPECTOR_URL" \
      --header "Authorization: $access_token"
  fi
else
  echo "Access token not found in response." >&2
  exit 1
fi
