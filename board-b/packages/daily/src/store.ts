export interface VoteSnapshot {
  questionId: string;
  tokenCount: number;
  counts: number[];
  totalSelections: number;
  submissionCount: number;
}

export interface DailyVoteStore {
  recordVote(
    questionId: string,
    tokenIndices: readonly number[],
    tokenCount: number,
  ): Promise<VoteSnapshot>;
  getSnapshot(
    questionId: string,
    tokenCount: number,
  ): Promise<VoteSnapshot>;
}

interface StoredRecord {
  counts: Record<string, number>;
  submissionCount: number;
}

export function toSnapshot(
  questionId: string,
  tokenCount: number,
  record: StoredRecord,
): VoteSnapshot {
  const counts = Array.from({ length: tokenCount }, (_, tokenIndex) =>
    Number(record.counts[String(tokenIndex)] ?? 0),
  );
  return {
    questionId,
    tokenCount,
    counts,
    totalSelections: counts.reduce((sum, count) => sum + count, 0),
    submissionCount: record.submissionCount,
  };
}

export class InMemoryDailyVoteStore implements DailyVoteStore {
  readonly #records = new Map<string, StoredRecord>();

  async recordVote(
    questionId: string,
    tokenIndices: readonly number[],
    tokenCount: number,
  ): Promise<VoteSnapshot> {
    const current = this.#records.get(questionId) ?? {
      counts: {},
      submissionCount: 0,
    };
    for (const tokenIndex of tokenIndices) {
      const key = String(tokenIndex);
      current.counts[key] = (current.counts[key] ?? 0) + 1;
    }
    current.submissionCount += 1;
    this.#records.set(questionId, current);
    return toSnapshot(questionId, tokenCount, current);
  }

  async getSnapshot(
    questionId: string,
    tokenCount: number,
  ): Promise<VoteSnapshot> {
    const current = this.#records.get(questionId) ?? {
      counts: {},
      submissionCount: 0,
    };
    return toSnapshot(questionId, tokenCount, current);
  }
}
