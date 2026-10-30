/** 基于内容组提供的触发矩阵；当前单选玩法只可判断 K1 和 K2。 */
export interface ContentCardRule {
  readonly id: "K1" | "K2";
  readonly title: string;
  readonly condition: string;
}
const K1: ContentCardRule = { id: "K1", title: "代词是谁？", condition: "“它”标错对象或漏标指代关系。" };
const K2: ContentCardRule = { id: "K2", title: "因果有座桥", condition: "漏选因果词，或只选结果不选原因。" };
const COREFERENCE_SOURCE_IDS = new Set([2, 3, 11, 14]);
/** 只在能观察到对应错误时触发；不推断多选、热力图或阅读时长等行为。 */
export function contentCardForAnswer(question: { readonly type: string; readonly sourceId: number; readonly answer: string }, selected: string): ContentCardRule | null {
  if (selected === question.answer) return null;
  if (question.type === "指代线索" && COREFERENCE_SOURCE_IDS.has(question.sourceId)) return K1;
  if (question.type === "因果线索" && !["因为", "所以", "于是", "结果", "因此"].includes(selected)) return K2;
  return null;
}
