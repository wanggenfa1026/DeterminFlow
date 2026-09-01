import { useCallback, useEffect, useState } from "react";
import { ExternalLink, ListTodo, Loader2, PanelLeftClose } from "lucide-react";

import type { WorkflowTask } from "../../types";

export type WorkflowTaskPatch = Pick<WorkflowTask, "workflow_id" | "task_id" | "status"> &
  Partial<Omit<WorkflowTask, "workflow_id" | "task_id" | "status">>;

function taskTimestamp(task: WorkflowTask): string {
  return task.updated_at || task.completed_at || task.started_at || task.created_at;
}

function patchTimestamp(patch: WorkflowTaskPatch): string {
  return patch.updated_at
    || patch.completed_at
    || patch.started_at
    || patch.created_at
    || "";
}

// eslint-disable-next-line react-refresh/only-export-components -- pure merge helper is covered by node:test
export function upsertWorkflowTask(
  tasks: WorkflowTask[],
  patch: WorkflowTaskPatch,
): WorkflowTask[] {
  const existing = tasks.find(
    (task) => task.workflow_id === patch.workflow_id && task.task_id === patch.task_id,
  );
  if (
    existing
    && patchTimestamp(patch)
    && taskTimestamp(existing).localeCompare(patchTimestamp(patch)) > 0
  ) {
    return tasks;
  }
  const merged: WorkflowTask = {
    name: patch.task_id,
    current_node_id: null,
    run_id: null,
    created_at: patch.created_at || new Date(0).toISOString(),
    started_at: null,
    completed_at: null,
    node_states: patch.node_states || existing?.node_states || {},
    ...existing,
    ...patch,
  };
  return [
    merged,
    ...tasks.filter(
      (task) => task.workflow_id !== patch.workflow_id || task.task_id !== patch.task_id,
    ),
  ].sort((left, right) => taskTimestamp(right).localeCompare(taskTimestamp(left)));
}

const STATUS_LABELS: Record<WorkflowTask["status"], string> = {
  pending: "待启动",
  pre_running: "待确认",
  resume_pending: "恢复中",
  running: "运行中",
  retry_waiting: "等待重试",
  completed: "已完成",
  failed: "失败",
  stopped: "已停止",
};

const ACTIVE_STATUSES: ReadonlySet<WorkflowTask["status"]> = new Set([
  "pending",
  "pre_running",
  "resume_pending",
  "running",
  "retry_waiting",
]);

const DOT_STYLES: Record<WorkflowTask["status"], string> = {
  pending: "bg-slate-400/70",
  pre_running: "bg-amber-400",
  resume_pending: "bg-cyan-400",
  running: "bg-primary",
  retry_waiting: "bg-amber-400",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  stopped: "bg-slate-400/70",
};

const COLLAPSE_STORAGE_KEY = "chat.tasksSidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface ChatWorkflowTasksProps {
  tasks: WorkflowTask[];
  loading?: boolean;
  onOpenTask: (task: WorkflowTask) => void;
}

function TaskItem({ task, onOpenTask }: { task: WorkflowTask; onOpenTask: (task: WorkflowTask) => void }) {
  const progress = task.progress;
  const isRunning = task.status === "running" || task.status === "resume_pending";
  const percent = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
    : null;
  return (
    <button
      type="button"
      onClick={() => onOpenTask(task)}
      className="group flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
      aria-label={`查看任务 ${task.name}`}
      title={task.name}
    >
      <span className="flex w-full items-center gap-2">
        {isRunning ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_STYLES[task.status]}`} aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">{task.name}</span>
        <ExternalLink
          className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground"
          aria-hidden="true"
        />
      </span>
      <span className="flex items-center gap-1.5 pl-5 text-[11px] leading-4 text-muted-foreground">
        <span>{STATUS_LABELS[task.status]}</span>
        {progress && progress.total > 0 && (
          <span className="tabular-nums">{progress.completed}/{progress.total}</span>
        )}
        {task.main_takeover && (
          <span className="rounded-sm bg-violet-500/10 px-1 py-px text-[10px] text-violet-400">接管</span>
        )}
      </span>
      {isRunning && percent !== null && (
        <span className="ml-5 mr-1 block h-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </span>
      )}
    </button>
  );
}

export default function ChatWorkflowTasks({
  tasks,
  loading = false,
  onOpenTask,
}: ChatWorkflowTasksProps) {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // storage unavailable (private mode etc.) — keep in-memory state only
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((value) => !value), []);

  if (!loading && tasks.length === 0) return null;

  const active = tasks.filter((task) => ACTIVE_STATUSES.has(task.status));
  const finished = tasks.filter((task) => !ACTIVE_STATUSES.has(task.status));

  if (collapsed) {
    return (
      <aside
        className="hidden shrink-0 flex-col items-center border-r border-border bg-card/50 py-2 md:flex"
        aria-label="后台任务（已折叠）"
      >
        <button
          type="button"
          onClick={toggle}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          aria-label="展开后台任务面板"
          aria-expanded={false}
          title="后台任务"
        >
          <ListTodo className="h-4 w-4" aria-hidden="true" />
          {active.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-medium leading-none text-primary-foreground">
              {active.length}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="hidden w-[232px] shrink-0 flex-col border-r border-border bg-card/50 md:flex"
      aria-label="后台任务"
    >
      <header className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border/60 px-3">
        <ListTodo className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium text-foreground/80">后台任务</span>
        {active.length > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium tabular-nums text-primary">
            {active.length}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={toggle}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          aria-label="折叠后台任务面板"
          aria-expanded
        >
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
        {loading && tasks.length === 0 && (
          <div className="flex items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            加载中…
          </div>
        )}
        {active.length > 0 && (
          <section aria-label="进行中的任务">
            <h3 className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              进行中
            </h3>
            <div className="space-y-0.5">
              {active.map((task) => (
                <TaskItem key={`${task.workflow_id}:${task.task_id}`} task={task} onOpenTask={onOpenTask} />
              ))}
            </div>
          </section>
        )}
        {finished.length > 0 && (
          <section aria-label="已结束的任务">
            <h3 className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              已结束
            </h3>
            <div className="space-y-0.5">
              {finished.map((task) => (
                <TaskItem key={`${task.workflow_id}:${task.task_id}`} task={task} onOpenTask={onOpenTask} />
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
