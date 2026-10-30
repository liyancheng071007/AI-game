/** 内容组提供的科普卡清单。表格包含卡名和触发摘要，不含正文。 */
export const CONTENT_CARDS = [
  {id:"K1", title:"“它”是谁？", condition:"“它”标错对象或漏标指代关系。"},
  {id:"K2", title:"因果有座桥", condition:"漏选“因为/所以/于是/结果/因此”，或只选结果不选原因。"},
  {id:"K3", title:"同一个人换外套", condition:"先行词与“它”被当成两个词重复选，或未合并。"},
  {id:"K4", title:"全选不是最优", condition:"选择数等于总词数或明显过宽。"},
  {id:"K5", title:"面面俱到", condition:"只选因果连接词，漏选原因、结果实体等线索。"},
  {id:"K6", title:"专心点！别太散", condition:"选了大量无关词，选择太散。"},
  {id:"K7", title:"弄混接力棒", condition:"把甲实体的动作或属性算到乙实体上。"},
  {id:"K8", title:"标点是路牌", condition:"选中标点、重复词或无信息虚词。"},
  {id:"K9", title:"不要太贪心", condition:"点击超过选择上限，或灰化后继续点。"},
  {id:"K10", title:"热力图不是答案", condition:"把最亮区当成唯一答案，或亮区与选择明显不一致。"},
  {id:"K11", title:"换个滤镜看看", condition:"只用一种透镜看句。"},
  {id:"K12", title:"燕过留痕", condition:"报告停留过短、直接跳过，或只看分数不读漏掉的线索。"},
] as const;
export type ContentCardId = typeof CONTENT_CARDS[number]["id"];
export function getContentCard(id: ContentCardId) { return CONTENT_CARDS.find(card => card.id === id)!; }
