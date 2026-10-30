import { useState } from "react";
import questions from "../game/mark-questions.json";
import { CONTENT_CARDS, getContentCard, type ContentCardId } from "../game/content-cards.ts";
import { evaluateMarks, groupKey, groupLabel, isPunctuation, MARK_CAP, toggleMark, uniqueGroups } from "../game/marking.ts";

export const CONTENT_LEVEL_SOURCES: readonly (readonly number[])[] = [
  [1, 2, 3], [4, 5, 6], [7, 9, 10], [11, 12, 13], [14, 15, 18], [19, 20],
];
export function ContentPracticeScreen({ level, onBack, onComplete, onNextLevel }: {
  readonly level:number; readonly onBack:() => void; readonly onComplete:(level:number) => void; readonly onNextLevel:() => void;
}) {
  const levelQuestions = questions.filter(q => (CONTENT_LEVEL_SOURCES[level - 1] ?? []).includes(q.sourceId));
  const [index,setIndex] = useState(0);
  const [selected,setSelected] = useState<number[]>([]);
  const [revealed,setRevealed] = useState(false);
  const [finished,setFinished] = useState(false);
  const [cardId,setCardId] = useState<ContentCardId | null>(null);
  const [cardOpen,setCardOpen] = useState(false);
  const [libraryOpen,setLibraryOpen] = useState(false);
  const [history,setHistory] = useState<number[][]>([]);
  const [scores,setScores] = useState<number[]>([]);
  const item = levelQuestions[index]!;
  const result = evaluateMarks(item, selected);
  const picked = uniqueGroups(item, selected);
  const card = cardId === null ? null : getContentCard(cardId);
  const format = (groups:readonly string[]) => groups.length ? groups.map(g => groupLabel(item,g)).join("、") : "无";
  function choose(i:number) {
    if (revealed) return;
    const next = toggleMark(item, selected, i);
    if (next.card !== null) { setCardId(next.card); setCardOpen(true); return; }
    setHistory([...history,selected]); setSelected(next.selected); setCardId(null); setCardOpen(false);
  }
  function next() {
    setScores([...scores, result.score]);
    if (index === levelQuestions.length - 1) { setFinished(true); onComplete(level); return; }
    setIndex(index + 1); setSelected([]); setHistory([]); setRevealed(false); setCardId(null); setCardOpen(false);
  }
  function restart() { setIndex(0); setSelected([]); setHistory([]); setRevealed(false); setFinished(false); setCardId(null); setCardOpen(false); setScores([]); }
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10 : 0;
  return <main className="app practice">
    <header className="playbar"><button className="btn btn--quiet" onClick={onBack}>← 返回</button><div className="playbar__title"><strong>第 {level} 关 · 句子线索</strong><span className="playbar__sub">{finished ? "练习完成" : `第 ${index + 1} / ${levelQuestions.length} 句`}</span></div></header>
    <p className="practice__notice">这些参考线索依据内容组标注整理，不是模型注意力测量。可以自由选择词块，同指词算一组，最多选 {MARK_CAP} 组。</p>
    {finished ? <section className="board"><h1>你完成了这组练习！</h1><p>本关平均分：<strong>{average.toFixed(1)} 分</strong>（{scores.length} 句）</p><p>试着说说每句话的原因和结果，你也可以再读一次。</p><button className="btn btn--primary" onClick={restart}>再练一次</button>{" "}<button className="btn" onClick={onBack}>返回首页</button>{level < 6 && <> {" "}<button className="btn" onClick={onNextLevel}>下一关 →</button></>}</section> : <section className="board">
      <p className="practice__tag">原句 {item.sourceId} · 已选 {picked.length} / {MARK_CAP} 组</p>
      <h1 className="practice__question">读一读，标记你觉得重要的词</h1><p>试着找出连接原因和结果的词，以及和句意有关的线索。</p>
      <div className="practice__tokens" role="group" aria-label="句子词块">{item.tokens.map((token,i) => isPunctuation(token) ? <span key={i} className="practice__punct">{token}</span> : <button key={i} type="button" disabled={revealed} aria-pressed={picked.includes(groupKey(item,i))} className={picked.includes(groupKey(item,i)) ? "practice__token practice__token--selected" : "practice__token"} onClick={() => choose(i)}>{token}</button>)}</div>
      {!revealed && <div className="toolbar"><button className="btn" disabled={history.length === 0} onClick={() => {const prev = history.at(-1); if (prev) setSelected(prev); setHistory(history.slice(0,-1)); setCardId(null); setCardOpen(false);}}>撤销</button><button className="btn" disabled={selected.length === 0} onClick={() => {setHistory([...history,selected]);setSelected([]);setCardId(null);setCardOpen(false);}}>清空</button><button className="btn btn--primary" disabled={selected.length === 0} onClick={() => {setRevealed(true);setCardId(result.card);setCardOpen(false);}}>查看线索</button></div>}
      {revealed && <div className="practice__result" role="status"><h2>本句得分：{result.score.toFixed(1)} 分 <span aria-label={`${result.star} 星`}>{"★".repeat(result.star)}{"☆".repeat(3-result.star)}</span></h2><p>核心线索 {result.aHit}/{result.a.length} 组，获得 {result.corePoints.toFixed(1)}/{result.coreMax} 分；相关线索 {result.bHit}/{result.b.length} 组，获得 {result.relatedPoints.toFixed(1)}/{result.relatedMax} 分。</p><p>选择精度：{result.hit.length}/{picked.length} 组命中 = {(result.precision * 100).toFixed(1)}%。分数 = （核心得分 + 相关得分）× 选择精度；多选会降低精度。</p><p>这是与内容组参考线索的对照分，不是模型注意力分数；其他读法也可能有道理。</p><p><strong>核心线索：</strong>{format(result.a)}</p><p><strong>相关线索：</strong>{format(result.b)}</p><p><strong>你找到了：</strong>{format(result.hit)}</p><p><strong>还可以看看：</strong>{format(result.missed)}</p>{result.extra.length > 0 && <p><strong>你另外选了：</strong>{format(result.extra)}。不同读法可能有道理，可以说说你的理由。</p>}<p>{item.explanation}</p>{item.coref.length > 0 && <p>{format(["coref"])}；点其中一个词就算选中这组。</p>}</div>}
      {card !== null && <section className="card-sheet" data-open={cardOpen ? "true" : "false"}><button type="button" className="card-sheet__toggle" aria-expanded={cardOpen} onClick={() => setCardOpen(!cardOpen)}><span className="card-sheet__label">科普卡 {card.id}</span><span className="card-sheet__title">{card.title}</span><span className="card-sheet__chevron">{cardOpen ? "收起" : "展开"}</span></button>{cardOpen && <article className="card-sheet__body" data-copy-id={`CARD-${card.id}`}><p className="card-sheet__text">{card.condition}</p><p className="card-sheet__action">这句话里：{item.explanation}</p><p className="card-sheet__meta">卡名和触发摘要来自内容表，完整科普正文待补充。</p></article>}</section>}
      {revealed && <div className="toolbar"><button className="btn" onClick={() => {setRevealed(false);setCardId(null);setCardOpen(false);}}>换一组词再试</button><button className="btn btn--primary" onClick={next}>{index === levelQuestions.length - 1 ? "完成本关" : "下一句 →"}</button></div>}
    </section>}
    <details className="practice__library" open={libraryOpen} onToggle={event => setLibraryOpen(event.currentTarget.open)}><summary>查看内容组的 12 张科普卡</summary><p>这里展示表格中的卡名与触发条件。游戏只在能判断相应行为时提示卡片。</p><ul>{CONTENT_CARDS.map(c => <li key={c.id}><strong>{c.id} · {c.title}</strong>：{c.condition}</li>)}</ul></details>
  </main>;
}
