import type { LucideIcon } from "lucide-react";

export type StatTone = "neutral" | "positive" | "negative" | "warning" | "muted";

interface StatTileProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  /** 右上角常亮脉冲点（表示有活动） */
  pulse?: boolean;
  className?: string;
}

const TONE_CLASS: Record<StatTone, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-500",
  negative: "text-red-500",
  warning: "text-amber-500",
  muted: "text-muted-foreground",
};

/** 紧凑统计瓦片：小标签 + 大数字，一行放 3–6 个 */
export function StatTile({ label, value, suffix, icon: Icon, tone = "neutral", pulse = false, className = "" }: StatTileProps) {
  return (
    <div
      className={`rounded-lg border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-muted-foreground/30 ${className}`}
      role="article"
      aria-label={`${label}: ${value}${suffix ? ` ${suffix}` : ""}`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon size={13} aria-hidden="true" />}
        <span className="text-xs">{label}</span>
        {pulse && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 status-running" aria-hidden="true" />}
      </div>
      <div className={`mt-1.5 text-xl font-semibold leading-7 tabular-nums ${TONE_CLASS[tone]}`}>
        {value}
        {suffix && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
