import type { Level } from "@attention/schema";
import type { DailyVoteStore, VoteSnapshot } from "./store.js";

export interface DailyQuestion {
  id: string;
  date: string;
  level: Level;
}

export interface DailyServiceOptions {
  levels: readonly Level[];
  store: DailyVoteStore;
  allowDraft?: boolean;
  now?: () => Date;
}

export interface DailyResult extends VoteSnapshot {
  tokens: Array<{
    tokenIndex: number;
    token: string;
    count: number;
  }>;
}

export class DailyRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "DailyRequestError";
    this.status = status;
    this.code = code;
  }
}

export class NoEligibleDailyQuestionsError extends Error {
  constructor() {
    super(
      "没有可用于每日一题的 approved 关卡；开发时请显式设置 allowDraft=true",
    );
    this.name = "NoEligibleDailyQuestionsError";
  }
}

const SHANGHAI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function shanghaiDate(date = new Date()): string {
  return SHANGHAI_DATE.format(date);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function questionIdFor(date: string, levelId: string): string {
  return `daily-${date.replaceAll("-", "")}-${levelId}`;
}

function dateAndLevelFromId(questionId: string): {
  date: string;
  levelId: string;
} {
  const match = /^daily-(\d{4})(\d{2})(\d{2})-(.+)$/.exec(questionId);
  if (!match) {
    throw new DailyRequestError(404, "QUESTION_NOT_FOUND", "题目不存在");
  }
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    levelId: match[4]!,
  };
}

export function createDailyService(options: DailyServiceOptions) {
  const allowDraft = options.allowDraft ?? false;
  const now = options.now ?? (() => new Date());
  const eligibleLevels = options.levels
    .filter(
      (level) =>
        allowDraft || level.review.status === "approved",
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  if (eligibleLevels.length === 0) {
    throw new NoEligibleDailyQuestionsError();
  }

  const levelsById = new Map(eligibleLevels.map((level) => [level.id, level]));

  function chooseLevel(date: string): Level {
    let winner = eligibleLevels[0]!;
    let winnerHash = fnv1a(`${date}:${winner.id}`);
    for (const candidate of eligibleLevels.slice(1)) {
      const candidateHash = fnv1a(`${date}:${candidate.id}`);
      if (
        candidateHash < winnerHash ||
        (candidateHash === winnerHash && candidate.id < winner.id)
      ) {
        winner = candidate;
        winnerHash = candidateHash;
      }
    }
    return winner;
  }

  function getQuestion(date = shanghaiDate(now())): DailyQuestion {
    if (!validDate(date)) {
      throw new DailyRequestError(
        422,
        "INVALID_DATE",
        "date 必须是有效的 YYYY-MM-DD",
      );
    }
    const level = chooseLevel(date);
    return {
      id: questionIdFor(date, level.id),
      date,
      level,
    };
  }

  function levelForQuestion(
    questionId: string,
  ): { level: Level; date: string } {
    const { date, levelId } = dateAndLevelFromId(questionId);
    if (!validDate(date)) {
      throw new DailyRequestError(404, "QUESTION_NOT_FOUND", "题目不存在");
    }
    if (chooseLevel(date).id !== levelId) {
      throw new DailyRequestError(404, "QUESTION_NOT_FOUND", "题目不存在");
    }
    const level = levelsById.get(levelId);
    if (!level) {
      throw new DailyRequestError(404, "QUESTION_NOT_FOUND", "题目不存在");
    }
    return { level, date };
  }

  function normalizeVotes(level: Level, tokenIndices: readonly number[]): number[] {
    if (!Array.isArray(tokenIndices) || tokenIndices.length === 0) {
      throw new DailyRequestError(422, "EMPTY_SELECTION", "至少选择一个词");
    }
    const unique = [...new Set(tokenIndices)];
    if (unique.length > 4 || unique.length > level.scoring.cap) {
      throw new DailyRequestError(
        422,
        "TOO_MANY_SELECTIONS",
        `最多选择 ${Math.min(4, level.scoring.cap)} 个词`,
      );
    }
    const punct = new Set(level.punct);
    for (const tokenIndex of unique) {
      if (
        !Number.isInteger(tokenIndex) ||
        tokenIndex < 0 ||
        tokenIndex >= level.tokens.length ||
        punct.has(tokenIndex) ||
        tokenIndex === level.focus
      ) {
        throw new DailyRequestError(
          422,
          "INVALID_TOKEN_INDEX",
          `tokenIndices 包含不可选下标 ${tokenIndex}`,
        );
      }
    }
    return unique.sort((left, right) => left - right);
  }

  async function recordVote(
    questionId: string,
    tokenIndices: readonly number[],
  ): Promise<DailyResult> {
    const { level } = levelForQuestion(questionId);
    const normalized = normalizeVotes(level, tokenIndices);
    const snapshot = await options.store.recordVote(
      questionId,
      normalized,
      level.tokens.length,
    );
    return decorateResults(level, snapshot);
  }

  async function getResults(questionId: string): Promise<DailyResult> {
    const { level } = levelForQuestion(questionId);
    const snapshot = await options.store.getSnapshot(
      questionId,
      level.tokens.length,
    );
    return decorateResults(level, snapshot);
  }

  function decorateResults(level: Level, snapshot: VoteSnapshot): DailyResult {
    return {
      ...snapshot,
      tokens: snapshot.counts.map((count, tokenIndex) => ({
        tokenIndex,
        token: level.tokens[tokenIndex]!,
        count,
      })),
    };
  }

  return {
    getQuestion,
    recordVote,
    getResults,
  };
}

export type DailyService = ReturnType<typeof createDailyService>;
