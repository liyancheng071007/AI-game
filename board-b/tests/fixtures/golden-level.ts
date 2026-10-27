import type { Level, LevelPackage } from "@attention/schema";

const weights = [
  0.103, 0.093, 0.022, 0.22, 0, 0.061, 0, 0.203, 0.02, 0.134, 0, 0.072,
  0, 0.052, 0.02, 0,
];

export const goldenLevel: Level = {
  schemaVersion: "1.0.0",
  id: "GOLDEN-COREF-01",
  level: 2,
  template: "coref-repeat",
  tokens: [
    "豆包",
    "弄丢",
    "了",
    "奶娃",
    "的",
    "书",
    "，",
    "奶娃",
    "很",
    "难过",
    "，",
    "所以",
    "它",
    "哭",
    "了",
    "。",
  ],
  focus: 12,
  punct: [6, 10, 15],
  coref: [
    {
      entity: "奶娃",
      members: [3, 7],
      refersFrom: [12],
    },
  ],
  causal: [{ cause: [9], effect: [13], connective: 11 }],
  attention: {
    lenses: {
      panorama: weights,
      coref: weights,
      causal: weights,
      emotion: weights,
      position: weights,
    },
    lensConfigId: "probe-v1",
    modelVersion:
      "bert-base-chinese@test + hfl/chinese-roberta-wwm-ext@test#agg-v1",
    probeSetHash: "4f66f5b5bf36b1e9e9cd88b5e0a93fba2a56348f5ef6705f91834f31ace2ec2d",
    stability: 1,
    crossModelAgreement: 0.78,
    caseStrength: 0.712,
  },
  scoring: {
    cap: 4,
    bCumulative: 0.7,
    maxTargets: 3,
  },
  explain: {
    copyId: "EXP-GOLDEN-COREF-01",
    text: "「它」说的是奶娃，AI 回头看了两次奶娃。",
  },
  humanRationale: "两个奶娃同指，难过是哭的直接原因。",
  alternatives: [
    {
      tokenIndices: [13],
      rationale: "从结果词反推原因也是一种合理读法。",
    },
  ],
  provenance: {
    source: "human-authored",
    pipelineVersion: "fixture-v1",
  },
  review: {
    status: "draft",
    notes: "仅用于自动化测试",
  },
};

export const goldenPackage: LevelPackage = {
  schemaVersion: "1.0.0",
  packageVersion: "0.1.0",
  status: "draft",
  generatedAt: "2026-10-27T00:00:00.000Z",
  modelLockHash:
    "c4571aa0d85f91a1d29820f43f1a8d31c1646d3aab874ed8c43ab7ec94ec84ef",
  levels: [goldenLevel],
};

export function cloneLevel(overrides: Partial<Level> = {}): Level {
  return structuredClone({ ...goldenLevel, ...overrides });
}
