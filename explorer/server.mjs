import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.IRE_EXPLORER_PORT || 8080);
const rpcUrl = process.env.IRE_RPC_URL || "http://127.0.0.1:26657";
const apiUrl = process.env.IRE_API_URL || "http://127.0.0.1:1317";
const contentTypes = { ".css": "text/css", ".js": "text/javascript", ".html": "text/html" };

async function proxy(request, response, upstream) {
  try {
    const target = new URL(request.url.replace(/^\/(rpc|api)/, ""), upstream);
    const upstreamResponse = await fetch(target, { signal: AbortSignal.timeout(12_000) });
    response.writeHead(upstreamResponse.status, { "content-type": upstreamResponse.headers.get("content-type") ?? "application/json" });
    response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
  } catch {
    response.writeHead(502, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "The IRE node is unavailable." }));
  }
}

http.createServer(async (request, response) => {
  if (request.method !== "GET") return response.writeHead(405).end();
  if (request.url.startsWith("/rpc/")) return proxy(request, response, rpcUrl);
  if (request.url.startsWith("/api/")) return proxy(request, response, apiUrl);
  const relative = request.url === "/" ? "index.html" : request.url.slice(1);
  const file = path.resolve(directory, relative);
  if (!file.startsWith(directory)) return response.writeHead(403).end();
  try {
    const info = await stat(file);
    if (!info.isFile()) return response.writeHead(404).end();
    response.writeHead(200, { "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end(); }
}).listen(port, "127.0.0.1", () => console.log(`IRE Explorer: http://127.0.0.1:${port}`));
