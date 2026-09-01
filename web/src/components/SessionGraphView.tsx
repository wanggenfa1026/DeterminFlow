import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { Session } from "../types";
import { getStatusConfig, truncate, formatRelativeTime } from "../lib/utils-helpers";
import {
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Moon,
} from "lucide-react";

// ============ Status icon mapping (lucide, not emoji) ============

const STATUS_ICON_MAP: Record<string, React.ReactNode> = {
  running: <Activity size={14} />,
  streaming: <Zap size={14} />,
  completed: <CheckCircle2 size={14} />,
  error: <XCircle size={14} />,
  waiting: <PauseCircle size={14} />,
  idle: <Moon size={14} />,
};

const STATUS_LABEL_MAP: Record<string, string> = {
  running: "运行中",
  streaming: "流式传输",
  completed: "已完成",
  error: "错误",
  waiting: "等待中",
  idle: "空闲",
};

// ============ Custom Node Component ============

function SessionNode({ data }: NodeProps) {
  const { session, selected, onHover } = data;
  const cfg = getStatusConfig(session.status);
  const isMain = session.type === "main";

  const borderColor = STATUS_COLOR_MAP[session.status] || DEFAULT_BORDER_COLOR;
  const statusLabel = STATUS_LABEL_MAP[session.status] || session.status;

  return (
    <div
      className="relative cursor-pointer"
      onMouseEnter={() => onHover(session)}
      onMouseLeave={() => onHover(null)}
      role="button"
      tabIndex={0}
      aria-label={`${isMain ? "主会话" : "子会话"} ${session.session_id}，状态：${statusLabel}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHover(session);
        }
      }}
    >
      {/* Pulse indicator for running/streaming */}
      {(session.status === "running" || session.status === "streaming") && (
        <div
          className="absolute -inset-2 rounded-xl opacity-30 status-running motion-reduce:hidden"
          style={{ background: `radial-gradient(circle, ${borderColor}40, transparent)` }}
          aria-hidden="true"
        />
      )}

      <div
        className={`relative px-3.5 py-2.5 rounded-lg bg-card transition-shadow hover:shadow-md ${
          selected ? "ring-2 ring-primary" : ""
        }`}
        style={{
          borderColor: `${borderColor}55`,
          borderStyle: "solid",
          borderWidth: "1.5px",
          minWidth: isMain ? "180px" : "150px",
        }}
      >
        <Handle type="target" position={Position.Top} className="opacity-0" />

        <div className="flex items-center gap-2 mb-1">
          <span
            className={`w-2.5 h-2.5 rounded-full ${(session.status === "running" || session.status === "streaming") ? "status-running motion-reduce:animate-none" : ""}`}
            style={{ backgroundColor: borderColor }}
            aria-hidden="true"
          />
          <span className="text-xs font-mono font-bold text-foreground">
            {isMain ? "MAIN" : session.session_id}
          </span>
          <span className="sr-only">{statusLabel}</span>
        </div>

        {session.task && (
          <p className="text-xs text-muted-foreground leading-tight">
            {truncate(session.task, isMain ? 30 : 25)}
          </p>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-xs ${cfg.color}`}>{session.status}</span>
          <span className="text-xs text-muted-foreground">{session.message_count} msgs</span>
        </div>

        <Handle type="source" position={Position.Bottom} className="opacity-0" />
      </div>
    </div>
  );
}

// Module-level constants (prevent re-creation on every render)
const STATUS_COLOR_MAP: Record<string, string> = {
  running: "#22c55e",   // green-500
  streaming: "#06b6d4", // cyan-500
  completed: "#3b82f6", // blue-500
  error: "#ef4444",     // red-500
  waiting: "#f59e0b",   // amber-500
  idle: "#94a3b8",      // slate-400
};
const DEFAULT_BORDER_COLOR = "#6366f1"; // indigo-500

const nodeTypes = { sessionNode: SessionNode };

// ============ Main Component ============

interface SessionGraphViewProps {
  sessions: Session[];
  mainSessionId: string | null;
  onNodeClick: (sessionId: string) => void;
  selectedSessionId: string | null;
}

