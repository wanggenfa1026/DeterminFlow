import { lazy, Suspense, useMemo } from "react";
import { MessageSquare, LayoutDashboard, GitBranch, Users, Layers, Settings, BookOpen, FileText, Workflow, Clock, Boxes, type LucideIcon } from "lucide-react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { CORE_TAB_IDS, isCoreTabId, type CoreTabId } from "@/core-tabs";
import { AppRail } from "@/components/layout/AppRail";
import { patchSearchParams, useUrlParam } from "./hooks/useUrlParam";
import { useExtensions } from "./extensions/context-value";
import { ExtensionHeaderStatusSlot } from "./extensions/ExtensionHeaderStatusSlot";
import { DesktopUpdateProvider } from "./desktop-updater/context";
import { DesktopUpdateNotice } from "./desktop-updater/DesktopUpdateNotice";
import { useNavigationSettings } from "./hooks/useNavigationSettings";
import FirstRunOnboarding from "./components/onboarding/FirstRunOnboarding";

const ChatPage = lazy(() => import("./pages/ChatPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const GraphPage = lazy(() => import("./pages/GraphPage"));
const RoundtablePage = lazy(() => import("./pages/RoundtablePage"));
const OrchestrationPage = lazy(() => import("./pages/OrchestrationPage"));
const WorkflowPage = lazy(() => import("./pages/WorkflowPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const RulesPage = lazy(() => import("./pages/RulesPage"));
const SystemPromptPage = lazy(() => import("./pages/SystemPromptPage"));
const CronPage = lazy(() => import("./pages/CronPage"));
const ExtensionsPage = lazy(() => import("./pages/ExtensionsPage"));

/** Tab 配置：value + 图标 + 标签 + active 样式 */
interface TabConfig {
  value: string;
  icon: LucideIcon;
  label: string;
  activeClass: string;
}

/** 精密工作台风：所有页签统一为单一强调色的 active 态，不再各用一色 */
const UNIFIED_ACTIVE_CLASS =
  "data-[state=active]:bg-primary/15 data-[state=active]:text-primary";

const CORE_TAB_METADATA: Record<CoreTabId, Omit<TabConfig, "value">> = {
  chat: { icon: MessageSquare, label: "对话", activeClass: UNIFIED_ACTIVE_CLASS },
  dashboard: { icon: LayoutDashboard, label: "看板", activeClass: UNIFIED_ACTIVE_CLASS },
  graph: { icon: GitBranch, label: "图谱", activeClass: UNIFIED_ACTIVE_CLASS },
  roundtable: { icon: Users, label: "圆桌", activeClass: UNIFIED_ACTIVE_CLASS },
  orchestration: { icon: Layers, label: "编排", activeClass: UNIFIED_ACTIVE_CLASS },
  workflow: { icon: Workflow, label: "工作流", activeClass: UNIFIED_ACTIVE_CLASS },
  cron: { icon: Clock, label: "定时", activeClass: UNIFIED_ACTIVE_CLASS },
  skills: { icon: BookOpen, label: "Skills", activeClass: UNIFIED_ACTIVE_CLASS },
  rules: { icon: BookOpen, label: "Rules", activeClass: UNIFIED_ACTIVE_CLASS },
  "system-prompt": { icon: FileText, label: "系统提示词", activeClass: UNIFIED_ACTIVE_CLASS },
  settings: { icon: Settings, label: "配置", activeClass: UNIFIED_ACTIVE_CLASS },
  extensions: { icon: Boxes, label: "插件", activeClass: UNIFIED_ACTIVE_CLASS },
};

const CORE_TAB_CONFIG: TabConfig[] = CORE_TAB_IDS.map((value) => ({
  value,
  ...CORE_TAB_METADATA[value],
}));

/** 页面路由映射 */
const CORE_PAGE_MAP: Record<CoreTabId, React.ComponentType> = {
  chat: ChatPage,
  dashboard: DashboardPage,
  graph: GraphPage,
  roundtable: RoundtablePage,
  orchestration: OrchestrationPage,
  workflow: WorkflowPage,
  cron: CronPage,
  skills: SkillsPage,
  rules: RulesPage,
  "system-prompt": SystemPromptPage,
  settings: SettingsPage,
  extensions: ExtensionsPage,
};

/** 页面切换时的骨架屏：模拟「页头 + 统计行 + 内容块」的通用结构，避免闪一下转圈文字 */
function PageLoadingFallback() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" role="status" aria-live="polite" aria-label="正在加载页面">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-64" />
      <span className="sr-only">正在加载页面...</span>
    </div>
  );
}

function App() {
  const extensions = useExtensions();
  const showSystemPromptTab = useNavigationSettings();
  const [requestedTab, setRequestedTab] = useUrlParam("tab");
  const extensionPages = useMemo(() => extensions.flatMap((extension) => extension.pages || []), [extensions]);
  const tabs = useMemo<TabConfig[]>(() => [
    ...CORE_TAB_CONFIG.filter((tab) => tab.value !== "system-prompt" || showSystemPromptTab),
    ...extensionPages.map((page) => ({
      value: page.id,
      icon: page.icon,
      label: page.label,
      activeClass: page.activeClass,
    })),
  ], [extensionPages, showSystemPromptTab]);
  const activeTab = tabs.some((tab) => tab.value === requestedTab)
    ? requestedTab!
    : "chat";
  const ExtensionPage = extensionPages.find((page) => page.id === activeTab)?.component;
  const CorePage = isCoreTabId(activeTab) ? CORE_PAGE_MAP[activeTab] : undefined;

  const handleTabChange = (value: string) => {
    setRequestedTab(value === "chat" ? null : value);
  };

  const handleManageExtension = (extensionId: string) => {
    const nextSearch = patchSearchParams(window.location.search, {
      tab: "extensions",
      plugin: extensionId,
    });
    window.history.pushState(window.history.state, "", `${window.location.pathname}${nextSearch}${window.location.hash}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <DesktopUpdateProvider>
      <ToastProvider>
        <FirstRunOnboarding>
          <div className="flex h-dvh overflow-hidden bg-background">
            {/* 左侧导航栏 */}
            <AppRail items={tabs} activeTab={activeTab} onChange={handleTabChange} />

            {/* 主内容区 */}
            <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-none" role="main" aria-label="主内容区域">
              {/* 插件更新提示：仅在有内容时渲染，悬浮于右上角 */}
              <div className="pointer-events-none fixed right-4 top-3 z-40 [&>*]:pointer-events-auto">
                <ExtensionHeaderStatusSlot onManage={handleManageExtension} />
              </div>
              <Suspense fallback={<PageLoadingFallback />}>
                {CorePage ? <CorePage /> : ExtensionPage ? <ExtensionPage /> : null}
              </Suspense>
            </main>
            <DesktopUpdateNotice onOpenSettings={() => handleTabChange("settings")} />
          </div>
        </FirstRunOnboarding>
      </ToastProvider>
    </DesktopUpdateProvider>
  );
}

export default App;
