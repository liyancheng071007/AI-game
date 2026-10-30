import type { ContentCardId } from "./content-cards.ts";
export interface MarkQuestion { readonly id:string; readonly sourceId:number; readonly tokens:readonly string[]; readonly targetsA:readonly number[]; readonly targetsB:readonly number[]; readonly coref:readonly number[]; readonly explanation:string }
export const MARK_CAP = 5;
const PUNCT = new Set(["，", "。", "！", "？", "、", "；", "："]);
export function isPunctuation(token: string): boolean { return PUNCT.has(token); }
/** 同指组只算一组，其余每个 token 独立。 */
export function groupKey(q: MarkQuestion, i: number): string { return q.coref.includes(i) ? "coref" : `token:${i}`; }
export function uniqueGroups(q: MarkQuestion, indices: readonly number[]): string[] { return [...new Set(indices.map(i => groupKey(q, i)))]; }
export function groupLabel(q: MarkQuestion, key: string): string {
  if (key === "coref") return [...new Set(q.coref.map(i => q.tokens[i]!))].map(t => `「${t}」`).join(" / ") + "（同指一组）";
  const i = Number(key.slice(6)); return `「${q.tokens[i] ?? ""}」`;
}
export function toggleMark(q: MarkQuestion, selected: readonly number[], index: number): { selected:number[]; card:ContentCardId | null } {
  if (!Number.isInteger(index) || index < 0 || index >= q.tokens.length) return { selected:[...selected], card:null };
  if (isPunctuation(q.tokens[index]!)) return { selected:[...selected], card:"K8" };
  const key = groupKey(q,index);
  if (selected.some(i => groupKey(q,i) === key)) return { selected:selected.filter(i => groupKey(q,i) !== key), card:null };
  if (uniqueGroups(q, selected).length >= MARK_CAP) return { selected:[...selected], card:"K9" };
  return { selected:[...selected,index], card:null };
}
export function evaluateMarks(q: MarkQuestion, selected: readonly number[]) {
  const picked = uniqueGroups(q,selected);
  const a = uniqueGroups(q,q.targetsA);
  const b = uniqueGroups(q,q.targetsB).filter(key => !a.includes(key));
  const target = [...a,...b];
  const hit = picked.filter(key => target.includes(key));
  const missed = target.filter(key => !picked.includes(key));
  const extra = picked.filter(key => !target.includes(key));
  // 评分基于内容标注：核心 60 分、相关线索 40 分；额外选择降低精度。
  // 某档为空时把分值留给另一档，避免出现无法达到的满分。
  const aHit = a.filter(key => picked.includes(key)).length;
  const bHit = b.filter(key => picked.includes(key)).length;
  const coreMax = a.length ? (b.length ? 60 : 100) : 0;
  const relatedMax = b.length ? (a.length ? 40 : 100) : 0;
  const corePoints = a.length ? coreMax * aHit / a.length : 0;
  const relatedPoints = b.length ? relatedMax * bHit / b.length : 0;
  const precision = picked.length ? hit.length / picked.length : 0;
  const score = Math.round((corePoints + relatedPoints) * precision * 10) / 10;
  const star = score >= 90 ? 3 : score >= 60 ? 2 : score >= 30 ? 1 : 0;
  let card:ContentCardId | null = null;
  const connectorIndices = q.targetsA.filter(i => ["因为","所以","于是","结果","因此"].includes(q.tokens[i]!));
  if (q.coref.length > 0 && !picked.includes("coref")) card = "K1";
  else if (connectorIndices.some(i => !picked.includes(groupKey(q,i)))) card = "K2";
  else if (picked.length >= MARK_CAP) card = "K4";
  else if (extra.length >= 2) card = "K6";
  else if (b.length > 0 && a.every(key => picked.includes(key)) && b.some(key => !picked.includes(key))) card = "K5";
  return { a,b,target,hit,missed,extra,card,aHit,bHit,corePoints,relatedPoints,coreMax,relatedMax,precision,score,star };
}
