import { ChevronRight } from "lucide-react";
import { addDays, balance, monthBalance, weekStart, weekStats } from "../domain.ts";
import type { AppData } from "../domain.ts";
import { categoryIcon, KalamiIcon, Progress, shortDate } from "../components.tsx";

export function AchievementPage({
  data,
  today,
}: {
  data: AppData;
  today: string;
}) {
  const week = weekStart(today);
  const stats = weekStats(data, week);
  const currentMonth = today.slice(0, 7);
  const monthTotal = monthBalance(data, currentMonth);
  const totalBalance = balance(data);
  return (
    <>
      <p className="week-range">
        本周 · {shortDate(week)} — {shortDate(addDays(week, 6))}
      </p>
      <details className="reward-history balance-panel">
        <summary>
          <KalamiIcon size={18} />
          我的卡拉米
          <span className="balance-summary-values">
            <strong>{monthTotal}</strong>
            <small>/ 累计 {totalBalance}</small>
          </span>
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
      <h2 className="section-title">待办项</h2>
      <section className="goal-card job">
        <div className="goal-heading">
          <span className="goal-icon">{categoryIcon("job")}</span>
          <h3>香港揾工</h3>
          <span className="goal-value">
            <strong>{stats.jobPercent}%</strong>
            <small>已完成</small>
          </span>
        </div>
        <Progress value={stats.jobPercent} label="香港揾工本周进度" />
      </section>
      <section className="goal-card speech">
        <div className="goal-heading">
          <span className="goal-icon">{categoryIcon("speech")}</span>
          <h3>大胆说口语</h3>
          <span className="goal-value">
            <strong>{stats.speechPercent}%</strong>
            <small>已完成</small>
          </span>
        </div>
        <Progress value={stats.speechPercent} label="大胆说口语本周进度" />
      </section>
      <section className="goal-card course">
        <div className="goal-heading">
          <span className="goal-icon">{categoryIcon("course")}</span>
          <h3>课程</h3>
          <span className="goal-value">
            <strong>
              第{data.courseWeek}
              <small> / 15周</small>
            </strong>
            <small>已完成</small>
          </span>
        </div>
        <Progress
          value={Math.round((data.courseWeek / 15) * 100)}
          label="学期进度"
        />
      </section>
    </>
  );
}
