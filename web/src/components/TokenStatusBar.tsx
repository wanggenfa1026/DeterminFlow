import { TokenUsage } from "../types";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  tokenUsage: TokenUsage | null;
}

/**
 * 横向 Token 状态条 —— 放在输入框上方的工具行里。
 *
 * 取代原先常驻左侧 256px 的监控面板：这些是状态数据，
 * 属于状态栏而非独立栏目，内联展示可把宽度还给对话区。
 */
export default function TokenStatusBar({ tokenUsage }: Props) {
  if (!tokenUsage) return null;

  const { api, max_context_tokens, llm_call_count, model_id } = tokenUsage;
  const used = api.prompt_tokens || 0;
  const pct = max_context_tokens > 0 ? (used / max_context_tokens) * 100 : 0;
  const cacheRate = used > 0 ? ((api.cached_tokens || 0) / used) * 100 : 0;

  // 只有接近上限才需要用颜色示警，其余保持中性
  const pctTone =
    pct > 80 ? "text-red-400" : pct > 60 ? "text-amber-400" : "text-muted-foreground";

  return (
    <div
      className="flex min-w-0 items-center gap-3 overflow-hidden text-[11px] text-muted-foreground/70"
      role="status"
      aria-label="Token 用量"
    >
      {/* 上下文占用：细条 + 数值 */}
      <span className="flex shrink-0 items-center gap-1.5" title="上下文占用">
        <span className="h-1 w-12 overflow-hidden rounded-full bg-muted">
          <span
            className={`block h-full rounded-full transition-all ${
              pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-primary/70"
            }`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </span>
        <span className={`tabular-nums ${pctTone}`}>
          {formatTokens(used)}/{formatTokens(max_context_tokens)}
        </span>
      </span>

      <span className="shrink-0 text-border">|</span>

      <span className="shrink-0 tabular-nums" title="缓存命中率">
        缓存 {cacheRate.toFixed(0)}%
      </span>

      <span className="shrink-0 text-border">|</span>

      <span className="shrink-0 tabular-nums" title="LLM 调用次数">
        {llm_call_count} 次调用
      </span>

      {model_id && (
        <>
          <span className="hidden shrink-0 text-border lg:inline">|</span>
          <span className="hidden min-w-0 truncate lg:inline" title={model_id}>
            {model_id}
          </span>
        </>
      )}
    </div>
  );
}
