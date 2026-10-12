import { ChevronRight, Coins } from "lucide-react";
import { addDays, balance, weekStart, weekStats } from "../domain.ts";
import type { AppData } from "../domain.ts";
import { categoryIcon, Progress, shortDate } from "../components.tsx";

export function AchievementPage({
  data,
  today,
  onAdjustCourse,
}: {
  data: AppData;
  today: string;
  onAdjustCourse: () => void;
}) {
  const week = weekStart(today);
  const stats = weekStats(data, week);
  return (
    <>
      <p className="week-range">
        本周 · {shortDate(week)} — {shortDate(addDays(week, 6))}
      </p>
      <div className="balance-row">
        <span>
          <Coins size={17} />
          我的卡拉米
        </span>
        <strong>{balance(data)}</strong>
      </div>
      <h2 className="section-title">待办项</h2>
      <section className="goal-card job">
        <div className="goal-heading">
          <span className="goal-icon">{categoryIcon("job")}</span>
          <h3>香港揾工</h3>
          <strong>{stats.jobPercent}%</strong>
        </div>
        <Progress value={stats.jobPercent} label="香港揾工本周进度" />
      </section>
      <section className="goal-card speech">
        <div className="goal-heading">
          <span className="goal-icon">{categoryIcon("speech")}</span>
          <h3>大胆说口语</h3>
          <strong>{stats.speechPercent}%</strong>
        </div>
        <Progress value={stats.speechPercent} label="大胆说口语本周进度" />
      </section>
      <section className="goal-card course">
        <div className="goal-heading">
          <span className="goal-icon">{categoryIcon("course")}</span>
          <h3>课程作业</h3>
          <strong>
            第{data.courseWeek}
            <small> / 15周</small>
          </strong>
        </div>
        <Progress
          value={Math.round((data.courseWeek / 15) * 100)}
          label="学期进度"
        />
        <div className="goal-foot">
          <span>
            {data.courseWeek === 15
              ? "本学期最后一周"
              : `还有${15 - data.courseWeek}周结束本学期`}
          </span>
          <button className="text-button" onClick={onAdjustCourse}>
            调整周数
          </button>
        </div>
      </section>
      <details className="reward-history">
        <summary>
          <Coins size={17} />
          卡拉米明细
          <ChevronRight size={16} />
        </summary>
        {data.rewards.length === 0 ? (
          <p>暂无奖励记录。</p>
        ) : (
          data.rewards
            .slice()
            .reverse()
            .map((reward) => (
              <div key={reward.id}>
                <span>
                  {reward.label}
                  <small>{shortDate(reward.date)}</small>
                </span>
                <strong>+{reward.amount}</strong>
              </div>
            ))
        )}
      </details>
    </>
  );
}
