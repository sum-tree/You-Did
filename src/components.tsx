import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Check,
  Mic,
  Plus,
  X,
} from "lucide-react";
import {
  CATEGORY,
  dateObject,
  inferContribution,
  interviewRewardInfo,
  KIND,
  weekStart,
} from "./domain.ts";
import type { CalendarEvent, Category, Task } from "./domain.ts";

export const shortDate = (date: string) =>
  dateObject(date).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
export const longDate = (date: string, weekday = false) =>
  dateObject(date).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    ...(weekday ? { weekday: "long" } : {}),
  });
export const eventKind = (kind: CalendarEvent["kind"]) =>
  kind === "interview" ? "面试 / 测试" : kind === "deadline" ? "重要DDL" : "提醒";
// Interview cards show the reward available now and the next step, not a countdown.
export function interviewHint(task: Task, today: string): string | null {
  if (task.kind !== "interview" || task.status !== "open") return null;
  const info = interviewRewardInfo(task, today);
  return info.next === undefined
    ? `完成可得${info.now}`
    : `完成可得${info.now} · ${info.inDays}天后变为${info.next}`;
}
export const contributionLabel = (task: Task) =>
  `${KIND[task.kind].label.split("（")[0]} · ${task.amount}${KIND[task.kind].unit}`;
export function TaskCheck({
  task,
  onFinish,
}: {
  task: Task;
  onFinish: (task: Task) => void;
}) {
  const done = task.status === "done";
  return (
    <button
      className={`task-check ${done ? "checked" : ""}`}
      aria-label={`${done ? "点击撤销完成" : "完成任务"}：${task.title}`}
      onClick={() => onFinish(task)}
    >
      {done && <Check size={17} />}
    </button>
  );
}
export const dateLabel = (date: string, today: string) =>
  !date
    ? "无截止日期"
    : date === today
      ? "今天截止"
      : date < today
        ? `已逾期 · ${shortDate(date)}`
        : `${shortDate(date)}截止`;
export const categoryIcon = (category: Category, size = 20) =>
  category === "job" ? (
    <BriefcaseBusiness size={size} />
  ) : category === "speech" ? (
    <Mic size={size} />
  ) : (
    <BookOpen size={size} />
  );
