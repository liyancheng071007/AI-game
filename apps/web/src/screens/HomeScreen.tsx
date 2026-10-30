import type { LevelPackage } from "@attention/schema";
import { CONTENT_LEVEL_SOURCES } from "./ContentPracticeScreen.tsx";
import type { Progress } from "../game/progress.ts";

export interface HomeScreenProps {
  readonly pkg: LevelPackage;
  readonly progress: Progress;
  readonly dailyDone: boolean;
  readonly onPlayLevel: (levelNumber: number) => void;
  readonly onDaily: () => void;
  readonly onReport: () => void;
  readonly onParent: () => void;
  readonly onClassroom: () => void;
  readonly onIntro: () => void;

}

export function HomeScreen(props: HomeScreenProps) {
  const { progress, onPlayLevel, onDaily, onReport, onParent, onClassroom, onIntro } = props;
  const numbers = [1, 2, 3, 4, 5, 6];
  const completed = progress.completedContentLevels ?? [];

  return (
    <main className="app">
      <header className="home-head">
        <div>
          <h1 className="home-title">注意力高亮</h1>
          <p className="home-sub">先找句子里的线索，再探索 AI 的注意力</p>
        </div>
        <div className="star-total" aria-label={`已完成 ${completed.length} 关`}>{completed.length} / 6</div>
      </header>

      <aside className="demo-notice" aria-label="体验版说明">
        <strong>开发体验版</strong> · 题目与科普内容仍待人工审核，暂不适用于儿童正式教学或研究。
        「豆包」是虚构角色；注意力只是理解模型的线索，并非完整解释。
      </aside>
      <p className="practice__section-label">主线题库：17 句表格题，练习因果与指代线索。答案来自内容标注，尚无模型注意力结果。</p>
      <ol className="level-list">
        {numbers.map((number) => {
          const count = CONTENT_LEVEL_SOURCES[number - 1]?.length ?? 0;
          const unlocked = number === 1 || completed.includes(number - 1);
          const done = completed.includes(number);
          return (
            <li key={number}>
              <button
                type="button"
                className="level-card"
                disabled={!unlocked}
                onClick={() => {
                  onPlayLevel(number);
                }}
              >
                <span className="level-card__no">{number}</span>
                <span className="level-card__main">
                  <span className="level-card__name">
                    {unlocked ? `第 ${number} 关` : "还没解锁"}
                  </span>
                  <span className="level-card__meta">
                    {unlocked ? `${String(count)} 句 · 因果与指代` : "先过上一关"}
                  </span>
                </span>
                <span
                  className="level-card__stars"
                  aria-label={done ? "已完成" : "还没玩"}
                >
                  {!unlocked ? "🔒" : done ? "已完成" : "还没玩"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <button type="button" className="daily-entry" onClick={onDaily}>
        <span className="daily-entry__tag">模型技术演示</span><span className="daily-entry__text">查看旧模型注意力样例（重复句式）</span><span aria-hidden="true">→</span>
      </button>
      <nav className="home-nav">
        <button type="button" className="btn" onClick={onIntro}>重看开场故事</button>
        <button type="button" className="btn" onClick={onReport}>
          模型样例报告
        </button>
        <button type="button" className="btn" onClick={onClassroom}>模型样例课堂</button>
        <button type="button" className="btn" onClick={onParent}>
          家长 / 课堂
        </button>
      </nav>

      <p className="home-foot">
        没有排行榜，没有倒计时。只跟你昨天的自己比。
      </p>
    </main>
  );
}
