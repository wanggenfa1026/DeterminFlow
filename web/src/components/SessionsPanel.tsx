import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, X, Plus, ChevronDown, ChevronRight, Zap } from "lucide-react";
import { Session } from "../types";
import { getStatusConfig, formatRelativeTime } from "../lib/utils-helpers";
import { useAgentTypes } from "../hooks/useAgentTypes";
import { canDeleteMainSession } from "./sessionPolicy";

interface SessionsPanelProps {
  sessions: Session[];
  viewingSessionId: string | null;
  mainSessionId: string | null;
  onViewSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  onKillSession: (sessionId: string, e: React.MouseEvent) => void;
  onCreateSession: (agentType?: string) => void;
}

function isWorkflowMain(session: Session): boolean {
  return session.type === "main" && (session.task || "").startsWith("Workflow:");
}

const AGENT_TYPE_LABELS: Record<string, string> = {
  main: "通用助手",
  coder: "编码助手",
  reviewer: "审查助手",
  researcher: "研究助手",
  reader: "阅读助手",
  default: "默认助手",
};

function SessionCard({
  session, isViewing, isSub, canDelete, canKill,
  onViewSession, onDeleteSession, onKillSession,
}: {
  session: Session; isViewing: boolean;
  isSub: boolean; canDelete: boolean; canKill: boolean;
  onViewSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onKillSession: (id: string, e: React.MouseEvent) => void;
}) {
  const cfg = getStatusConfig(session.status);
  const wfMain = isWorkflowMain(session);
  const label = session.type === "main"
    ? (wfMain ? "WF-MAIN" : "MAIN")
    : "SUB";

  return (
    <div
      key={session.session_id}
      role="button"
      tabIndex={0}
      onClick={() => onViewSession(session.session_id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewSession(session.session_id); } }}
      aria-label={`${session.type === "main" ? "主会话" : "子会话"} ${session.session_id}，${session.task || ""}`}
      className={`group relative cursor-pointer rounded-md transition-colors ${
        isSub ? "py-1.5 pl-6 pr-2" : "px-2 py-2"
      } ${
        isViewing ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >

      {/* 第 1 行：状态点 + 会话 ID + 徽章 + 时间 */}
      <div className="flex min-w-0 items-baseline gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 self-center rounded-full ${cfg.dotColor}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">
          {session.session_id}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
          {formatRelativeTime(session.updated_at)}
        </span>
      </div>

      {/* 第 2 行：描述 + 消息数 + 悬停操作 */}
      <div className="mt-0.5 flex min-w-0 items-center gap-2 pl-[14px]">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {session.task || (session.type === "main" ? "主会话" : "")}
          <span className="text-muted-foreground/50"> · {session.message_count} 条</span>
          {session.agent_type && session.agent_type !== "main" && (
            <span className="text-muted-foreground/50"> · {session.agent_type}</span>
          )}
        </span>
        <span className={`shrink-0 text-[10px] uppercase tracking-wide ${wfMain ? "text-muted-foreground/60" : cfg.color}`}>
          {label}
        </span>
        {(canKill || canDelete) && (
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {canKill && (
              <button
                type="button"
                onClick={(e) => onKillSession(session.session_id, e)}
                aria-label={`终止会话 ${session.session_id}`}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-amber-400 cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={(e) => onDeleteSession(session.session_id, e)}
                aria-label={`删除会话 ${session.session_id}`}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-red-400 cursor-pointer"
              >
                <Trash2 size={11} />
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SessionsPanel({
  sessions, viewingSessionId, mainSessionId,
  onViewSession, onDeleteSession, onKillSession, onCreateSession,
}: SessionsPanelProps) {
  const [collapsedMains, setCollapsedMains] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { agentTypes } = useAgentTypes({ endpoint: "/api/agent-types", filterSubSessionOnly: true });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const collapseInitializedRef = useRef(false);

  // 首次加载 sessions 后，默认折叠所有有子会话的 main
  useEffect(() => {
    if (collapseInitializedRef.current) return;
    const mains = sessions.filter(s => s.type === "main");
    const subs = sessions.filter(s => s.type === "sub");
    const mainIdsWithSubs = new Set(
      mains.filter(m => subs.some(sub => sub.parent_id === m.session_id)).map(m => m.session_id)
    );
    if (mainIdsWithSubs.size > 0) {
      setCollapsedMains(mainIdsWithSubs);
      collapseInitializedRef.current = true;
    }
  }, [sessions]);

  // 外部点击关闭下拉菜单 + Escape 关闭
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [dropdownOpen]);

  // 按 main 分组
  const groups = useMemo(() => {
    const mains = sessions.filter(s => s.type === "main");
    const subs = sessions.filter(s => s.type === "sub");
    return mains.map(main => ({
      main,
      subs: subs.filter(s => s.parent_id === main.session_id),
    }));
  }, [sessions]);

  const toggleCollapse = (mainId: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    setCollapsedMains(prev => {
      const next = new Set(prev);
      if (next.has(mainId)) next.delete(mainId);
      else next.add(mainId);
      return next;
    });
  };

  const handleCreateWithType = useCallback((agentType: string) => {
    onCreateSession(agentType);
    setDropdownOpen(false);
  }, [onCreateSession]);

  return (
    <ScrollArea className="h-full">
      <div className="px-3 py-2 space-y-2">
        {/* Split Button */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex rounded-md overflow-hidden">
            {/* 左侧主按钮 */}
            <button
              type="button"
              onClick={() => { onCreateSession("main"); setDropdownOpen(false); }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-accent text-foreground/80 hover:bg-accent/70 hover:text-foreground transition-colors text-xs font-medium cursor-pointer"
            >
              <Plus size={14} />
              新建会话
            </button>
            {/* 右侧下拉触发按钮 */}
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
              aria-label="选择会话类型"
              className="px-2 py-1.5 bg-accent text-foreground/80 hover:bg-accent/70 hover:text-foreground transition-colors border-l border-border cursor-pointer"
            >
              <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* 下拉菜单 */}
          {dropdownOpen && (
            <div className="absolute left-0 right-0 mt-1 z-50 max-h-64 overflow-y-auto rounded-md bg-popover border border-border shadow-lg py-1" role="menu" aria-label="选择会话类型">
              {agentTypes.map((t) => (
                <button
                  key={t.agent_type}
                  onClick={() => handleCreateWithType(t.agent_type)}
                  role="menuitem"
                  className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-accent transition-colors cursor-pointer"
                >
                  <Zap size={14} className="mt-0.5 text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-200">
                      {AGENT_TYPE_LABELS[t.agent_type] || t.agent_type}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.description || t.agent_type}
                    </div>
                  </div>
                </button>
              ))}
              {agentTypes.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  暂无可用类型
                </div>
              )}
            </div>
          )}
        </div>

        {groups.map(({ main, subs }) => {
          const isViewing = viewingSessionId === main.session_id;
          const canDelete = canDeleteMainSession(main, mainSessionId);
          const canKill = false; // main sessions not killable via this button
          const isCollapsed = collapsedMains.has(main.session_id);

          return (
            <div key={main.session_id} className="space-y-1">
              {/* Main card with collapse toggle */}
              <div className="flex items-start">
                <div className="min-w-0 flex-1">
                  <SessionCard
                    session={main}
                    isViewing={isViewing}
                    isSub={false}
                    canDelete={canDelete}
                    canKill={canKill}
                    onViewSession={onViewSession}
                    onDeleteSession={onDeleteSession}
                    onKillSession={onKillSession}
                  />
                </div>
              </div>

              {/* 子会话展开/收起切换（两种状态都渲染，展开后才能收得回去） */}
              {subs.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => toggleCollapse(main.session_id, e)}
                  className="flex min-h-6 w-full items-center gap-1 rounded-md px-2
                    text-left text-[11px] text-muted-foreground/70 transition-colors
                    hover:bg-accent/50 hover:text-foreground
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? `展开 ${subs.length} 个子会话` : `收起 ${subs.length} 个子会话`}
                >
                  {isCollapsed ? (
                    <ChevronRight size={11} className="shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
                  )}
                  <span>{isCollapsed ? `${subs.length} 个子会话` : `收起 ${subs.length} 个子会话`}</span>
                </button>
              )}

              {/* 展开的子会话 */}
              {!isCollapsed && subs.map(sub => {
                const subViewing = viewingSessionId === sub.session_id;
                const canKillSub = sub.status === "running" || sub.status === "waiting" || sub.status === "streaming";
                const subCanDelete = sub.status !== "running";
                return (
                  <SessionCard
                    key={sub.session_id}
                    session={sub}
                    isViewing={subViewing}
                    isSub={true}
                    canDelete={subCanDelete}
                    canKill={canKillSub}
                    onViewSession={onViewSession}
                    onDeleteSession={onDeleteSession}
                    onKillSession={onKillSession}
                  />
                );
              })}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-4">暂无会话</div>
        )}
      </div>
    </ScrollArea>
  );
}
