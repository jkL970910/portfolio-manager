import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const defaultWebRoot = path.join(rootDir, "apps", "mobile", "build", "web");
const webRoot = path.resolve(process.env.FLUTTER_WEB_ROOT ?? defaultWebRoot);
const port = Number(process.env.FLUTTER_WEB_PORT ?? process.argv[2] ?? "3001");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".otf", "font/otf"],
  [".ttf", "font/ttf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function safeFilePath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const decodedPath = decodeURIComponent(url.pathname);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.join(webRoot, normalizedPath);
  if (!candidate.startsWith(webRoot)) {
    return null;
  }
  return candidate;
}

function sendFile(filePath, request, response) {
  const extension = path.extname(filePath);
  const contentType = contentTypes.get(extension) ?? "application/octet-stream";
  const isIndex = path.basename(filePath) === "index.html";

  response.setHeader("content-type", contentType);
  response.setHeader("cache-control", "no-store");

  if (request.method === "HEAD") {
    response.statusCode = 200;
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    response.end("Method not allowed");
    return;
  }

  const requestedPath = safeFilePath(request.url ?? "/");
  if (requestedPath == null) {
    response.statusCode = 400;
    response.end("Bad request");
    return;
  }

  const filePath = fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
    ? requestedPath
    : path.join(webRoot, "index.html");

  if (!fs.existsSync(filePath)) {
    response.statusCode = 404;
    response.end("Flutter web build not found");
    return;
  }

  sendFile(filePath, request, response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Flutter web static preview: http://127.0.0.1:${port}`);
  console.log(`Serving: ${webRoot}`);
});
