import { useState } from "react";
import questions from "../game/content-questions.json";
import { contentCardForAnswer } from "../game/content-cards.ts";

export const CONTENT_LEVEL_SOURCES: readonly (readonly number[])[] = [
  [1, 2, 3], [4, 5, 6], [7, 9, 10], [11, 12, 13], [14, 15, 18], [19, 20],
];

export function ContentPracticeScreen({ level, onBack, onComplete, onNextLevel }: {
  readonly level: number;
  readonly onBack: () => void;
  readonly onComplete: (level: number) => void;
  readonly onNextLevel: () => void;
}) {
  const sources = CONTENT_LEVEL_SOURCES[level - 1] ?? [];
  const levelQuestions = questions.filter((question) => sources.includes(question.sourceId));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const item = levelQuestions[index]!;
  function next() {
    const total = correct + (selected === item.answer ? 1 : 0);
    setCorrect(total);
    if (index === levelQuestions.length - 1) { setFinished(true); onComplete(level); return; }
    setIndex(index + 1); setSelected(null); setRevealed(false); setCardOpen(false);
  }
  const card = selected === null ? null : contentCardForAnswer(item, selected);
  return <main className="app practice">
    <header className="playbar"><button className="btn btn--quiet" onClick={onBack}>← 返回</button><div className="playbar__title"><strong>第 {level} 关 · 句子线索</strong><span className="playbar__sub">{finished ? "练习完成" : `第 ${index + 1} / ${levelQuestions.length} 题 · ${item.type}`}</span></div></header>
    <p className="practice__notice">本组题目来自内容表，是句子理解练习；答案依据内容标注，不是模型注意力测量。</p>
    {finished ? <section className="board"><h1>你完成了这组练习！</h1><p>答对 {correct} / {levelQuestions.length} 题。读一读解释，找到线索比记住答案更重要。</p><button className="btn btn--primary" onClick={() => { setIndex(0); setSelected(null); setRevealed(false); setCorrect(0); setFinished(false); setCardOpen(false); }}>再练一次</button>{" "}<button className="btn" onClick={onBack}>返回首页</button>{level < 6 && <> {" "}<button className="btn" onClick={onNextLevel}>下一关 →</button></>}</section> : <section className="board">
      <p className="practice__tag">{item.type} · 原句 {item.sourceId}</p><p className="practice__sentence">{item.sentence}</p><h1 className="practice__question">{item.question}</h1><p>选一个答案，再查看解释。</p>
      <div className="intro__choices" role="group" aria-label="答案选项">{item.choices.map(option => <button key={option} type="button" disabled={revealed} aria-pressed={selected === option} className={selected === option ? "intro__choice intro__choice--selected" : "intro__choice"} onClick={() => setSelected(option)}>{option}</button>)}</div>
      {!revealed ? <button className="btn btn--primary" disabled={selected === null} onClick={() => setRevealed(true)}>查看答案</button> : <div className="practice__result" role="status"><h2>{selected === item.answer ? "答对了！" : "再看看这条线索"}</h2><p>你的选择：{selected}　·　参考答案：<strong>{item.answer}</strong></p><p>{item.explanation}</p>
        {card !== null && <section className="card-sheet" data-open={cardOpen ? "true" : "false"}>
          <button type="button" className="card-sheet__toggle" aria-expanded={cardOpen} onClick={() => setCardOpen(!cardOpen)}>
            <span className="card-sheet__label">科普卡</span><span className="card-sheet__title">{card.title}</span><span className="card-sheet__chevron">{cardOpen ? "收起" : "展开"}</span>
          </button>
          {cardOpen && <article className="card-sheet__body" data-copy-id={`CARD-${card.id}`}><p className="card-sheet__text">{card.condition}</p><p className="card-sheet__action">这句话里：{item.explanation}</p><p className="card-sheet__meta">依据内容组提供的卡片名称和触发条件；完整正文待补充。</p></article>}
        </section>}
        <button className="btn btn--primary" onClick={next}>{index === levelQuestions.length - 1 ? "完成练习" : "下一题 →"}</button></div>}
    </section>}
  </main>;
}
