import {
  ArrowRight,
  ChevronRight,
  Clock3,
  Ellipsis,
  Settings2,
} from "lucide-react";
import { CATEGORY, dailyView } from "../domain.ts";
import type { AppData, Task } from "../domain.ts";
import {
  contributionLabel,
  dateLabel,
  longDate,
  TaskCheck,
} from "../components.tsx";

export function DailyPage({
  data,
  today,
  onFinish,
  onMenu,
  onEdit,
  onArrange,
}: {
  data: AppData;
  today: string;
  onFinish: (task: Task) => void;
  onMenu: (task: Task) => void;
  onEdit: (task: Task) => void;
  onArrange: () => void;
}) {
  const todayList = dailyView(data, today);
  const manualToday = Object.hasOwn(data.daily, today);
  const urgent = data.tasks
    .filter(
      (task) => task.status === "open" && task.dueDate && task.dueDate <= today,
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completedToday = data.completions.filter((item) => item.date === today);
  const earnedToday = data.rewards
    .filter((r) => r.date === today)
    .reduce((n, r) => n + r.amount, 0);
  return (
    <>
      <div className="page-bar">
        <h1>{longDate(today, true)}</h1>
        <button
          className="text-button"
          aria-label={`调整今日安排，当前为${manualToday ? "手动" : "自动"}安排`}
          onClick={onArrange}
        >
          {manualToday ? "手动安排" : "自动安排"}
          <Settings2 size={14} />
        </button>
      </div>
      <p className="summary-line">
        今日完成 <strong>{completedToday.length}</strong> 项 · 获得{" "}
        <strong>{earnedToday}</strong> 卡拉米
      </p>
      {urgent.length > 0 && (
        <details className="urgent-panel" open={urgent.length > 3}>
          <summary>
            <Clock3 size={17} />
            <span>{urgent.length}项到期或逾期</span>
            <ChevronRight size={17} />
          </summary>
          <p>核心任务最多3项。如今天安排过满，可手动调整截止日期。</p>
          {urgent.map((task) => (
            <button key={task.id} onClick={() => onEdit(task)}>
              <span>
                {task.title}
                <small>{dateLabel(task.dueDate, today)}</small>
              </span>
              <span>
                改DDL
                <ArrowRight size={13} />
              </span>
            </button>
          ))}
        </details>
      )}
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
                    <span
                      className={`due ${task.dueDate && task.dueDate < today && !done ? "late" : ""}`}
                    >
                      {done ? "已完成" : dateLabel(task.dueDate, today)}
                    </span>
                    {task.kind !== "none" && (
                      <span className="due">{contributionLabel(task)}</span>
                    )}
                    <span className="priority">P{task.priority}</span>
                  </div>
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
