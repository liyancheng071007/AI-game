import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { CONTENT_CARDS } from "../src/game/content-cards.ts";
import { evaluateMarks, groupKey, toggleMark, uniqueGroups, type MarkQuestion } from "../src/game/marking.ts";
const items = JSON.parse(readFileSync(new URL("../src/game/mark-questions.json", import.meta.url),"utf8")) as MarkQuestion[];
const sources = JSON.parse(readFileSync(new URL("../src/game/content-questions.json", import.meta.url),"utf8")) as {sourceId:number;sentence:string}[];
test("17 句均忠实还原原句，词块与参考线索有效", () => {
  assert.equal(items.length,17); assert.equal(new Set(items.map(q=>q.sourceId)).size,17);
  for (const q of items) {
    assert.equal(q.tokens.join(""), sources.find(s=>s.sourceId===q.sourceId)?.sentence, q.id);
    for (const i of [...q.targetsA,...q.targetsB,...q.coref]) assert.ok(i>=0 && i<q.tokens.length && !["，","。"].includes(q.tokens[i]!), q.id);
    const ideal=[...q.targetsA,...q.targetsB].filter((v,i,arr)=>arr.findIndex(j=>groupKey(q,j)===groupKey(q,v))===i);
    assert.ok(uniqueGroups(q,ideal).length<=5,q.id);
    assert.equal(evaluateMarks(q,ideal).missed.length,0,q.id);
    assert.equal(evaluateMarks(q,ideal).extra.length,0,q.id);
  }
});
test("同指成员联动为一组，再点任意成员取消", () => {
  const q=items.find(x=>x.sourceId===2)!; const [book,pronoun]=q.coref;
  const first=toggleMark(q,[],book!); assert.deepEqual(uniqueGroups(q,first.selected),["coref"]);
  assert.deepEqual(toggleMark(q,first.selected,pronoun!).selected,[]);
});
test("标点不可选，超出五组会触发 K9", () => {
  const q=items[0]!; let selected:number[]=[];
  assert.equal(toggleMark(q,[],q.tokens.indexOf("，")).card,"K8");
  for(const [i, token] of q.tokens.entries()) { if (["，","。"].includes(token)) continue; const v=toggleMark(q,selected,i); if(v.card===null)selected=v.selected; else { assert.equal(v.card,"K9"); break; } }
  assert.equal(uniqueGroups(q,selected).length,5);
});
test("内容表有 12 张卡，遗漏指代和连接词分别触发 K1、K2", () => {
  assert.equal(CONTENT_CARDS.length,12);
  const coref=items.find(x=>x.sourceId===2)!; assert.equal(evaluateMarks(coref,[coref.targetsA[0]!]).card,"K1");
  const cause=items.find(x=>x.sourceId===4)!; assert.equal(evaluateMarks(cause,[cause.targetsB[0]!]).card,"K2");
});
