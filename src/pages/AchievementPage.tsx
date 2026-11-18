import { ChevronDown, ChevronRight, Flame, Lock } from "lucide-react";
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
  const { streak, checkedInToday, owed, repayBy } = cantoneseStreak(data, today);
  const mainline = mainlineFor(data, week);
  const mainlineOpen = canChangeMainline(data, today);
  return (
    <>
      <div className="week-row">
        <p className="week-range">
          本周 · {shortDate(week)} — {shortDate(addDays(week, 6))}
        </p>
        <label
          className={`mainline-chip ${mainlineOpen ? "" : "locked"}`}
          title={
            mainlineOpen
              ? "本周主线：完成揾工任务前可更换"
              : "本周已完成揾工任务，主线已锁定"
          }
        >
          <span className="visually-hidden">本周主线</span>
          <select
            value={mainline}
            disabled={!mainlineOpen}
            onChange={(e) => onMainline(e.target.value as Mainline)}
          >
            {MAINLINES.map((mode) => (
              <option key={mode} value={mode}>
                {MAINLINE_NAME[mode]}
              </option>
            ))}
          </select>
          {mainlineOpen ? <ChevronDown size={13} /> : <Lock size={12} />}
        </label>
      </div>
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
              {owed > 0 && repayBy
                ? `欠${owed}天 · ${shortDate(repayBy)}前补上`
                : checkedInToday
                  ? "今日已打卡"
                  : streak > 0
                    ? "今日待打卡"
                    : "暂无打卡"}
            </small>
          </span>
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
