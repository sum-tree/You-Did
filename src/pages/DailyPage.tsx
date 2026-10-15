import { ChevronRight, Ellipsis, Settings2 } from "lucide-react";
import { CATEGORY, dailyView, shouldSuggestInterviewSplit } from "../domain.ts";
import type { AppData, Task } from "../domain.ts";
import {
  dateLabel,
  interviewHint,
  KalamiIcon,
  longDate,
  TaskCheck,
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
            return (
              <article
                className={`task-card ${done ? "is-done" : ""}`}
                key={task.id}
              >
                <TaskCheck task={task} onFinish={onFinish} />
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
                  {interviewHint(task, today) && (
                    <p className="reward-hint">{interviewHint(task, today)}</p>
                  )}
                  {task.steps && task.steps.length > 0 && (
                    <div className="interview-steps-box">
                      <div className="interview-steps-header">
                        <span className="steps-progress-label">
                          准备步骤 {task.steps.filter((s) => s.done).length}/{task.steps.length}
                        </span>
                        {onOpenSplit && !done && (
                          <button
                            type="button"
                            className="text-button adjust-steps-btn"
                            onClick={() => onOpenSplit(task)}
                          >
                            调整小步
                          </button>
                        )}
                      </div>
                      <div className="step-checkbox-list">
                        {task.steps.map((step) => (
                          <label
                            key={step.id}
                            className={`step-item ${step.done ? "is-step-done" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={step.done}
                              disabled={done}
                              onChange={() => onToggleStep?.(task, step.id)}
                            />
                            <span>{step.title}</span>
                          </label>
                        ))}
                      </div>
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
