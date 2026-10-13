import { ArrowRight } from "lucide-react";
import { addDays, CATEGORY, weekStart } from "../domain.ts";
import type { AppData, Category, Task } from "../domain.ts";
import {
  contributionLabel,
  dateLabel,
  shortDate,
  TaskCheck,
} from "../components.tsx";

// Held by App so the filters survive switching pages.
export interface PoolView {
  week: "current" | "next" | "past" | "archived";
  filter: Category | "all";
  showDone: boolean;
  expanded: string | null;
}
export const initialPoolView: PoolView = {
  week: "current",
  filter: "all",
  showDone: false,
  expanded: null,
};
export function PoolPage({
  data,
  today,
  view,
  setView,
  onFinish,
  onMenu,
}: {
  data: AppData;
  today: string;
  view: PoolView;
  setView: (view: PoolView) => void;
  onFinish: (task: Task) => void;
  onMenu: (task: Task) => void;
}) {
  const week = weekStart(today);
  const pool = data.tasks
    .filter((task) => {
      if (view.filter !== "all" && task.category !== view.filter) return false;
      if (view.week === "archived") return task.status === "archived";
      if (
        task.status === "archived" ||
        (!view.showDone && task.status === "done")
      )
        return false;
      return view.week === "current"
        ? task.plannedWeek === week
        : view.week === "next"
          ? task.plannedWeek === addDays(week, 7)
          : task.plannedWeek < week;
    })
    .sort(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        a.priority - b.priority ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const openCount = pool.filter((task) => task.status === "open").length;
  return (
    <section className="todo-table" aria-label="待办清单">
      <div className="table-tools">
        <select
          aria-label="计划周筛选"
          value={view.week}
          onChange={(e) =>
            setView({
              ...view,
              week: e.target.value as PoolView["week"],
              expanded: null,
            })
          }
        >
          <option value="current">本周</option>
          <option value="next">下周</option>
          <option value="past">往周</option>
          <option value="archived">已清空</option>
        </select>
        <select
          aria-label="类型筛选"
          value={view.filter}
          onChange={(e) =>
            setView({ ...view, filter: e.target.value as PoolView["filter"] })
          }
        >
          <option value="all">全部类型</option>
          {Object.entries(CATEGORY).map(([key, value]) => (
            <option key={key} value={key}>
              {value.name}
            </option>
          ))}
        </select>
        {view.week !== "archived" && (
          <label className="done-toggle">
            <input
              type="checkbox"
              checked={view.showDone}
              onChange={(e) => setView({ ...view, showDone: e.target.checked })}
            />
            已完成
          </label>
        )}
      </div>
      {view.week !== "archived" && (
        <p className="table-count">未完成 {openCount} 项</p>
      )}
      <div className="todo-head" aria-hidden="true">
        <span />
        <span>标题</span>
        <span>优先</span>
        <span>类型</span>
        <span>DDL</span>
      </div>
      {pool.length ? (
        pool.map((task) => {
          const done = task.status === "done";
          const open = view.expanded === task.id;
          return (
            <div className={`todo-row ${done ? "is-done" : ""}`} key={task.id}>
              <div className="todo-main">
                <TaskCheck task={task} onFinish={onFinish} />
                <button
                  className="todo-title"
                  aria-expanded={open}
                  onClick={() =>
                    setView({ ...view, expanded: open ? null : task.id })
                  }
                >
                  {task.title}
                </button>
                <span className="todo-priority">P{task.priority}</span>
                <span className={`tag ${task.category}`}>
                  {CATEGORY[task.category].short}
                </span>
                <span
                  className={`todo-due ${task.dueDate && task.dueDate < today && !done ? "late" : ""}`}
                >
                  {!task.dueDate
                    ? "—"
                    : task.dueDate === today
                      ? "今天"
                      : shortDate(task.dueDate)}
                </span>
              </div>
              {open && (
                <div className="todo-detail">
                  <span>计划周 · {shortDate(task.plannedWeek)}起</span>
                  <span>{contributionLabel(task)}</span>
                  <span>{done ? "已完成" : dateLabel(task.dueDate, today)}</span>
                  <button className="text-button" onClick={() => onMenu(task)}>
                    任务操作
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <p className="table-empty">暂无记录</p>
      )}
    </section>
  );
}
