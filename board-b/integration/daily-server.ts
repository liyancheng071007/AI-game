import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import {
  createDailyService,
  createFetchHandler,
} from "@attention/daily";
import { AtomicJsonDailyVoteStore } from "@attention/daily/node";
import { validateLevelPackage } from "@attention/schema";

const packagePath = resolve("levels/draft/levels.json");
const raw = JSON.parse(await readFile(packagePath, "utf8")) as unknown;
const validation = validateLevelPackage(raw, "draft");
if (!validation.ok) {
  throw new Error(JSON.stringify(validation.errors, null, 2));
}

const store = new AtomicJsonDailyVoteStore(
  resolve(".cache/daily-votes.json"),
);
const service = createDailyService({
  levels: validation.value.levels,
  store,
  allowDraft: true,
});
const handler = createFetchHandler(service);

async function bodyFor(request: IncomingMessage): Promise<string | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function respond(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const host = request.headers.host ?? "127.0.0.1";
  const init: RequestInit = {
    method: request.method ?? "GET",
    headers: Object.entries(request.headers).flatMap(([key, value]) =>
      value === undefined
        ? []
        : [[key, Array.isArray(value) ? value.join(",") : value]],
    ),
  };
  const body = await bodyFor(request);
  if (body) init.body = body;
  const fetchRequest = new Request(`http://${host}${request.url ?? "/"}`, init);
  const fetchResponse = await handler(fetchRequest);
  response.statusCode = fetchResponse.status;
  fetchResponse.headers.forEach((value, key) => response.setHeader(key, value));
  response.end(Buffer.from(await fetchResponse.arrayBuffer()));
}

const port = Number(process.env.PORT ?? 8787);
const server = createServer((request, response) => {
  void respond(request, response).catch((error: unknown) => {
    console.error(error);
    response.statusCode = 500;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "示例服务器内部错误" }));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`每日一题示例：http://127.0.0.1:${port}/api/daily`);
  console.log("当前使用 draft 数据，仅限本机开发。");
});
