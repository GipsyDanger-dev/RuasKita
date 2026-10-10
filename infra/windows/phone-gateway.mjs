// Temporary password boundary for phone testing, not application user accounts.
import http from "node:http";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";

const configPath = process.argv[2];
if (!configPath) throw new Error("Pass the private runtime credential file.");
const authenticate = (header, password) => {
  const expected = Buffer.from(`Basic ${Buffer.from(`ruaskita:${password}`).toString("base64")}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
const gateway = http.createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  let config;
  try { config = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, "")); }
  catch { response.writeHead(503); response.end("Phone preview unavailable."); return; }
  if (!config.password || !authenticate(request.headers.authorization, config.password)) {
    response.writeHead(401, { "WWW-Authenticate": 'Basic realm="RuasKita phone preview", charset="UTF-8"' });
    response.end("Password diperlukan untuk pratinjau RuasKita."); return;
  }
  const origins = ["http://127.0.0.1:3080", "http://localhost:3080", config.origin].filter(Boolean);
  if (!["GET", "HEAD"].includes(request.method) && (!origins.includes(request.headers.origin))) {
    response.writeHead(403); response.end("Origin not allowed."); return;
  }
  if (!request.url?.startsWith("/") || request.url.startsWith("//")) {
    response.writeHead(400); response.end(); return;
  }
  const headers = { ...request.headers, host: "127.0.0.1:3000" };
  for (const key of Object.keys(headers)) {
    if (key === "authorization" || key === "forwarded" || key.startsWith("x-forwarded-") || key.startsWith("cf-")) delete headers[key];
  }
  // Only after same-origin validation above: the loopback API trusts this gateway.
  if (request.headers.origin) headers.origin = "http://127.0.0.1:3000";
  const upstream = http.request({ hostname: "127.0.0.1", port: 3000, path: request.url,
    method: request.method, headers, timeout: 120000 }, (result) => {
    response.writeHead(result.statusCode ?? 502, { ...result.headers, "cache-control": "no-store" });
    result.pipe(response);
  });
  let bytes = 0;
  request.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > 11 * 1024 * 1024) {
      upstream.destroy();
      if (!response.headersSent) response.writeHead(413);
      response.end("Upload too large.");
    }
  });
  upstream.on("timeout", () => upstream.destroy(new Error("Upstream timeout")));
  upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end("Local server unavailable."); });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
});
gateway.listen(3080, "127.0.0.1", () => console.log("Password-protected phone gateway on loopback :3080"));
