import { useState } from "react";
import { ChevronRight, Ellipsis, Settings2 } from "lucide-react";
import { CATEGORY, dailyView, shouldSuggestInterviewSplit } from "../domain.ts";
import type { AppData, Task } from "../domain.ts";
import {
  dateLabel,
  KalamiIcon,
  longDate,
  Progress,
  TaskCheck,
  taskRewardHint,
} from "../components.tsx";

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
  onFinish: (task: Task) => void;
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
                    <span className="priority">P{task.priority}</span>
                  </div>
                  {taskRewardHint(task, today) && (
                    <p className="reward-hint">{taskRewardHint(task, today)}</p>
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
                            <span className="submenu-title">细分准备步骤</span>
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
