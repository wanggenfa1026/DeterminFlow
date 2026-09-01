import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Cpu, RefreshCw, Zap } from "lucide-react";
import { fetchAgentDefinitions, listAllTasks, updateAgentDefinition } from "../lib/api";
import type { AgentDefinitionData } from "../types";

/** 供应商 → 可用模型清单（由 SettingsPage 的 providers 状态传入） */
interface BulkModelSwitcherProps {
  providers: Record<string, { display_name?: string; models?: string[] }>;
}

/** 仍会占用运行身份的任务状态（切模型会导致这些任务后续节点身份漂移） */
const ACTIVE_TASK_STATUSES = new Set(["running", "pending", "retry_waiting", "paused"]);

type Phase =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "applying"; done: number; total: number }
  | { kind: "done"; total: number; failed: string[] }
  | { kind: "blocked"; activeTasks: number }
  | { kind: "error"; message: string };

export default function BulkModelSwitcher({ providers }: BulkModelSwitcherProps) {
  const [agents, setAgents] = useState<AgentDefinitionData[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState(false);
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    setAgentsError(false);
    try {
      const data = await fetchAgentDefinitions();
      setAgents(data.agent_types);
    } catch {
      setAgentsError(true);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  /** provider:model 形式的全部可选项 */
  const modelOptions = useMemo(
    () =>
      Object.entries(providers).flatMap(([providerId, provider]) =>
        (provider.models || []).map((model) => `${providerId}:${model}`),
      ),
    [providers],
  );

  /** 当前模型分布：model → 数量 */
  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of agents) {
      const key = agent.model || "（跟随默认）";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [agents]);

  const applying = phase.kind === "applying";

  const handleApply = async () => {
    if (!target) return;

    // 有任务在跑时切模型会触发「运行身份已漂移」，先拦下
    try {
      const tasks = await listAllTasks({ page_size: 100 });
      const active = (tasks.tasks || []).filter((t: { status?: string }) =>
        ACTIVE_TASK_STATUSES.has(t.status || ""),
      ).length;
      if (active > 0) {
        setPhase({ kind: "blocked", activeTasks: active });
        return;
      }
    } catch {
      // 任务列表查询失败不阻断，仅跳过预检
    }

    if (phase.kind !== "confirming") {
      setPhase({ kind: "confirming" });
      return;
    }

    const total = agents.length;
    const failed: string[] = [];
    setPhase({ kind: "applying", done: 0, total });
    for (let i = 0; i < agents.length; i++) {
      try {
        await updateAgentDefinition(agents[i].agent_type, { model: target });
      } catch {
        failed.push(agents[i].agent_type);
      }
      setPhase({ kind: "applying", done: i + 1, total });
    }
    setPhase({ kind: "done", total: total - failed.length, failed });
    await loadAgents();
  };

  return (
    <section
      aria-label="统一模型切换"
      className="bg-slate-800/80 rounded-xl border border-slate-700/50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="text-indigo-400"><Zap size={18} /></div>
          <h3 className="text-base font-semibold text-slate-100">统一模型切换</h3>
          <span className="text-xs text-slate-500">
            {agentsLoading ? "加载中..." : `${agents.length} 个 Agent`}
          </span>
        </div>
        <button
          type="button"
          onClick={loadAgents}
          aria-label="重新加载 Agent 列表"
          className="p-2 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all cursor-pointer"
          title="重新加载"
        >
          <RefreshCw size={14} className={agentsLoading ? "animate-spin motion-reduce:animate-none" : ""} />
        </button>
      </div>

      <div className="border-t border-slate-700/50 px-5 py-4 space-y-4">
        {/* 当前分布 */}
        <div>
          <div className="text-xs text-slate-500 mb-2">当前模型分布</div>
          <div className="flex flex-wrap gap-2">
            {agentsError && (
              <span className="text-sm text-red-400">Agent 列表加载失败，请点右上角重试</span>
            )}
            {!agentsError && distribution.map(([model, count]) => (
              <span
                key={model}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/60 border border-slate-700/60 text-xs font-mono text-slate-300"
              >
                <Cpu size={12} className="text-indigo-400 shrink-0" aria-hidden="true" />
                {model}
                <span className="text-slate-500">× {count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 切换控件 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setPhase({ kind: "idle" });
              }}
              disabled={applying}
              aria-label="选择目标模型"
              className="w-full bg-slate-900/60 border border-slate-600 rounded-lg pl-3 pr-8 py-2 text-sm font-mono text-slate-200 min-h-[44px]
                focus:border-indigo-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30
                appearance-none cursor-pointer transition-all"
            >
              <option value="">选择目标模型…</option>
              {modelOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={!target || applying || agentsLoading || agents.length === 0}
            className={`px-5 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-all cursor-pointer ${
              !target || applying || agentsLoading || agents.length === 0
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : phase.kind === "confirming"
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {applying && phase.kind === "applying"
              ? `切换中 ${phase.done}/${phase.total}...`
              : phase.kind === "confirming"
                ? `确认切换全部 ${agents.length} 个？`
                : "全部切换"}
          </button>
        </div>

        {/* 状态提示 */}
        {phase.kind === "blocked" && (
          <div role="alert" className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-sm text-amber-400">
            检测到 {phase.activeTasks} 个任务正在运行或等待重试。任务运行中切换模型会导致「运行身份已漂移」错误，请等任务结束后再切换。
          </div>
        )}
        {phase.kind === "done" && (
          <div
            role="status"
            className={`p-3 rounded-lg text-sm border ${
              phase.failed.length === 0
                ? "bg-green-500/10 border-green-500/25 text-green-400"
                : "bg-amber-500/10 border-amber-500/25 text-amber-400"
            }`}
          >
            {phase.failed.length === 0
              ? `已将全部 ${phase.total} 个 Agent 切换为 ${target}。已运行的会话不受影响，新会话与新任务将使用新模型。`
              : `${phase.total} 个切换成功，${phase.failed.length} 个失败：${phase.failed.join("、")}`}
          </div>
        )}
        <p className="text-xs text-slate-500">
          一键把所有 Agent（含插件 Agent）的模型统一切换为所选项。单个 Agent 的精细调整在「编排 → Agent 定义」里改。
        </p>
      </div>
    </section>
  );
}
