import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { Message, StreamingSegment } from "../../types";
import ConversationAsyncState from "./ConversationAsyncState";
import MessageBubble from "./MessageBubble";
import ReasoningDisclosure from "./ReasoningDisclosure";
import ToolInvocation from "./ToolInvocation";
import FailedTurnCard from "./FailedTurnCard";
import type { FailedTurnState } from "../../features/conversation/conversationTypes";
import {
  mergeLiveSegments,
  normalizeHistoryTimeline,
} from "./conversationModel";
import type { ConversationTimelineEntry } from "./conversationTypes";
import { useAutoFollowOutput } from "./useAutoFollowOutput";

export interface ConversationTimelineProps {
  messages: Message[];
  streamingSegments?: StreamingSegment[];
  isStreaming?: boolean;
  loading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  failedTurn?: FailedTurnState | null;
  retryingFailedTurn?: boolean;
  onRetryFailedTurn?: () => void;
  emptyState?: ReactNode;
  conversationId?: string | null;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
  followThreshold?: number;
  readonly?: boolean;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onCommand?: (payload: { type: string; [key: string]: unknown }) => boolean;
  isMessageEditable?: (message: Message) => boolean;
}

function errorMessage(error: Error | string): string {
  if (typeof error === "string") return error;
  return error.message || "消息加载失败";
}

export default function ConversationTimeline({
  messages,
  streamingSegments = [],
  isStreaming = false,
  loading = false,
  error = null,
  onRetry,
  failedTurn = null,
  retryingFailedTurn = false,
  onRetryFailedTurn,
  emptyState,
  conversationId,
  ariaLabel = "会话消息",
  className = "",
  contentClassName = "",
  followThreshold = 160,
  readonly = false,
  onEditMessage,
  onCommand,
  isMessageEditable,
}: ConversationTimelineProps) {
  // 历史部分只依赖 messages（重活：全量遍历+工具结果配对），
  // 流式 token 到达只触发轻量的 mergeLiveSegments，不再全量重算。
  const history = useMemo(() => normalizeHistoryTimeline(messages), [messages]);
  const entries = useMemo(
    () => mergeLiveSegments(history, streamingSegments),
    [history, streamingSegments],
  );
  // O(1) 版本号：条目数 + 末条内容长度足以驱动"跟随到底部"，
  // 替代原先对全部条目拼接巨型指纹字符串的做法。
  const contentVersion = useMemo(() => {
    const last: ConversationTimelineEntry | undefined = entries[entries.length - 1];
    let tail = 0;
    if (last) {
      if (last.kind === "message") {
        tail = (last.message.content?.length || 0) + (last.message.reasoning_content?.length || 0);
      } else if (last.kind === "reasoning") {
        tail = last.content.length;
      } else {
        tail = (last.invocation.arguments?.length || 0) + (last.invocation.result?.length || 0);
      }
    }
    return entries.length * 10_000_000 + tail;
  }, [entries]);
  const visibleError = error ? errorMessage(error) : null;
  const viewportRef = useRef<HTMLDivElement>(null);
  const { scrollToBottom, resetAutoFollow } = useAutoFollowOutput(viewportRef, {
    threshold: followThreshold,
  });

  useEffect(() => {
    scrollToBottom();
  }, [contentVersion, isStreaming, scrollToBottom, visibleError]);

  useEffect(() => {
    resetAutoFollow();
  }, [conversationId, resetAutoFollow]);

  const isInitialError = !!visibleError && entries.length === 0;
  const isInitialLoading = loading && !isInitialError && entries.length === 0;
  const isEmpty = !loading && !error && !failedTurn && entries.length === 0;
  const hasTimelineContent = entries.length > 0 || Boolean(failedTurn);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`} aria-busy={loading || isStreaming}>
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isInitialLoading && <ConversationAsyncState kind="loading" />}
        {isInitialError && (
          <ConversationAsyncState
            kind="error"
            message={visibleError || undefined}
            onRetry={onRetry}
          />
        )}
        {isEmpty && (emptyState || <ConversationAsyncState kind="empty" />)}

        {hasTimelineContent && (
          <div
            className={`space-y-2 px-4 py-3 ${contentClassName}`}
            role="log"
            aria-label={ariaLabel}
            aria-live="polite"
            aria-relevant="additions text"
          >
            {entries.reduce<{ blocks: ReactNode[]; toolRun: ReactNode[]; toolRunKey: string }>(
              (acc, entry, index) => {
                const flushToolRun = () => {
                  if (acc.toolRun.length > 0) {
                    acc.blocks.push(
                      <div key={`tool-run-${acc.toolRunKey}`} className="space-y-1">
                        {acc.toolRun}
                      </div>,
                    );
                    acc.toolRun = [];
                  }
                };
                if (entry.kind === "tool") {
                  if (acc.toolRun.length === 0) acc.toolRunKey = entry.key;
                  acc.toolRun.push(
                    <ToolInvocation key={entry.key} invocation={entry.invocation} />,
                  );
                } else if (entry.kind === "reasoning") {
                  flushToolRun();
                  acc.blocks.push(
                    <ReasoningDisclosure
                      key={entry.key}
                      content={entry.content}
                      streaming={entry.streaming && isStreaming}
                    />,
                  );
                } else {
                  flushToolRun();
                  acc.blocks.push(
                    <MessageBubble
                      key={entry.key}
                      message={entry.message}
                      streaming={entry.streaming && isStreaming}
                      readonly={readonly}
                      editable={isMessageEditable?.(entry.message) || false}
                      onEdit={onEditMessage}
                      onCommand={onCommand}
                    />,
                  );
                }
                if (index === entries.length - 1) flushToolRun();
                return acc;
              },
              { blocks: [], toolRun: [], toolRunKey: "" },
            ).blocks}
            {isStreaming && streamingSegments.length === 0 && (
              <div className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground" role="status">
                <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                正在生成
              </div>
            )}
            {failedTurn && (
              <FailedTurnCard
                failedTurn={failedTurn}
                retrying={retryingFailedTurn}
                onRetry={onRetryFailedTurn}
              />
            )}
            {visibleError && (
              <ConversationAsyncState
                kind="error"
                message={visibleError}
                className="min-h-0 rounded-lg border border-red-500/15 bg-red-500/5 py-4"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
