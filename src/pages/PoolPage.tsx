import { ArrowRight, ChevronLeft } from "lucide-react";
import {
  addDays,
  CATEGORY,
  generatedSeries,
  SERIES_NAME,
  shouldSuggestInterviewSplit,
  weekStart,
} from "../domain.ts";
import type { AppData, Category, Task } from "../domain.ts";
import {
  contributionLabel,
  dateLabel,
  shortDate,
  taskRewardHint,
} from "../components.tsx";

// Held by App so the filters survive switching pages.
export interface PoolView {
  week: "current" | "next" | "past" | "archived";
  filter: Category | "all";
  expanded: string | null;
}
export const initialPoolView: PoolView = {
  week: "current",
  filter: "all",
  expanded: null,
};
type Row =
  | { key: string; task: Task }
  | { key: string; series: keyof typeof SERIES_NAME; tasks: Task[] };
const rowPriority = (row: Row) =>
  "task" in row ? row.task.priority : Math.min(...row.tasks.map((t) => t.priority));
const rowDue = (row: Row) => ("task" in row ? row.task.dueDate : "") || "9999";
const rowCreated = (row: Row) =>
  "task" in row ? row.task.createdAt : row.tasks[0].createdAt;
// The todo list only plans: it shows open tasks (completing happens on daily),
// and folds each weekly generated series into one quiet row so the list stays
// short. The archive view stays per task so items can still be restored.
export function PoolPage({
  data,
  today,
  view,
  setView,
  onMenu,
  onBack,
  onOpenSplit,
}: {
  data: AppData;
  today: string;
  view: PoolView;
  setView: (view: PoolView) => void;
  onMenu: (task: Task) => void;
  onBack: () => void;
  onOpenSplit?: (task: Task) => void;
}) {
  const week = weekStart(today);
  const archived = view.week === "archived";
  const tasks = data.tasks.filter((task) => {
    if (view.filter !== "all" && task.category !== view.filter) return false;
    if (archived) return task.status === "archived";
    if (task.status !== "open") return false;
    return view.week === "current"
      ? task.plannedWeek === week
      : view.week === "next"
        ? task.plannedWeek === addDays(week, 7)
        : task.plannedWeek < week;
  });
  const rows: Row[] = [];
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const series = archived ? undefined : generatedSeries(task);
    if (!series) {
      rows.push({ key: task.id, task });
      continue;
    }
    if (!groups.has(series)) {
      groups.set(series, []);
      rows.push({ key: `series:${series}`, series, tasks: groups.get(series)! });
    }
    groups.get(series)!.push(task);
  }
  rows.sort(
    (a, b) =>
      rowPriority(a) - rowPriority(b) ||
      rowDue(a).localeCompare(rowDue(b)) ||
      rowCreated(a).localeCompare(rowCreated(b)),
  );
  return (
    <>
      <div className="sub-bar">
        <button className="text-button" onClick={onBack}>
          <ChevronLeft size={16} />
          每日
        </button>
        <h1>待办</h1>
      </div>
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
        </div>
        {!archived && <p className="table-count">未完成 {rows.length} 项</p>}
        <div className="todo-head" aria-hidden="true">
          <span>标题</span>
          <span>优先</span>
          <span>类型</span>
          <span>DDL</span>
        </div>
        {rows.length ? (
          rows.map((row) => {
            if (!("task" in row)) {
              const first = row.tasks[0];
              return (
                <div className="todo-row" key={row.key}>
                  <div className="todo-main">
                    <span className="todo-title">{SERIES_NAME[row.series]}</span>
                    <span className="todo-priority">P{rowPriority(row)}</span>
                    <span className={`tag ${first.category}`}>
                      {CATEGORY[first.category].short}
                    </span>
                    <span className="todo-due">—</span>
                  </div>
                </div>
              );
            }
            const task = row.task;
            const open = view.expanded === task.id;
            return (
              <div className="todo-row" key={row.key}>
                <div className="todo-main">
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
                    className={`todo-due ${task.dueDate && task.dueDate < today ? "late" : ""}`}
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
                    <span>{dateLabel(task.dueDate, today)}</span>
                    {taskRewardHint(task, today) && (
                      <span className="reward-hint">
                        {taskRewardHint(task, today)}
                      </span>
                    )}
                    {task.steps && task.steps.length > 0 && (
                      <span className="steps-progress-label">
                        准备进度{" "}
                        {Math.round(
                          (task.steps.filter((s) => s.done).length /
                            task.steps.length) *
                            100,
                        )}
                        % ({task.steps.filter((s) => s.done).length}/
                        {task.steps.length})
                      </span>
                    )}
                    {task.kind === "interview" &&
                      task.status === "open" &&
                      onOpenSplit && (
                        <button
                          className="text-button"
                          onClick={() => onOpenSplit(task)}
                        >
                          {task.steps && task.steps.length > 0
                            ? "调整准备小步"
                            : shouldSuggestInterviewSplit(task, today)
                              ? "逾期建议：拆成小步准备"
                              : "拆成小步准备"}
                          <ArrowRight size={14} />
                        </button>
                      )}
                    <button
                      className="text-button"
                      onClick={() => onMenu(task)}
                    >
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
    </>
  );
}
