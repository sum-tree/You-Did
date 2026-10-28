import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Ellipsis,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Timer,
} from "lucide-react";
import {
  CATEGORY,
  dailyView,
  shouldSuggestInterviewSplit,
  taskReward,
} from "../domain.ts";
import type { AppData, Task } from "../domain.ts";
import {
  dateLabel,
  KalamiIcon,
  longDate,
  Progress,
  TaskCheck,
  taskRewardHint,
} from "../components.tsx";

interface CantoneseTimerState {
  running: boolean;
  startedAt: number | null;
  baseElapsed: number;
}

function getSavedCantoneseTimer(taskId: string): CantoneseTimerState {
  try {
    const raw = localStorage.getItem(`yd_cantonese_timer_${taskId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { running: false, startedAt: null, baseElapsed: 0 };
}

function saveCantoneseTimer(taskId: string, state: CantoneseTimerState | null) {
  try {
    if (!state) {
      localStorage.removeItem(`yd_cantonese_timer_${taskId}`);
    } else {
      localStorage.setItem(`yd_cantonese_timer_${taskId}`, JSON.stringify(state));
    }
  } catch {}
}

function CantoneseTimer({
  task,
  onFinish,
}: {
  task: Task;
  onFinish: (task: Task, duration: number) => void;
}) {
  const [timerState, setTimerState] = useState<CantoneseTimerState>(() =>
    getSavedCantoneseTimer(task.id),
  );
  const [now, setNow] = useState(() => Date.now());

  const elapsed = Math.min(
    1800,
    timerState.baseElapsed +
      (timerState.running && timerState.startedAt
        ? Math.max(0, Math.floor((now - timerState.startedAt) / 1000))
        : 0),
  );

  useEffect(() => {
    if (elapsed >= 1800 && timerState.running) {
      saveCantoneseTimer(task.id, null);
      setTimerState({ running: false, startedAt: null, baseElapsed: 1800 });
      onFinish(task, 1800);
    }
  }, [elapsed, timerState.running, task, onFinish]);

  useEffect(() => {
    if (!timerState.running) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [timerState.running]);

  const handleStart = () => {
    const nextState: CantoneseTimerState = {
      running: true,
      startedAt: Date.now(),
      baseElapsed: elapsed >= 1800 ? 0 : elapsed,
    };
    saveCantoneseTimer(task.id, nextState);
    setTimerState(nextState);
    setNow(Date.now());
  };

  const handlePause = () => {
    const nextState: CantoneseTimerState = {
      running: false,
      startedAt: null,
      baseElapsed: elapsed,
    };
    saveCantoneseTimer(task.id, nextState);
    setTimerState(nextState);
  };

  const handleReset = () => {
    saveCantoneseTimer(task.id, null);
    setTimerState({ running: false, startedAt: null, baseElapsed: 0 });
    setNow(Date.now());
  };

  const handleSettle = () => {
    if (elapsed < 600) return;
    saveCantoneseTimer(task.id, null);
    onFinish(task, elapsed);
  };

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const progressPercent = Math.min(100, Math.round((elapsed / 1800) * 100));
  const currentTier = Math.min(3, Math.floor(mins / 10));

  return (
    <div className="cantonese-timer-block">
      <div className="cantonese-timer-header">
        <div className="cantonese-timer-time">
          <Timer
            size={16}
            className={timerState.running ? "timer-icon running" : "timer-icon"}
          />
          <span className="timer-digits">{timeStr}</span>
          <span className="timer-target">/ 30:00</span>
        </div>
      </div>

      <div className="cantonese-milestones-track">
        <div className="cantonese-milestones">
          <div
            className={`cantonese-milestone milestone-10 ${elapsed >= 600 ? "reached" : ""}`}
            title="10分钟 (1卡拉米)"
          >
            <span className="milestone-icons">
              <KalamiIcon size={16} />
            </span>
          </div>
          <div
            className={`cantonese-milestone milestone-20 ${elapsed >= 1200 ? "reached" : ""}`}
            title="20分钟 (2卡拉米)"
          >
            <span className="milestone-icons">
              <KalamiIcon size={16} />
              <KalamiIcon size={16} />
            </span>
          </div>
          <div
            className={`cantonese-milestone milestone-30 ${elapsed >= 1800 ? "reached" : ""}`}
            title="30分钟 (3卡拉米)"
          >
            <span className="milestone-icons">
              <KalamiIcon size={16} />
              <KalamiIcon size={16} />
              <KalamiIcon size={16} />
            </span>
          </div>
        </div>

        <div className="cantonese-timer-track">
          <div
            className="cantonese-timer-progress"
            style={{ width: `${progressPercent}%` }}
          />
          <div className="cantonese-marker marker-10" title="10分钟 (1卡拉米)" />
          <div className="cantonese-marker marker-20" title="20分钟 (2卡拉米)" />
        </div>
      </div>

      <div className="cantonese-timer-controls">
        {!timerState.running && elapsed === 0 && (
          <button
            type="button"
            className="timer-btn timer-btn-primary"
            onClick={handleStart}
          >
            <Play size={14} /> 开始练习计时
          </button>
        )}

        {timerState.running && (
          <>
            <button
              type="button"
              className="timer-btn timer-btn-secondary"
              onClick={handlePause}
            >
              <Pause size={14} /> 暂停
            </button>
            <button
              type="button"
              className="timer-btn timer-btn-success"
              disabled={elapsed < 600}
              onClick={handleSettle}
              title={elapsed < 600 ? "需满 10 分钟方可结算" : "结算当前卡拉米奖励"}
            >
              <Check size={14} />
              {elapsed < 600 ? "需满10分结算" : `结束并结算 (+${currentTier}卡拉米)`}
            </button>
          </>
        )}

        {!timerState.running && elapsed > 0 && (
          <>
            <button
              type="button"
              className="timer-btn timer-btn-primary"
              onClick={handleStart}
            >
              <Play size={14} /> 继续
            </button>
            <button
              type="button"
              className="timer-btn timer-btn-success"
              disabled={elapsed < 600}
              onClick={handleSettle}
              title={elapsed < 600 ? "需满 10 分钟方可结算" : "结算当前卡拉米奖励"}
            >
              <Check size={14} />
              {elapsed < 600 ? "需满10分结算" : `结束并结算 (+${currentTier}卡拉米)`}
            </button>
            <button
              type="button"
              className="timer-btn timer-btn-ghost"
              onClick={handleReset}
              title="重置计时"
            >
              <RotateCcw size={14} /> 重置
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function DailyPage({
  data,
  today,
  onFinish,
  onMenu,
  onArrange,
  onTodo,
  onToggleStep,
  onOpenSplit,
}: {
  data: AppData;
  today: string;
  onFinish: (task: Task, duration?: number) => void;
  onMenu: (task: Task) => void;
  onArrange: () => void;
  onTodo: () => void;
  onToggleStep?: (task: Task, stepId: string) => void;
  onOpenSplit?: (task: Task) => void;
}) {
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const todayList = dailyView(data, today);
  const manualToday = Object.hasOwn(data.daily, today);
  const completedToday = data.completions.filter((item) => item.date === today);
  const earnedToday = data.rewards
    .filter((r) => r.date === today)
    .reduce((n, r) => n + r.amount, 0);
  return (
    <>
      <div className="page-bar">
        <h1>{longDate(today, true)}</h1>
        <div className="page-actions">
          <button
            className="text-button"
            aria-label={`调整今日安排，当前为${manualToday ? "手动" : "自动"}安排`}
            onClick={onArrange}
          >
            {manualToday ? "手动安排" : "自动安排"}
            <Settings2 size={14} />
          </button>
          <button className="pill-button" onClick={onTodo}>
            待办
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <p className="summary-line">
        今日完成 <strong>{completedToday.length}</strong> 项 · 获得{" "}
        <KalamiIcon size={14} /> <strong>{earnedToday}</strong> 卡拉米
      </p>
      <div className="task-stack">
        {todayList.length ? (
          todayList.map((task) => {
            const done = task.status === "done";
            const hasSteps = Boolean(task.steps && task.steps.length > 0);
            const doneSteps = task.steps
              ? task.steps.filter((s) => s.done).length
              : 0;
            const totalSteps = task.steps ? task.steps.length : 0;
            const percent = totalSteps
              ? Math.round((doneSteps / totalSteps) * 100)
              : 0;
            const isSubmenuOpen = openSubmenus[task.id] ?? false;

            return (
              <article
                className={`task-card ${done ? "is-done" : ""}`}
                key={task.id}
              >
                <TaskCheck
                  task={task}
                  onFinish={(t) => {
                    if (t.status === "open" && t.steps && t.steps.length > 0) {
                      const allDone = t.steps.every((s) => s.done);
                      if (!allDone) {
                        setOpenSubmenus((prev) => ({ ...prev, [t.id]: true }));
                        onFinish(t);
                        return;
                      }
                    }
                    onFinish(t);
                  }}
                />
                <div className="task-content">
                  <h3>{task.title}</h3>
                  <div className="task-meta">
                    <span className={`tag ${task.category}`}>
                      {CATEGORY[task.category].short}
                    </span>
                    {task.dueDate && !done && (
                      <span
                        className={`due ${task.dueDate < today ? "late" : ""}`}
                      >
                        {dateLabel(task.dueDate, today)}
                      </span>
                    )}
                  </div>
                  {task.kind !== "cantonese" && taskRewardHint(task, today) && (
                    <p className="reward-hint">{taskRewardHint(task, today)}</p>
                  )}
                  {task.kind === "cantonese" && !done && (
                    <CantoneseTimer task={task} onFinish={onFinish} />
                  )}
                  {task.kind === "cantonese" && done && (
                    <div className="cantonese-completed-summary">
                      {task.duration !== undefined ? (
                        <>
                          ⏱️ 练习时长 <strong>{Math.floor(task.duration / 60)}</strong> 分钟 · 获得 <strong>{taskReward(task, today)}</strong> 卡拉米
                          {task.duration >= 1800 ? "（已达成周目标）" : "（未满30分未计入周目标）"}
                        </>
                      ) : (
                        <>已完成 · 获得 <strong>{taskReward(task, today)}</strong> 卡拉米</>
                      )}
                    </div>
                  )}
                  {hasSteps && (
                    <div className="interview-steps-block">
                      <div
                        className="interview-progress-section"
                        role="button"
                        tabIndex={0}
                        aria-expanded={isSubmenuOpen}
                        aria-label={`准备进度：${percent}%已完成，点击${isSubmenuOpen ? "收起" : "展开"}细分步骤`}
                        onClick={() =>
                          setOpenSubmenus((prev) => ({
                            ...prev,
                            [task.id]: !isSubmenuOpen,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenSubmenus((prev) => ({
                              ...prev,
                              [task.id]: !isSubmenuOpen,
                            }));
                          }
                        }}
                      >
                        <div className="interview-progress-header">
                          <span className="step-pct-text">
                            {percent}% 已完成
                          </span>
                          <span className="step-count-text">
                            ({doneSteps}/{totalSteps})
                          </span>
                        </div>
                        <Progress
                          value={percent}
                          label={`准备进度 ${percent}%`}
                        />
                      </div>
                      {isSubmenuOpen && (
                        <div className="interview-submenu-box">
                          <div className="interview-submenu-header">
                            <span className="submenu-title">细分步骤</span>
                            {onOpenSplit && !done && (
                              <button
                                type="button"
                                className="text-button adjust-steps-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenSplit(task);
                                }}
                              >
                                调整小步
                              </button>
                            )}
                          </div>
                          <div
                            className="step-table"
                            role="table"
                            aria-label="准备步骤清单"
                          >
                            {task.steps!.map((step, idx) => {
                              const prevDone = task
                                .steps!.slice(0, idx)
                                .every((s) => s.done);
                              const nextNotDone = task
                                .steps!.slice(idx + 1)
                                .every((s) => !s.done);
                              const canToggle =
                                !done && (step.done ? nextNotDone : prevDone);
                              const isCurrent =
                                !done && !step.done && prevDone;

                              return (
                                <div
                                  key={step.id}
                                  className={`step-row ${step.done ? "is-step-done" : ""} ${isCurrent ? "is-step-current" : ""}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="step-col-check">
                                    <input
                                      type="checkbox"
                                      checked={step.done}
                                      disabled={!canToggle}
                                      aria-label={`第${idx + 1}步：${step.title}`}
                                      onChange={() =>
                                        onToggleStep?.(task, step.id)
                                      }
                                    />
                                  </div>
                                  <div className="step-col-name">
                                    <span className="step-num">{idx + 1}.</span>
                                    <span className="step-title">
                                      {step.title}
                                    </span>
                                    {isCurrent && (
                                      <span className="step-current-tag">
                                        当前进行
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {!task.steps &&
                    shouldSuggestInterviewSplit(task, today) &&
                    onOpenSplit && (
                      <div className="split-suggestion">
                        <span>已逾期3天以上，觉得压力大不妨拆成小步</span>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => onOpenSplit(task)}
                        >
                          拆成小步准备
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                </div>
                <button
                  className="icon-button more"
                  aria-label={`任务操作：${task.title}`}
                  onClick={() => onMenu(task)}
                >
                  <Ellipsis size={20} />
                </button>
              </article>
            );
          })
        ) : (
          <p className="empty-line">今天暂无任务</p>
        )}
      </div>
    </>
  );
}
