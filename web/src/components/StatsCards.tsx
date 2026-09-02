import { Layers, MessageSquare, Thermometer, Wifi, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SystemStatus } from "../types";
import { StatTile, type StatTone } from "./layout/StatTile";

interface StatsCardsProps {
  status: SystemStatus;
}

interface StatCard {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  /** 仅状态类数值需要着色，其余保持中性 */
  tone?: StatTone;
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
      // 未配置 MCP 是常态，用弱化色而非报警红
      tone: status.mcp_connected ? "positive" : "muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" role="region" aria-label="系统状态统计">
      {cards.map((card) => (
        <StatTile
          key={card.label}
          label={card.label}
          value={card.value}
          suffix={card.suffix}
          icon={card.icon}
          tone={card.tone}
          pulse={card.pulse}
        />
      ))}
    </div>
  );
}
