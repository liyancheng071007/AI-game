import { createTargetGroups } from "@attention/engine";
import type { LensId, Level } from "@attention/schema";
import type { Evaluation } from "../game/domain.ts";
import { starLabel, nextStarHint, LENS_LABELS } from "../game/domain.ts";

export interface ResultPanelProps {
  readonly level: Level;
  readonly evaluation: Evaluation;
  readonly lens: LensId;
}

function Stars({ star }: { star: 0 | 1 | 2 | 3 }) {
  return (
    <span className="stars" aria-label={starLabel(star)}>
      {[1, 2, 3].map((slot) => (
        <span key={slot} className={slot <= star ? "star star--on" : "star"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ResultPanel({ level, evaluation, lens }: ResultPanelProps) {
  const { score } = evaluation;
  const hint = nextStarHint(score.score);
  const groups = createTargetGroups(level, lens);
  const label = (id: string): string => {
    const group = groups.find((item) => item.groupId === id);
    if (!group) return "未知词组";
    const words = [...new Set(group.tokenIndices.map((index) => level.tokens[index] ?? ""))];
    const name = words.map((word) => `「${word}」`).join(" / ");
    return group.tokenIndices.length > 1 ? `${name}（${group.tokenIndices.length}处同指，合并为一组）` : name;
  };
  const list = (ids: readonly string[]): string => ids.length ? ids.map(label).join("、") : "无";

  return (
    <section className="result" aria-live="polite">
      <header className="result__head">
        <div className="result__score">
          <strong>{score.score.toFixed(1)}</strong>
          <span className="result__unit">分</span>
        </div>
        <div className="result__meta">
          <Stars star={score.star} />
          <p className="result__hint">{hint ?? "已满星，换个透镜看看同一句话的重点会不会变。"}</p>
        </div>
      </header>

      <div className="result__explain">
        <p className="result__explain-text"><strong>本题怎样得到满分？</strong></p>
        <p>在当前{LENS_LABELS[lens]}中，选齐以下目标组，且不额外选择其他组：{list(score.idealGroupIds)}。</p>
        <p><strong>你选对：</strong>{list(score.hitGroupIds)}</p>
        <p><strong>还缺：</strong>{list(score.missedGroupIds)}</p>
        <p><strong>额外选择：</strong>{list(score.extraGroupIds)}</p>
        <p>同一个实体出现多次时，选中任一处就算选中一组。词块显示的是单处权重，评分时同组权重会相加；因此最亮的单个词不一定是权重最高的组。</p>
        <p>本次得分：覆盖率 {(score.coverage * 100).toFixed(1)}% × 选择精度 {(score.precision * 100).toFixed(1)}%{score.keyMissFactor < 1 ? " × 未选最高组的折半系数" : ""}{score.overSelectionFactor < 1 ? " × 超选系数" : ""}，四舍五入得到 {score.score.toFixed(1)} 分。</p>
        <p>不同句子和透镜的权重不同，满分目标也会变化；这个分数衡量的是预测与该模型样例的吻合程度。</p>
        <p data-copy-id={level.explain.copyId}>{level.explain.text}</p>
      </div>

      <div className="result__legend">
        <span className="legend legend--hit">命中</span>
        <span className="legend legend--extra">多选</span>
        <span className="legend legend--missed">漏选</span>
      </div>
    </section>
  );
}