export function KalamiIcon({
  size = 18,
  variant = "red",
  className = "",
}: {
  size?: number;
  variant?: "red" | "green" | "blue";
  className?: string;
}) {
  const id = useId();
  const colors = {
    red: {
      light: "#fce5e2",
      base: "#f79389",
      deep: "#e87b70",
      beak: "#a6746f",
    },
    green: {
      light: "#eaf8e6",
      base: "#a1e590",
      deep: "#88d675",
      beak: "#7da773",
    },
    blue: {
      light: "#f6f9fc",
      base: "#dee9f6",
      deep: "#c3d6eb",
      beak: "#a9bed5",
    },
  }[variant];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={`kalami-icon ${className}`}
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "-0.2em", flexShrink: 0 }}
    >
      <defs>
        <radialGradient
          id={`kalami-icon-grad-${id}`}
          cx="35%"
          cy="28%"
          r="75%"
        >
          <stop offset="0%" stopColor={colors.light} />
          <stop offset="65%" stopColor={colors.base} />
          <stop offset="100%" stopColor={colors.deep} />
        </radialGradient>
      </defs>
      <ellipse cx="10" cy="17.2" rx="6.5" ry="1.6" fill={colors.deep} opacity="0.25" />
      <path
        d="M 2.5, 11 C 2.5, 5.2, 5.8, 2.5, 10, 2.5 C 14.2, 2.5, 17.5, 5.2, 17.5, 11 C 17.5, 15.5, 14.5, 18.2, 10, 18.2 C 5.5, 18.2, 2.5, 15.5, 2.5, 11 Z"
        fill={`url(#kalami-icon-grad-${id})`}
        stroke="#5e5f5f"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M 5, 8.5 C 5, 5.6 7.2, 4.2 9.8, 4.2 C 10.4, 4.2 10.5, 4.8 9.9, 4.9 C 7.8, 5.3 6.3, 6.8 6.1, 8.9 C 6, 9.5 5, 9.3 5, 8.5 Z"
        fill="#ffffff"
        opacity="0.8"
      />
      <circle cx="11.8" cy="5.4" r="0.6" fill="#ffffff" opacity="0.8" />
      <circle cx="7" cy="9.8" r="0.75" fill="#5e5f5f" />
      <circle cx="13" cy="9.5" r="0.75" fill="#5e5f5f" />
      <path
        d="M 8.6, 11.2 L 11.4, 10.9 L 10, 13 Z"
        fill={colors.beak}
        stroke="#5e5f5f"
        strokeWidth="0.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function download(content: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function shareOrDownload(content: string, name: string) {
  try {
    const file = new File([content], name, { type: "application/json" });
    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [file] }) &&
      navigator.share
    ) {
      await navigator.share({
        files: [file],
        title: name,
      });
      return;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
  }
  download(content, name);
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  notice,
  exportPending,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  notice?: string;
  exportPending?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
    ref.current
      ?.querySelector<HTMLInputElement>(
        'input:not([type="checkbox"]),textarea,select',
      )
      ?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="section-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {notice && (
          <p className="form-note" role="alert">
            {notice}
          </p>
        )}
        {exportPending && (
          <button className="outline-button full" onClick={exportPending}>
            导出待保存备份
          </button>
        )}
        {children}
      </div>
    </dialog>
  );
}
export function TaskForm({
  existing,
  today,
  defaultToday = false,
  commit,
  close: _close,
}: {
  existing?: Task;
  today: string;
  defaultToday?: boolean;
  commit: (task: Task, todaySelected: boolean, addToCalendar?: boolean) => void;
  close?: () => void;
}) {
  const [category, setCategory] = useState<Category>(
    existing?.category ?? "job",
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title")).trim();
    if (!title) {
      const input = event.currentTarget.elements.namedItem(
        "title",
      ) as HTMLInputElement;
      input.setCustomValidity("请填写任务名称，不能只有空格。");
      input.reportValidity();
      return;
    }
    commit(
      {
        id: existing?.id ?? crypto.randomUUID(),
        title,
        category,
        priority: Number(fields.get("priority")) as 0 | 1 | 2,
        dueDate: String(fields.get("dueDate")),
        // New tasks start in this week; use "移至下周" to plan ahead.
        plannedWeek: existing?.plannedWeek ?? weekStart(today),
        ...inferContribution(title, category),
        status: "open",
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      },
      fields.get("today") === "on",
      fields.get("calendar") === "on",
    );
  };
  return (
    <form onSubmit={submit} className="form">
      <label>
        想完成什么？
        <input
          name="title"
          aria-label="任务名称"
          required
          maxLength={200}
          placeholder="例如：投递3份心仪的岗位"
          defaultValue={existing?.title}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          autoFocus
        />
      </label>
      <label>
        任务类型
        <select
          aria-label="任务类型"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {Object.entries(CATEGORY).map(([key, value]) => (
            <option key={key} value={key}>
              {value.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          优先级
          <select name="priority" defaultValue={existing?.priority ?? 1}>
            <option value="0">P0</option>
            <option value="1">P1</option>
            <option value="2">P2</option>
          </select>
        </label>
        <label>
          截止日期（选填）
          <input
            name="dueDate"
            type="date"
            defaultValue={existing?.dueDate ?? ""}
            min="1900-01-01"
            max="2100-12-31"
          />
        </label>
      </div>
      {!existing && (
        <div className="form-checkboxes">
          <label className="checkbox-label">
            <input name="today" type="checkbox" defaultChecked={defaultToday} />
            加入今日任务
          </label>
          <label className="checkbox-label">
            <input name="calendar" type="checkbox" />
            加入日历
          </label>
        </div>
      )}
      <button className="primary" type="submit">
        {existing ? "保存修改" : "添加任务"}
        <Plus size={18} />
      </button>
    </form>
  );
}
export function EventForm({
  existing,
  date,
  commit,
}: {
  existing?: CalendarEvent;
  date: string;
  commit: (event: CalendarEvent) => void;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const title = String(f.get("title")).trim();
        if (!title) {
          const input = e.currentTarget.elements.namedItem(
            "title",
          ) as HTMLInputElement;
          input.setCustomValidity("请填写事项名称，不能只有空格。");
          input.reportValidity();
          return;
        }
        commit({
          id: existing?.id ?? crypto.randomUUID(),
          title,
          date: String(f.get("date")),
          time: String(f.get("time")),
          kind: String(f.get("kind")) as CalendarEvent["kind"],
          note: String(f.get("note")).trim(),
        });
      }}
    >
      <label>
        重要事项
        <input
          name="title"
          required
          maxLength={200}
          placeholder="例如：公司面试 / 作业DDL"
          defaultValue={existing?.title}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          autoFocus
        />
      </label>
      <div className="form-row">
        <label>
          日期
          <input
            name="date"
            type="date"
            required
            defaultValue={existing?.date ?? date}
            min="1900-01-01"
            max="2100-12-31"
          />
        </label>
        <label>
          时间（选填）
          <input name="time" type="time" defaultValue={existing?.time} />
        </label>
      </div>
      <label>
        事项类型
        <select name="kind" defaultValue={existing?.kind ?? "reminder"}>
          <option value="interview">面试 / 测试</option>
          <option value="deadline">重要截止日期</option>
          <option value="reminder">提醒事项</option>
        </select>
      </label>
      <label>
        备注
        <textarea
          name="note"
          maxLength={1000}
          rows={3}
          placeholder="地点、准备事项……"
          defaultValue={existing?.note}
        />
      </label>
      <p className="form-note">日历事项用于提醒，不自动计入任务或发放积分。</p>
      <button className="primary" type="submit">
        {existing ? "保存事项" : "添加事项"}
        <Plus size={18} />
      </button>
    </form>
  );
}
