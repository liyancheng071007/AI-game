import { useState } from "react";
import milkFrog from "../assets/milk-frog.jpg";

interface IntroScreenProps { readonly onSkip: () => void; readonly onStart: () => void }
const choices = ["今天画了画", "画被豆包夸奖了", "想再画一只小牛"];

/** 首次进入的互动序章；不把玩家的答案作为 AI 的标准答案。 */
export function IntroScreen({ onSkip, onStart }: IntroScreenProps) {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  return <main className="intro app">
    <header className="intro__top">
      <span className="intro__brand">注意力高亮 <span>· 奶蛙的发现</span></span>
      <button className="intro__skip" type="button" onClick={onSkip}>跳过故事</button>
    </header>
    <div className="intro__progress" aria-label={`故事第 ${step + 1} 幕，共 4 幕`}>
      {[0,1,2,3].map(i => <span key={i} className={i <= step ? "intro__dot intro__dot--on" : "intro__dot"} />)}
    </div>
    <section className="intro__stage" aria-live="polite">
      <div className="intro__art"><span className="intro__spark intro__spark--one">✦</span><img src={milkFrog} alt="黄色的奶蛙，睁着圆圆的眼睛" /><span className="intro__spark intro__spark--two">✳</span><span className="intro__art-label">奶蛙的小小发现</span></div>
      <div className="intro__content">
        {step === 0 && <><p className="intro__eyebrow">第一幕 · 想要分享的事</p><h1>妈妈，你听我说！</h1><div className="intro__bubble"><strong>奶蛙</strong><p>妈妈，我画的小牛被豆包夸奖啦！</p></div><div className="intro__bubble intro__bubble--mom"><strong>妈妈牛</strong><p>今天画画很开心吧？</p></div><p className="intro__narration">奶蛙有点着急：妈妈好像还没听到，他最想分享的是哪件事。</p><button className="btn btn--primary intro__next" onClick={() => setStep(1)}>接下来呢 <span aria-hidden="true">→</span></button></>}
        {step === 1 && <><p className="intro__eyebrow">第二幕 · 换你来听</p><h1>奶蛙最想分享什么？</h1><p className="intro__narration">听听他的心情，选一个你觉得最贴近的回答。</p><div className="intro__choices" role="group" aria-label="选择奶蛙想分享的事">{choices.map((text, i) => <button type="button" key={text} className={choice === i ? "intro__choice intro__choice--selected" : "intro__choice"} aria-pressed={choice === i} onClick={() => setChoice(i)}><span>{String.fromCharCode(65 + i)}</span>{text}</button>)}</div>{choice !== null && <div className="intro__feedback" role="status"><strong>妈妈牛</strong><p>{choice === 1 ? "原来你是想分享画被夸奖的开心呀！" : "我听到了你的想法。奶蛙这次特别想分享的，是他的画被夸奖了。"} 妈妈刚才没听明白，现在我听你说。</p></div>}<button className="btn btn--primary intro__next" disabled={choice === null} onClick={() => setStep(2)}>继续故事 <span aria-hidden="true">→</span></button></>}
        {step === 2 && <><p className="intro__eyebrow">第三幕 · 好奇的奶蛙</p><h1>豆包为什么这么“懂”我？</h1><div className="intro__bubble"><strong>奶蛙</strong><p>豆包总能接住我想说的话。你是怎么找到重点的呀？</p></div><div className="intro__bubble intro__bubble--bot"><strong>豆包 · AI 机器人</strong><p>我处理句子时，不同的词会分到不同的注意力。我们可以一起看看这些线索！</p></div><p className="intro__narration">注意力只是观察模型的一条线索，不代表它完整的推理过程。</p><button className="btn btn--primary intro__next" onClick={() => setStep(3)}>我也想知道 <span aria-hidden="true">→</span></button></>}
        {step === 3 && <><p className="intro__eyebrow">第四幕 · 出发吧</p><h1>和奶蛙一起，猜猜 AI 看哪里</h1><div className="intro__bubble"><strong>奶蛙</strong><p>我要模仿 AI 的“眼力”，标出豆包可能多看的词，更了解我的好朋友！</p></div><ol className="intro__how"><li><span>1</span>读一读句子</li><li><span>2</span>点选你猜的词</li><li><span>3</span>揭晓热力图，对比看看</li></ol><p className="intro__narration">你和 AI 的看法不一样也很正常。这里比的是预测，不是判断谁更懂。</p><button className="btn btn--primary intro__next" onClick={onStart}>和奶蛙进入第一关 <span aria-hidden="true">→</span></button></>}
      </div>
    </section>
    <p className="intro__foot">一个关于倾听、好奇心和 AI 的小实验</p>
  </main>;
}
