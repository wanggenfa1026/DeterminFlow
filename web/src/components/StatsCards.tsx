import { Layers, MessageSquare, Thermometer, Wifi, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SystemStatus } from "../types";

interface StatsCardsProps {
  status: SystemStatus;
}

interface StatCard {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  /** 仅状态类数值需要着色，其余保持中性 */
  valueClass?: string;
  pulse?: boolean;
}

export default function StatsCards({ status }: StatsCardsProps) {
  const cards: StatCard[] = [
    {
      label: "活跃会话",
      value: status.active_sub_count,
      suffix: `/ ${status.total_sessions}`,
      icon: MessageSquare,
      pulse: status.active_sub_count > 0,
    },
    {
      label: "工具调用",
      value: status.event_bus_stats.total_tool_calls,
      suffix: "次",
      icon: Wrench,
    },
    {
      label: "提示词版本",
      value: `v${status.prompt_version}`,
      icon: Layers,
    },
    {
      label: "Temperature",
      value: status.temperature.toFixed(1),
      icon: Thermometer,
    },
    {
      label: "MCP 状态",
      value: status.mcp_connected ? "已连接" : "断开",
      suffix: status.mcp_connected ? `(${status.mcp_tools_count} 工具)` : "",
      icon: Wifi,
      valueClass: status.mcp_connected ? "text-emerald-500" : "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" role="region" aria-label="系统状态统计">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card/50 px-4 py-3 transition-colors hover:border-muted-foreground/30"
            role="article"
            aria-label={`${card.label}: ${card.value}${card.suffix || ""}`}
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon size={13} aria-hidden="true" />
              <span className="text-xs">{card.label}</span>
              {card.pulse && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 status-running" aria-hidden="true" />
              )}
            </div>
            <div className={`mt-1.5 text-xl font-semibold leading-7 tabular-nums ${card.valueClass || "text-foreground"}`}>
              {card.value}
              {card.suffix && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{card.suffix}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
