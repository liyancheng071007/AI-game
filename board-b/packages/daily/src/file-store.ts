import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  toSnapshot,
  type DailyVoteStore,
  type VoteSnapshot,
} from "./store.js";

interface StoredRecord {
  counts: Record<string, number>;
  submissionCount: number;
}

type DataFile = Record<string, StoredRecord>;

export class AtomicJsonDailyVoteStore implements DailyVoteStore {
  readonly #filePath: string;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async #read(): Promise<DataFile> {
    try {
      return JSON.parse(await readFile(this.#filePath, "utf8")) as DataFile;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return {};
      }
      throw error;
    }
  }

  async #write(data: DataFile): Promise<void> {
    await mkdir(dirname(this.#filePath), { recursive: true });
    const temporaryPath = `${this.#filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: "utf8",
      flush: true,
    });
    await rename(temporaryPath, this.#filePath);
  }

  async recordVote(
    questionId: string,
    tokenIndices: readonly number[],
    tokenCount: number,
  ): Promise<VoteSnapshot> {
    let result: VoteSnapshot | undefined;
    const operation = async (): Promise<void> => {
      const data = await this.#read();
      const current = data[questionId] ?? {
        counts: {},
        submissionCount: 0,
      };
      for (const tokenIndex of tokenIndices) {
        const key = String(tokenIndex);
        current.counts[key] = (current.counts[key] ?? 0) + 1;
      }
      current.submissionCount += 1;
      data[questionId] = current;
      await this.#write(data);
      result = toSnapshot(questionId, tokenCount, current);
    };
    this.#queue = this.#queue.then(operation, operation);
    await this.#queue;
    if (!result) {
      throw new Error("投票写入未产生结果");
    }
    return result;
  }

  async getSnapshot(
    questionId: string,
    tokenCount: number,
  ): Promise<VoteSnapshot> {
    await this.#queue.catch(() => undefined);
    const data = await this.#read();
    return toSnapshot(
      questionId,
      tokenCount,
      data[questionId] ?? { counts: {}, submissionCount: 0 },
    );
  }
}