export default function SessionGraphView({
  sessions,
  onNodeClick,
  selectedSessionId,
}: SessionGraphViewProps) {
  const [hoveredSession, setHoveredSession] = useState<Session | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setMousePos({ x: e.clientX, y: e.clientY });
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const mainSessions = sessions.filter((s) => s.type === "main");
    const subSessions = sessions.filter((s) => s.type === "sub");

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // 构建 main→subs 的映射（通过 parent_id）
    const mainSubsMap: Record<string, Session[]> = {};
    for (const sub of subSessions) {
      if (sub.parent_id) {
        if (!mainSubsMap[sub.parent_id]) mainSubsMap[sub.parent_id] = [];
        mainSubsMap[sub.parent_id].push(sub);
      }
    }

    // 多环放射布局：子会话围绕主会话按同心环排布，
    // 每环容量由周长决定，避免节点数多时全部叠在一个扇形里。
    const ringRadius = (ring: number) => 230 + (ring - 1) * 180;
    const ringCapacity = (ring: number) =>
      Math.max(6, Math.floor((2 * Math.PI * ringRadius(ring)) / 215));
    const ringsNeeded = (count: number) => {
      let rings = 0;
      let left = count;
      while (left > 0) {
        rings += 1;
        left -= ringCapacity(rings);
      }
      return Math.max(1, rings);
    };

    const maxSubs = mainSessions.reduce(
      (max, main) => Math.max(max, (mainSubsMap[main.session_id] || []).length),
      0,
    );
    const clusterR = maxSubs > 0 ? ringRadius(ringsNeeded(maxSubs)) : 140;
    const clusterSpacingX = clusterR * 2 + 180;
    const clusterSpacingY = clusterR * 2 + 160;
    const cols = Math.max(1, Math.ceil(Math.sqrt(mainSessions.length)));

    mainSessions.forEach((main, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const centerX = clusterR + 120 + col * clusterSpacingX;
      const centerY = clusterR + 100 + row * clusterSpacingY;

      nodes.push({
        id: main.session_id,
        type: "sessionNode",
        position: { x: centerX, y: centerY },
        data: {
          session: main,
          selected: selectedSessionId === main.session_id,
          onHover: setHoveredSession,
        },
      });

      const subs = mainSubsMap[main.session_id] || [];
      let placed = 0;
      let ring = 1;
      while (placed < subs.length) {
        const capacity = ringCapacity(ring);
        const ringSubs = subs.slice(placed, placed + capacity);
        const radius = ringRadius(ring);
        // 相邻环错开半个间隔，连线不会重叠成一束
        const angleOffset = ring % 2 === 0 ? Math.PI / ringSubs.length : 0;

        ringSubs.forEach((sub, i) => {
          const angle = (2 * Math.PI * i) / ringSubs.length + angleOffset;
          const x = centerX + Math.sin(angle) * radius;
          const y = centerY + Math.cos(angle) * radius;

          nodes.push({
            id: sub.session_id,
            type: "sessionNode",
            position: { x, y },
            data: {
              session: sub,
              selected: selectedSessionId === sub.session_id,
              onHover: setHoveredSession,
            },
          });

          edges.push({
            id: `${main.session_id}-${sub.session_id}`,
            source: main.session_id,
            target: sub.session_id,
            animated: sub.status === "running" || sub.status === "streaming",
            style: {
              stroke: (sub.status === "running" || sub.status === "streaming") ? "#22c55e" : "#6b728066",
              strokeWidth: 1.5,
            },
            className: "motion-reduce:!transition-none motion-reduce:!animate-none",
          });
        });

        placed += capacity;
        ring += 1;
      }
    });

    return { nodes, edges };
  }, [sessions, selectedSessionId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 数据刷新时同步节点，但保留用户拖动后的位置：
  // 已存在的节点沿用当前 position（含拖动结果），只有新节点采用计算布局。
  // 之前这里整体覆盖 setNodes(initialNodes)，导致每次轮询都把拖动打回原位。
  useEffect(() => {
    setNodes((current) => {
      const keptPositions = new Map(current.map((node) => [node.id, node.position]));
      return initialNodes.map((node) => {
        const kept = keptPositions.get(node.id);
        return kept ? { ...node, position: kept } : node;
      });
    });
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const cfg = hoveredSession ? getStatusConfig(hoveredSession.status) : null;

  return (
    <div
      className="relative w-full h-full"
      onMouseMove={handleMouseMove}
      role="application"
      aria-label="会话关系图谱，可交互节点"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: "hsl(var(--background))" }}
      >
        <Background color="#71717a55" gap={24} />
        <Controls
          className="!rounded-lg !border !border-border !shadow-sm !overflow-hidden"
        />
      </ReactFlow>

      {/* Hover Tooltip */}
      {hoveredSession && cfg && (
        <div
          id="session-tooltip"
          role="tooltip"
          aria-label={`会话 ${hoveredSession.session_id} 详情`}
          className="fixed z-50 bg-card border border-border rounded-lg p-3 min-w-[220px] max-w-[320px] pointer-events-none shadow-lg"
          style={{
            left: Math.min(mousePos.x + 15, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 340),
            top: Math.min(mousePos.y + 15, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200),
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`${cfg.color}`} aria-hidden="true">
              {STATUS_ICON_MAP[hoveredSession.status]}
            </span>
            <span className="text-xs font-mono font-bold text-primary">{hoveredSession.session_id}</span>
            <span className={`text-xs ${cfg.color}`}>
              {STATUS_LABEL_MAP[hoveredSession.status] || hoveredSession.status}
            </span>
          </div>
          {hoveredSession.task && (
            <p className="text-xs text-foreground/85 mb-1.5">{truncate(hoveredSession.task, 80)}</p>
          )}
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            <span>消息: {hoveredSession.message_count}</span>
            <span>类型: {hoveredSession.type}</span>
            <span>创建: {formatRelativeTime(hoveredSession.created_at)}</span>
            <span>更新: {formatRelativeTime(hoveredSession.updated_at)}</span>
          </div>
          {hoveredSession.last_message && (
            <div className="mt-1.5 text-xs text-muted-foreground border-t border-border pt-1.5">
              最新: {truncate(hoveredSession.last_message, 60)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
