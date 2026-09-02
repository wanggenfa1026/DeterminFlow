import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  /** 右侧操作区（按钮组） */
  actions?: ReactNode;
  className?: string;
}

/** 统一页面头部：标题 + 说明 + 右侧操作，所有列表/配置类页面共用 */
export function PageHeader({ title, description, icon: Icon, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={`mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-primary">
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
