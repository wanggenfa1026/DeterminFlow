import { useCallback, useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Wifi, WifiOff, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PRODUCT_NAME } from "@/brand";
import { useGlobalEvents } from "../../hooks/useGlobalEvents";

export interface RailItem {
  value: string;
  icon: LucideIcon;
  label: string;
}

interface AppRailProps {
  items: RailItem[];
  activeTab: string;
  onChange: (value: string) => void;
}

/** 页签按职能分组；未列出的（扩展页）自动归入「扩展」 */
const RAIL_GROUPS: { label: string; values: string[] }[] = [
  { label: "创作", values: ["chat", "dashboard", "graph", "roundtable"] },
  { label: "编排", values: ["orchestration", "workflow", "cron", "skills", "rules", "system-prompt"] },
  { label: "系统", values: ["settings", "extensions"] },
];

const STORAGE_KEY = "df.rail.expanded";

function readExpanded(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function ConnectionDot({ expanded }: { expanded: boolean }) {
  const { connected } = useGlobalEvents();
  const label = connected ? "已连接" : "连接断开";
  return (
    <div
      className={`flex h-9 items-center gap-2 rounded-md px-2.5 text-xs ${connected ? "text-emerald-500" : "text-red-500"}`}
      title={label}
      aria-live="polite"
    >
      {connected ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
      {expanded && <span className="truncate">{label}</span>}
      <span className="sr-only">WebSocket {label}</span>
    </div>
  );
}

export function AppRail({ items, activeTab, onChange }: AppRailProps) {
  const [expanded, setExpanded] = useState<boolean>(readExpanded);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      // 存储不可用时静默降级为会话内状态
    }
  }, [expanded]);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const grouped = RAIL_GROUPS.map((group) => ({
    label: group.label,
    items: group.values
      .map((value) => items.find((item) => item.value === value))
      .filter((item): item is RailItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);
  const knownValues = new Set(RAIL_GROUPS.flatMap((g) => g.values));
  const extensionItems = items.filter((item) => !knownValues.has(item.value));
  if (extensionItems.length > 0) grouped.push({ label: "扩展", items: extensionItems });

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border/70 bg-background/95 transition-[width] duration-200 ${
        expanded ? "w-52" : "w-14"
      }`}
      aria-label="侧边导航"
    >
      {/* 品牌 */}
      <div className={`flex h-14 shrink-0 items-center border-b border-border/60 ${expanded ? "gap-2.5 px-3" : "justify-center"}`}>
        <BrandMark alt={PRODUCT_NAME} className="h-7 w-7 shrink-0" />
        {expanded && (
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">{PRODUCT_NAME}</span>
        )}
      </div>

      {/* 导航分组 */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="主导航">
        {grouped.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex > 0 ? "mt-1 border-t border-border/50 pt-1" : ""}>
            {expanded ? (
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </div>
            ) : (
              <div className="h-1" aria-hidden="true" />
            )}
            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.value === activeTab;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      onClick={() => onChange(item.value)}
                      aria-current={active ? "page" : undefined}
                      title={expanded ? undefined : item.label}
                      className={`group relative flex h-9 w-full items-center rounded-md text-sm transition-colors ${
                        expanded ? "gap-2.5 px-2.5" : "justify-center"
                      } ${
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" aria-hidden="true" />
                      )}
                      <Icon size={17} className="shrink-0" aria-hidden="true" />
                      {expanded && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* 底部：连接状态 / 主题 / 折叠 */}
      <div className={`flex shrink-0 flex-col gap-0.5 border-t border-border/60 p-2 ${expanded ? "" : "items-center"}`}>
        <ConnectionDot expanded={expanded} />
        <div className={`flex items-center ${expanded ? "justify-between px-1" : "flex-col gap-0.5"}`}>
          <ThemeToggle />
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? "折叠导航栏" : "展开导航栏"}
            title={expanded ? "折叠导航栏" : "展开导航栏"}
            aria-expanded={expanded}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? <PanelLeftClose size={16} aria-hidden="true" /> : <PanelLeftOpen size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
