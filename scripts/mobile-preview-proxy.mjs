import http from "node:http";
import { Readable } from "node:stream";

const port = Number(process.env.MOBILE_PREVIEW_PROXY_PORT ?? "3010");
const flutterOrigin = process.env.MOBILE_FLUTTER_ORIGIN ?? "http://127.0.0.1:3001";
const apiOrigin = process.env.MOBILE_API_ORIGIN ?? "http://127.0.0.1:3000";

function targetFor(url) {
  return url.startsWith("/api/") ? apiOrigin : flutterOrigin;
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = request.url ?? "/";
    const target = new URL(requestUrl, targetFor(requestUrl));
    const headers = { ...request.headers };
    delete headers.host;

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request,
      duplex: "half",
      redirect: "manual",
    });

    response.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      response.setHeader(key, value);
    });

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(response);
    } else {
      response.end();
    }
  } catch (error) {
    response.statusCode = 502;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end(error instanceof Error ? error.message : "Mobile preview proxy failed.");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Mobile preview proxy: http://127.0.0.1:${port}`);
  console.log(`  /api/* -> ${apiOrigin}`);
  console.log(`  /*     -> ${flutterOrigin}`);
});
