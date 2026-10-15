import { ChevronRight, Ellipsis, Settings2 } from "lucide-react";
import { CATEGORY, dailyView } from "../domain.ts";
import type { AppData, Task } from "../domain.ts";
import {
  dateLabel,
  interviewHint,
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
}: {
  data: AppData;
  today: string;
  onFinish: (task: Task) => void;
  onMenu: (task: Task) => void;
  onArrange: () => void;
  onTodo: () => void;
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
        <strong>{earnedToday}</strong> 卡拉米
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
