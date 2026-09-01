import { useEffect, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { useSessions } from "../hooks/useSessions";
import StatsCards from "../components/StatsCards";
import PromptTimeline from "../components/PromptTimeline";
import ToolStatsPanel from "../components/ToolStatsPanel";
import CompressionMonitorPanel from "../components/compression/CompressionMonitorPanel";
import CompressionLogsPanel from "../components/compression/CompressionLogsPanel";
import { formatTime, truncate } from "../lib/utils-helpers";
import { fetchPromptHistory } from "../lib/api";
import { PromptHistoryEntry, Session } from "../types";

/* Status color map (single source of truth) */
const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  running:   { bg: "#42804f", label: "运行中" },
  streaming: { bg: "#3f8f91", label: "流式传输" },
  completed: { bg: "#3d7ad2", label: "已完成" },
  error:     { bg: "#c94f43", label: "错误"   },
  idle:      { bg: "#8a8a91", label: "空闲"   },
};
const DEFAULT_STATUS = { bg: "#c9882f", label: "未知" };

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? DEFAULT_STATUS;
}

export default function DashboardPage() {
  const { status, tools } = useSystemStatus();
  const { sessions } = useSessions();
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchPromptHistory();
      setPromptHistory(data.history);
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!status) {
    return (
      <div className="h-[calc(100dvh-3.5rem)] flex flex-col items-center justify-center gap-3" role="status" aria-label="加载中" aria-live="polite">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse motion-reduce:animate-none [animation-delay:0ms]" aria-hidden="true" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse motion-reduce:animate-none [animation-delay:150ms]" aria-hidden="true" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse motion-reduce:animate-none [animation-delay:300ms]" aria-hidden="true" />
        </div>
        <span className="text-sm text-muted-foreground">加载系统状态...</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100dvh-3.5rem)]">
      <div className="p-6 space-y-4 max-w-[1400px] mx-auto" role="main" aria-label="仪表盘">
        {/* Stats Cards Row */}
        <section aria-label="系统指标概览">
          <StatsCards status={status} />
        </section>

        {/* Sessions Table */}
        <section aria-label="活跃会话">
          <SessionsTable sessions={sessions} />
        </section>

        {/* Tool Stats & Prompt Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 max-h-[350px] overflow-y-auto rounded-lg" role="region" aria-label="工具调用统计">
            <ToolStatsPanel tools={tools} stats={status.event_bus_stats} />
          </div>
          <div className="max-h-[350px] overflow-y-auto rounded-lg" role="region" aria-label="提示词历史时间线">
            {historyError ? (
              <div className="bg-card/50 border border-border rounded-lg p-4 h-full flex flex-col items-center justify-center gap-2" role="alert">
                <span className="text-sm text-red-400">加载提示词历史失败</span>
                <button
                  onClick={loadHistory}
                  className="text-xs text-primary hover:underline cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
                  aria-label="重新加载提示词历史"
                >
                  重试
                </button>
              </div>
            ) : (
              <PromptTimeline history={promptHistory} />
            )}
          </div>
        </div>

        {/* Compression Monitor */}
        <section className="bg-card/50 border border-border rounded-lg p-4" aria-label="压缩状态监控">
          <h3 className="text-xs font-medium text-foreground/80 mb-3">压缩状态监控</h3>
          <div className="max-h-[300px] overflow-y-auto rounded">
            <CompressionMonitorPanel compact={true} />
          </div>
        </section>

        {/* Compression Logs */}
        <section className="bg-card/50 border border-border rounded-lg p-4" aria-label="压缩日志">
          <h3 className="text-xs font-medium text-foreground/80 mb-3">压缩日志</h3>
          <div className="max-h-[300px] overflow-y-auto rounded">
            <CompressionLogsPanel compact={true} />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

// ============ Sessions Table ============

function StatusDot({ status }: { status: string }) {
  const isAnimated = status === "running" || status === "streaming";
  const style = getStatusStyle(status);
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${isAnimated ? "status-running" : ""}`}
        style={{ backgroundColor: style.bg }}
        aria-hidden="true"
      />
      <span className="text-xs text-foreground/75">{status}</span>
      <span className="sr-only">{style.label}</span>
    </span>
  );
}

function SessionsTable({ sessions }: { sessions: Session[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/50">
      <header className="flex h-10 items-center border-b border-border/60 px-4">
        <h3 className="text-xs font-medium text-foreground/80">会话实时状态</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="会话列表">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground/70">
              <th scope="col" className="py-2 px-4 text-left font-medium">ID</th>
              <th scope="col" className="py-2 px-4 text-left font-medium">类型</th>
              <th scope="col" className="py-2 px-4 text-left font-medium">状态</th>
              <th scope="col" className="w-full py-2 px-4 text-left font-medium">任务</th>
              <th scope="col" className="py-2 px-4 text-right font-medium">消息数</th>
              <th scope="col" className="py-2 px-4 text-right font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground/50 text-sm py-10" role="status" aria-label="暂无活跃会话">
                  暂无活跃会话
                </td>
              </tr>
            ) : (
              sessions.map((session) => {
                return (
                  <tr
                    key={session.session_id}
                    className="border-b border-border/40 transition-colors last:border-b-0 hover:bg-accent/40"
                    role="row"
                  >
                    <td className="py-2 px-4">
                      <span className="font-mono text-xs text-primary">{session.session_id}</span>
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-4 ${
                          session.type === "main"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        {session.type === "main" ? "MAIN" : "SUB"}
                      </span>
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <StatusDot status={session.status} />
                    </td>
                    <td className="max-w-0 w-full py-2 px-4">
                      <span className="block truncate text-xs text-muted-foreground" title={session.task || undefined}>
                        {truncate(session.task || (session.type === "main" ? "主会话" : "-"), 40)}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums">
                      <span className="text-xs text-muted-foreground">{session.message_count}</span>
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums whitespace-nowrap">
                      <span className="text-xs text-muted-foreground/70">{formatTime(session.updated_at)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
