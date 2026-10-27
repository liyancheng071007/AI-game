import {
  DailyRequestError,
  type DailyService,
} from "./service.js";
import { validateDailyVoteRequest } from "@attention/schema";

export const DAILY_API_BASE = "/api/daily";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function failure(error: unknown): Response {
  if (error instanceof DailyRequestError) {
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }
  console.error(error);
  return json(
    { error: { code: "INTERNAL_ERROR", message: "服务暂时不可用" } },
    500,
  );
}

export function createFetchHandler(
  service: DailyService,
  basePath = DAILY_API_BASE,
): (request: Request) => Promise<Response> {
  const normalizedBase = basePath.replace(/\/$/, "");
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, "");

      if (path === normalizedBase) {
        if (request.method !== "GET") {
          return json(
            { error: { code: "METHOD_NOT_ALLOWED", message: "只支持 GET" } },
            405,
          );
        }
        const date = url.searchParams.get("date") ?? undefined;
        return json(service.getQuestion(date));
      }

      const voteMatch = new RegExp(
        `^${normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/]+)/votes$`,
      ).exec(path);
      if (voteMatch) {
        if (request.method !== "POST") {
          return json(
            { error: { code: "METHOD_NOT_ALLOWED", message: "只支持 POST" } },
            405,
          );
        }
        const questionId = decodeURIComponent(voteMatch[1]!);
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          throw new DailyRequestError(422, "INVALID_JSON", "请求体必须是 JSON");
        }
        const schemaValidation = validateDailyVoteRequest(body);
        if (!schemaValidation.ok) {
          throw new DailyRequestError(
            422,
            "INVALID_BODY",
            "请求体必须包含 1 到 4 个不同的 tokenIndices 整数",
          );
        }
        return json(
          await service.recordVote(
            questionId,
            schemaValidation.value.tokenIndices,
          ),
          201,
        );
      }

      const resultsMatch = new RegExp(
        `^${normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/]+)/results$`,
      ).exec(path);
      if (resultsMatch) {
        if (request.method !== "GET") {
          return json(
            { error: { code: "METHOD_NOT_ALLOWED", message: "只支持 GET" } },
            405,
          );
        }
        return json(
          await service.getResults(decodeURIComponent(resultsMatch[1]!)),
        );
      }

      return json(
        { error: { code: "NOT_FOUND", message: "接口不存在" } },
        404,
      );
    } catch (error) {
      return failure(error);
    }
  };
}
