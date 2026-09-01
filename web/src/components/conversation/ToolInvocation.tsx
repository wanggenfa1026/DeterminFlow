import { memo, useId, useMemo, useState } from "react";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import type { ToolInvocationModel, ToolInvocationStatus } from "./conversationTypes";
import TechnicalDisclosure from "./TechnicalDisclosure";

interface StatusPresentation {
  label: string;
  icon: React.ReactNode;
  /** 仅在非成功态显示的尾部提示文字 */
  showLabel: boolean;
}

const STATUS_PRESENTATION: Record<ToolInvocationStatus, StatusPresentation> = {
  pending: {
    label: "等待结果",
    icon: <CircleDashed size={13} className="shrink-0 text-muted-foreground/60" aria-hidden="true" />,
    showLabel: true,
  },
  building: {
    label: "生成参数",
    icon: <Pencil size={13} className="shrink-0 animate-pulse text-amber-500 motion-reduce:animate-none" aria-hidden="true" />,
    showLabel: true,
  },
  running: {
    label: "执行中",
    icon: <Loader2 size={13} className="shrink-0 animate-spin text-amber-500 motion-reduce:animate-none" aria-hidden="true" />,
    showLabel: true,
  },
  succeeded: {
    label: "已完成",
    icon: <Check size={13} className="shrink-0 text-emerald-500" aria-hidden="true" />,
    showLabel: false,
  },
  failed: {
    label: "失败",
    icon: <X size={13} className="shrink-0 text-red-500" aria-hidden="true" />,
    showLabel: true,
  },
  cancelled: {
    label: "已取消",
    icon: <Ban size={13} className="shrink-0 text-muted-foreground/60" aria-hidden="true" />,
    showLabel: true,
  },
};

export interface ToolInvocationProps {
  invocation: ToolInvocationModel;
  className?: string;
}

/** 按优先级从参数 JSON 里挑一个最能说明这次调用的字段作摘要 */
const SUMMARY_KEYS = [
  "path",
  "file_path",
  "filepath",
  "file",
  "filename",
  "target_file",
  "command",
  "cmd",
  "script_name",
  "query",
  "pattern",
  "url",
  "workflow_id",
  "task_id",
  "session_id",
  "agent_type",
  "name",
  "label",
  "title",
  "message",
  "content",
] as const;

function summarizeArguments(raw: string | undefined): string | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // 参数还在流式生成或非 JSON
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  for (const key of SUMMARY_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      const compact = value.trim().replace(/\s+/g, " ");
      return compact.length > 64 ? `${compact.slice(0, 64)}…` : compact;
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return null;
}

function ToolInvocation({ invocation, className = "" }: ToolInvocationProps) {
  const bodyId = useId();
  const [expanded, setExpanded] = useState(false);
  const presentation = STATUS_PRESENTATION[invocation.status];
  const argsSummary = useMemo(
    () => summarizeArguments(invocation.arguments),
    [invocation.arguments],
  );
  const hasArguments = !!invocation.arguments && invocation.arguments.trim() !== "{}";
  const hasResult = invocation.result !== undefined;
  const hasBody = hasArguments || hasResult || !!invocation.error;
  const failed = invocation.status === "failed";

  return (
    <div
      aria-label={`工具调用 ${invocation.name}，${presentation.label}`}
      className={`px-1 ${className}`}
    >
      <button
        type="button"
        onClick={() => hasBody && setExpanded((value) => !value)}
        aria-expanded={hasBody ? expanded : undefined}
        aria-controls={hasBody ? bodyId : undefined}
        disabled={!hasBody}
        className={`group inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 ${
          failed ? "border-red-500/25 bg-red-500/5" : "border-border/50 bg-card/40"
        } ${hasBody ? "cursor-pointer hover:border-border hover:bg-accent/50" : "cursor-default"}`}
      >
        {presentation.icon}
        <span
          className={`shrink-0 font-mono text-[12px] leading-5 ${failed ? "text-red-400" : "text-foreground/75"}`}
          title={invocation.name}
        >
          {invocation.name}
        </span>
        {argsSummary && (
          <span
            className="min-w-0 max-w-[320px] truncate font-mono text-[11px] text-muted-foreground/70"
            title={argsSummary}
          >
            {argsSummary}
          </span>
        )}
        {presentation.showLabel && (
          <span className="shrink-0 text-[11px] text-muted-foreground/70" role="status">
            {presentation.label}
          </span>
        )}
        {hasBody && (
          <span className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
            {expanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
          </span>
        )}
      </button>

      {expanded && hasBody && (
        <div id={bodyId} className="ml-2 mt-1 border-l border-border/60 pl-3">
          {hasArguments && <TechnicalDisclosure label="参数" value={invocation.arguments} />}
          {invocation.error && (
            <TechnicalDisclosure label="错误" value={invocation.error} tone="error" />
          )}
          {hasResult && (
            <TechnicalDisclosure
              label={failed ? "失败结果" : "结果"}
              value={invocation.result || ""}
              tone={failed ? "error" : "neutral"}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ToolInvocation);
