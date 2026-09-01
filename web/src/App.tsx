import { lazy, Suspense, useMemo } from "react";
import { MessageSquare, LayoutDashboard, GitBranch, Users, Layers, Settings, BookOpen, Wifi, WifiOff, FileText, Workflow, Clock, Boxes, Loader2, type LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastProvider } from "@/components/ui/toast-provider";
import { CORE_TAB_IDS, isCoreTabId, type CoreTabId } from "@/core-tabs";
import { PRODUCT_NAME } from "@/brand";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useGlobalEvents } from "./hooks/useGlobalEvents";
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

function GlobalConnectionStatus() {
  const { connected } = useGlobalEvents();

  return (
    <div className="flex shrink-0 items-center gap-3" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        {connected ? (
          <Wifi size={14} className="text-green-400" aria-hidden="true" />
        ) : (
          <WifiOff size={14} className="text-red-400" aria-hidden="true" />
        )}
        <span className={`hidden xl:inline ${connected ? "text-green-400" : "text-red-400"}`}>
          {connected ? "已连接" : "断开"}
        </span>
        <span className="sr-only">
          {connected ? "WebSocket 已连接" : "WebSocket 连接断开"}
        </span>
      </div>
    </div>
  );
}

function PageLoadingFallback() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span>正在加载页面...</span>
      </div>
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
          <div className="flex h-dvh flex-col overflow-hidden bg-background">
            {/* Top Navigation Bar */}
            <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/85 backdrop-blur-md border-b border-border/70">
              <div className="h-full flex items-center gap-3 px-4">
                {/* Brand */}
                <div className="flex shrink-0 items-center gap-3">
                  <BrandMark
                    alt={PRODUCT_NAME}
                    className="h-8 w-8 shrink-0"
                  />
                  <h1
                    className="hidden text-lg font-semibold tracking-tight text-foreground 2xl:block"
                    aria-hidden="true"
                  >
                    {PRODUCT_NAME}
                  </h1>
                </div>

                {/* Tabs */}
                <Tabs className="min-w-0 flex-1" value={activeTab} onValueChange={handleTabChange}>
                  <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <TabsList className="w-max justify-start bg-secondary/50 border border-border/60" role="tablist" aria-label="主导航">
                      {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className={`gap-2 ${tab.activeClass}`}
                            role="tab"
                            aria-selected={activeTab === tab.value}
                          >
                            <Icon size={16} aria-hidden="true" />
                            <span>{tab.label}</span>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </div>
                </Tabs>

                <ExtensionHeaderStatusSlot onManage={handleManageExtension} />
                <GlobalConnectionStatus />
                <ThemeToggle />
              </div>
            </header>

            {/* Main Content */}
            <main className="min-h-0 flex-1 overflow-y-auto overscroll-none pt-14" role="main" aria-label="主内容区域">
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
