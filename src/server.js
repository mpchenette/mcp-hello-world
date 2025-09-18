import express from "express";
import { randomUUID } from "node:crypto";
import { FastMCP } from "fastmcp";
import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";

const FASTMCP_PORT = Number(process.env.FASTMCP_PORT ?? 4100);
const OAUTH_PROXY_PORT = Number(process.env.OAUTH_PROXY_PORT ?? 4101);
const UPSTREAM_PORT = Number(process.env.UPSTREAM_PORT ?? 4102);

const DEMO_CLIENT = {
  client_id: "demo-client-id",
  client_secret: "demo-client-secret",
  redirect_uris: [
    "http://localhost:5173/oauth/callback",
    "http://127.0.0.1:5173/oauth/callback",
  ],
  scope: "profile email",
};

const authorizationCodes = new Map();
const accessTokens = new Map();

function startUpstreamOAuthServer() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get("/oauth/authorize", (req, res) => {
    const { client_id, redirect_uri, state } = req.query;
    if (client_id !== DEMO_CLIENT.client_id) {
      res.status(400).json({ error: "invalid_client" });
      return;
    }

    const redirectUri = typeof redirect_uri === "string" ? redirect_uri : DEMO_CLIENT.redirect_uris[0];
    if (!DEMO_CLIENT.redirect_uris.includes(redirectUri)) {
      res.status(400).json({ error: "invalid_request", error_description: "Unknown redirect_uri" });
      return;
    }

    const code = randomUUID();
    authorizationCodes.set(code, {
      clientId: DEMO_CLIENT.client_id,
      scopes: typeof req.query.scope === "string" ? req.query.scope.split(/\s+/) : DEMO_CLIENT.scope.split(" "),
      userId: "demo-user",
      email: "demo-user@example.com",
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (typeof state === "string") {
      redirectUrl.searchParams.set("state", state);
    }

    res.redirect(redirectUrl.toString());
  });

  app.post("/oauth/token", (req, res) => {
    const { grant_type, code, client_id, client_secret } = req.body ?? {};
    if (client_id !== DEMO_CLIENT.client_id || client_secret !== DEMO_CLIENT.client_secret) {
      res.status(400).json({ error: "invalid_client" });
      return;
    }

    if (grant_type !== "authorization_code") {
      res.status(400).json({ error: "unsupported_grant_type" });
      return;
    }

    const entry = typeof code === "string" ? authorizationCodes.get(code) : undefined;
    if (!entry || entry.expiresAt < Date.now()) {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    authorizationCodes.delete(code);

    const accessToken = randomUUID();
    accessTokens.set(accessToken, {
      clientId: entry.clientId,
      scopes: entry.scopes,
      userId: entry.userId,
      email: entry.email,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: entry.scopes.join(" "),
    });
  });

  return new Promise((resolve) => {
    const server = app.listen(UPSTREAM_PORT, "127.0.0.1", () => {
      console.log(`[upstream] http://127.0.0.1:${UPSTREAM_PORT}`);
      resolve({ server });
    });
  });
}

function verifyAccessToken(token) {
  const entry = accessTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    throw new Error("invalid_token");
  }

  return {
    token,
    clientId: entry.clientId,
    scopes: entry.scopes,
    expiresAt: Math.floor(entry.expiresAt / 1000),
    extra: {
      userId: entry.userId,
      email: entry.email,
    },
  };
}

function getClient(clientId) {
  if (clientId !== DEMO_CLIENT.client_id) {
    return undefined;
  }

  return {
    ...DEMO_CLIENT,
    token_endpoint_auth_method: "client_secret_post",
    grant_types: ["authorization_code"],
    response_types: ["code"],
  };
}

async function startOAuthProxy() {
  const provider = new ProxyOAuthServerProvider({
    endpoints: {
      authorizationUrl: `http://127.0.0.1:${UPSTREAM_PORT}/oauth/authorize`,
      tokenUrl: `http://127.0.0.1:${UPSTREAM_PORT}/oauth/token`,
    },
    verifyAccessToken: async (token) => verifyAccessToken(token),
    getClient: async (clientId) => getClient(clientId),
  });

  const app = express();
  app.use(mcpAuthRouter({
    provider,
    issuerUrl: new URL(`http://127.0.0.1:${OAUTH_PROXY_PORT}`),
    baseUrl: new URL(`http://127.0.0.1:${OAUTH_PROXY_PORT}`),
    scopesSupported: ["profile", "email"],
    resourceName: "Demo MCP Server",
  }));

  return new Promise((resolve) => {
    const server = app.listen(OAUTH_PROXY_PORT, "127.0.0.1", () => {
      console.log(`[oauth-proxy] http://127.0.0.1:${OAUTH_PROXY_PORT}`);
      resolve({ provider, server });
    });
  });
}

async function startFastMcpServer(provider) {
  const issuer = new URL(`http://127.0.0.1:${OAUTH_PROXY_PORT}`);

  const server = new FastMCP({
    name: "Demo MCP Server",
    version: "0.0.1",
    oauth: {
      enabled: true,
      authorizationServer: {
        issuer: issuer.href,
        authorizationEndpoint: new URL("/authorize", issuer).href,
        tokenEndpoint: new URL("/token", issuer).href,
        responseTypesSupported: ["code"],
        grantTypesSupported: ["authorization_code"],
        codeChallengeMethodsSupported: ["S256"],
        tokenEndpointAuthMethodsSupported: ["client_secret_post"],
        scopesSupported: ["profile", "email"],
      },
      protectedResource: {
        resource: "mcp://demo-mcp-server",
        authorizationServers: [issuer.href],
        scopesSupported: ["profile", "email"],
      },
    },
    authenticate: async (request) => {
      const authHeader = request?.headers?.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        throw new Response(null, {
          status: 401,
          statusText: "Missing Bearer token",
        });
      }

      try {
        const authInfo = await provider.verifyAccessToken(authHeader.slice(7));
        return {
          clientId: authInfo.clientId,
          scopes: authInfo.scopes,
          userId: typeof authInfo.extra?.userId === "string" ? authInfo.extra.userId : authInfo.clientId,
          email: typeof authInfo.extra?.email === "string" ? authInfo.extra.email : undefined,
        };
      } catch (error) {
        throw new Response(null, {
          status: 401,
          statusText: "Invalid Bearer token",
        });
      }
    },
  });

  server.addTool({
    name: "whoami",
    description: "Return basic info about the authenticated session",
    execute: async (_args, context) => {
      const session = context.session;
      if (!session) {
        return { content: [{ type: "text", text: "No session found." }] };
      }

      const lines = [
        `userId: ${session.userId}`,
        `clientId: ${session.clientId}`,
        `scopes: ${session.scopes.join(", ")}`,
      ];
      if (session.email) {
        lines.push(`email: ${session.email}`);
      }

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      };
    },
  });

  await server.start({
    transportType: "httpStream",
    httpStream: {
      host: "127.0.0.1",
      port: FASTMCP_PORT,
      endpoint: "/mcp",
    },
  });

  console.log(`[fastmcp] http://127.0.0.1:${FASTMCP_PORT}/mcp`);
  return server;
}

async function main() {
  const { server: upstreamServer } = await startUpstreamOAuthServer();
  const { provider, server: proxyServer } = await startOAuthProxy();
  const fastmcpServer = await startFastMcpServer(provider);

  console.log("\nDemo client credentials:");
  console.log(`  client_id: ${DEMO_CLIENT.client_id}`);
  console.log(`  client_secret: ${DEMO_CLIENT.client_secret}`);
  console.log(`  redirect_uri: ${DEMO_CLIENT.redirect_uris[0]}`);

  const shutdown = () => {
    console.log("\nShutting down...");
    proxyServer.close(() => console.log("[oauth-proxy] stopped"));
    upstreamServer.close(() => console.log("[upstream] stopped"));
    fastmcpServer.stop?.();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Failed to start demo", error);
  process.exit(1);
});
