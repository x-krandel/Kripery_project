// Production server for Azure App Service (Node): `npm start` after `npm run build`.
// No dependencies, so it runs from the deployed package without `npm install`.
// - serves dist/ and falls back to index.html for client-side routes (/dziela/1, /logowanie…)
// - /env.js carries runtime settings: set API_URL in the App Service configuration to point
//   the app at the backend without rebuilding (it overrides VITE_API_URL from the build)
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("./dist", import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const API_URL = (process.env.API_URL || "").replace(/\/$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function fileAt(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const full = join(DIST, rel);
  if (full !== DIST && !full.startsWith(DIST + sep)) return null; // no ../ escapes
  try {
    const s = await stat(full);
    return s.isFile() ? full : null;
  } catch {
    return null;
  }
}

function send(res, path, cache) {
  res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream", "Cache-Control": cache });
  createReadStream(path).pipe(res);
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  if (pathname === "/env.js" && API_URL) {
    res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-cache" });
    res.end(`window.__RODOWOD__ = { apiUrl: ${JSON.stringify(API_URL)} };\n`);
    return;
  }
  const file = await fileAt(pathname);
  if (file) {
    send(res, file, pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    return;
  }
  if (extname(pathname)) {
    res.writeHead(404, { "Content-Type": TYPES[".txt"] }).end("Not found");
    return;
  }
  send(res, join(DIST, "index.html"), "no-cache"); // SPA route
}).listen(PORT, () => {
  console.log(`Rodowód frontend on :${PORT}, API ${API_URL || "(from build: VITE_API_URL)"}`);
});
