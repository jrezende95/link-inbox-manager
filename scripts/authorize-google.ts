import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { google } from "googleapis";

loadDotenv({ path: [".env.local", ".env"], quiet: true });

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const tokenPath = resolve(process.env.LINK_GOOGLE_TOKEN_PATH ?? ".link/google-oauth.json");
if (!clientId || !clientSecret) throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.");

const host = "127.0.0.1";
const server = createServer();
server.listen(0, host, async () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the local OAuth callback.");
  const redirectUri = `http://${host}:${address.port}/oauth2callback`;
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  console.log("Opening Google authorization in your browser. Approve only if you want unattended Sheet logging.");
  execFile("/usr/bin/open", [url]);

  server.on("request", async (request, response) => {
    try {
      const callback = new URL(request.url ?? "/", redirectUri);
      const code = callback.searchParams.get("code");
      if (!code) throw new Error(callback.searchParams.get("error") ?? "Authorization code was not returned.");
      const { tokens } = await client.getToken(code);
      if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Revoke the prior grant and run authorization again.");
      mkdirSync(dirname(tokenPath), { recursive: true, mode: 0o700 });
      writeFileSync(tokenPath, `${JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2)}\n`, { mode: 0o600 });
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Link Google Sheets authorization is complete. You can close this tab.");
      console.log(`Authorization saved locally at ${tokenPath}. The token was not printed.`);
      server.close();
    } catch (error) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Authorization failed. Return to the terminal for details.");
      console.error(error instanceof Error ? error.message : String(error));
      server.close();
      process.exitCode = 1;
    }
  });
});
