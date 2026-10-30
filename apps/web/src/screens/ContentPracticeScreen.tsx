import { useState } from "react";
import questions from "../game/content-questions.json";

export function ContentPracticeScreen({ onBack }: { readonly onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const item = questions[index]!;
  function next() {
    const total = correct + (selected === item.answer ? 1 : 0);
    setCorrect(total);
    if (index === questions.length - 1) { setFinished(true); return; }
    setIndex(index + 1); setSelected(null); setRevealed(false);
  }
  return <main className="app practice">
    <header className="playbar"><button className="btn btn--quiet" onClick={onBack}>← 返回</button><div className="playbar__title"><strong>句子线索练习</strong><span className="playbar__sub">{finished ? "练习完成" : `第 ${index + 1} / ${questions.length} 题 · ${item.type}`}</span></div></header>
    <p className="practice__notice">本组题目来自内容表，是句子理解练习；答案依据内容标注，不是模型注意力测量。</p>
    {finished ? <section className="board"><h1>你完成了这组练习！</h1><p>答对 {correct} / {questions.length} 题。读一读解释，找到线索比记住答案更重要。</p><button className="btn btn--primary" onClick={() => { setIndex(0); setSelected(null); setRevealed(false); setCorrect(0); setFinished(false); }}>再练一次</button>{" "}<button className="btn" onClick={onBack}>返回首页</button></section> : <section className="board">
      <p className="practice__tag">{item.type} · 原句 {item.sourceId}</p><p className="practice__sentence">{item.sentence}</p><h1 className="practice__question">{item.question}</h1><p>选一个答案，再查看解释。</p>
      <div className="intro__choices" role="group" aria-label="答案选项">{item.choices.map(option => <button key={option} type="button" disabled={revealed} aria-pressed={selected === option} className={selected === option ? "intro__choice intro__choice--selected" : "intro__choice"} onClick={() => setSelected(option)}>{option}</button>)}</div>
      {!revealed ? <button className="btn btn--primary" disabled={selected === null} onClick={() => setRevealed(true)}>查看答案</button> : <div className="practice__result" role="status"><h2>{selected === item.answer ? "答对了！" : "再看看这条线索"}</h2><p>你的选择：{selected}　·　参考答案：<strong>{item.answer}</strong></p><p>{item.explanation}</p><button className="btn btn--primary" onClick={next}>{index === questions.length - 1 ? "完成练习" : "下一题 →"}</button></div>}
    </section>}
  </main>;
}
