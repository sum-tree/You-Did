import { ChevronRight, Flame } from "lucide-react";
import {
  addDays,
  balance,
  canChangeMainline,
  cantoneseStreak,
  MAINLINE_NAME,
  mainlineFor,
  monthBalance,
  weekStart,
  weekStats,
} from "../domain.ts";
import type { AppData, Mainline } from "../domain.ts";
import { categoryIcon, KalamiIcon, Progress, shortDate } from "../components.tsx";

const MAINLINES: Mainline[] = ["job", "course", "speech"];

export function AchievementPage({
  data,
  today,
  onMainline,
}: {
  data: AppData;
  today: string;
  onMainline: (mode: Mainline) => void;
}) {
  const week = weekStart(today);
  const stats = weekStats(data, week);
  const currentMonth = today.slice(0, 7);
  const monthTotal = monthBalance(data, currentMonth);
  const totalBalance = balance(data);
  const { streak, checkedInToday } = cantoneseStreak(data, today);
  const mainline = mainlineFor(data, week);
  const mainlineOpen = canChangeMainline(data, today);
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
          <div className="balance-history-scroll">
            {data.rewards
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
              ))}
          </div>
        )}
      </details>
      <section
        className={`goal-card streak ${streak > 0 ? "is-active" : ""} ${checkedInToday ? "is-checked" : ""}`}
        aria-label={`粤语连续打卡：${streak} 天`}
      >
        <div className="goal-heading streak-heading">
          <span className="goal-icon">
            <Flame size={20} />
          </span>
          <h3>粤语连续打卡</h3>
          <span className="goal-value">
            <strong>
              {streak}
              <small> 天</small>
            </strong>
            <small>
              {checkedInToday
                ? "今日已打卡"
                : streak > 0
                  ? "今日待打卡"
                  : "暂无打卡"}
            </small>
          </span>
        </div>
      </section>
      <section className="goal-card mainline" aria-label="本周主线">
        <div className="mainline-heading">
          <h3>本周主线</h3>
          <small>
            {mainlineOpen
              ? "本周完成揾工任务前可修改"
              : "本周已完成揾工任务，主线已锁定"}
          </small>
        </div>
        <div className="mainline-options" role="radiogroup" aria-label="本周主线">
          {MAINLINES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={mainline === mode}
              className={mainline === mode ? "selected" : ""}
              disabled={!mainlineOpen && mainline !== mode}
              onClick={() => mainlineOpen && mainline !== mode && onMainline(mode)}
            >
              {MAINLINE_NAME[mode]}
            </button>
          ))}
        </div>
      </section>
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
        <p className="goal-note">
          投递 {Math.min(stats.resumes, stats.jobTarget)} / {stats.jobTarget} 份
          {stats.interviewTotal > 0 &&
            ` · 测试/面试 ${stats.interviewDone} / ${stats.interviewTotal}`}
        </p>
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
