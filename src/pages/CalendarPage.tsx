import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, dateObject, localDate, weekStart } from "../domain.ts";
import type { CalendarEvent, Completion, Task } from "../domain.ts";
import { longDate } from "../components.tsx";

export function CalendarPage({
  events,
  tasks = [],
  completions = [],
  daily,
  today,
  month,
  setMonth,
  selectedDate,
  setSelectedDate,
  openDay,
}: {
  events: CalendarEvent[];
  tasks?: Task[];
  completions?: Completion[];
  daily?: Record<string, string[]>;
  today: string;
  month: string;
  setMonth: (month: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  openDay: (date: string) => void;
}) {
  const firstOfMonth = `${month.slice(0, 7)}-01`;
  const shiftMonth = (amount: number) => {
    const d = dateObject(firstOfMonth);
    d.setMonth(d.getMonth() + amount, 1);
    setMonth(localDate(d));
  };

  // Group items (events, tasks by dueDate/daily, completions) by date for calendar display
  const itemsByDate = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; kind: string; done?: boolean }[]
    >();

    const pushItem = (
      date: string,
      item: { id: string; title: string; kind: string; done?: boolean },
    ) => {
      if (!date) return;
      const list = map.get(date) ?? [];
      const idx = list.findIndex((existing) => existing.title === item.title);
      if (idx >= 0) {
        if (item.done && !list[idx].done) {
          list[idx].done = true;
        }
      } else {
        list.push(item);
        map.set(date, list);
      }
    };

    // 1. Calendar events
    for (const event of events) {
      if (!event.date) continue;
      pushItem(event.date, {
        id: `ev-${event.id}`,
        title: event.title.trim(),
        kind: event.kind,
      });
    }

    // 2. Tasks with dueDate
    for (const task of tasks) {
      if (!task.dueDate) continue;
      pushItem(task.dueDate, {
        id: `task-${task.id}`,
        title: task.title.trim(),
        kind: task.kind === "interview" ? "interview" : task.category,
        done: task.status === "done",
      });
    }

    // 3. Tasks planned for specific days in daily
    if (daily) {
      for (const [day, taskIds] of Object.entries(daily)) {
        if (!Array.isArray(taskIds)) continue;
        for (const tid of taskIds) {
          const t = tasks.find((item) => item.id === tid);
          if (t) {
            pushItem(day, {
              id: `daily-${day}-${t.id}`,
              title: t.title.trim(),
              kind: t.kind === "interview" ? "interview" : t.category,
              done: t.status === "done",
            });
          }
        }
      }
    }

    // 4. Completed tasks on that day
    for (const c of completions) {
      if (!c.date) continue;
      pushItem(c.date, {
        id: `comp-${c.taskId}`,
        title: c.title.trim(),
        kind: c.kind === "interview" ? "interview" : c.category,
        done: true,
      });
    }

    return map;
  }, [events, tasks, completions, daily]);

  return (
    <section className="calendar-card">
      <div className="month-heading">
        <button
          className="icon-button"
          aria-label="上个月"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        <h2>
          {dateObject(firstOfMonth).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
          })}
        </h2>
        <button
          className="icon-button"
          aria-label="下个月"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="calendar-weekdays">
        {"一二三四五六日".split("").map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: 42 }, (_, i) =>
          addDays(weekStart(firstOfMonth), i),
        ).map((date) => {
          const items = itemsByDate.get(date) ?? [];
          const count = items.length;
          // Narrowed by one row height: 4 rows max per cell.
          // If > 4 items, show first 3 items and display +N on the bottom-most row.
          const hasOverflow = count > 4;
          const displayItems = hasOverflow ? items.slice(0, 3) : items;
          const moreCount = hasOverflow ? count - 3 : 0;

          return (
            <button
              key={date}
              aria-label={`${longDate(date)}${date === today ? "，今天" : ""}，${count ? `${count}项任务事项` : "无事项"}`}
              aria-pressed={selectedDate === date}
              className={`calendar-day-btn ${date.slice(0, 7) !== month.slice(0, 7) ? "other-month" : ""} ${date === today ? "today" : ""} ${date === selectedDate ? "selected" : ""}`}
              onClick={() => {
                setSelectedDate(date);
                openDay(date);
              }}
            >
              <div className="cal-day-header">
                <span className="cal-day-num">{dateObject(date).getDate()}</span>
              </div>
              {count > 0 && (
                <div className="cal-day-pills">
                  {displayItems.map((item) => (
                    <span
                      key={item.id}
                      className={`cal-task-pill ${item.kind} ${item.done ? "done" : ""}`}
                      title={item.title}
                    >
                      {item.title}
                    </span>
                  ))}
                  {moreCount > 0 && (
                    <span className="cal-task-pill cal-more-pill">
                      +{moreCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <button
        className="text-button calendar-today"
        onClick={() => {
          setMonth(`${today.slice(0, 7)}-01`);
          setSelectedDate(today);
        }}
      >
        回到今天
      </button>
    </section>
  );
}
