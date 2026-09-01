import { memo } from "react";
import { hasVisibleText, stripInvisible } from "@/lib/visibleText";
import type { Message } from "../../types";
import MessageRenderer from "../MessageRenderer";
import MarkdownContent from "./MarkdownContent";
import ReasoningDisclosure from "./ReasoningDisclosure";

export interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
  editable?: boolean;
  readonly?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onCommand?: (payload: { type: string; [key: string]: unknown }) => boolean;
  className?: string;
}

function effectiveType(message: Message): string {
  return message.type || message.role || "";
}

function MessageBubble({
  message,
  streaming = false,
  editable = false,
  readonly = false,
  onEdit,
  onCommand,
  className = "",
}: MessageBubbleProps) {
  const type = effectiveType(message);

  if (type === "user") {
    return (
      <MessageRenderer
        message={message}
        onEdit={onEdit}
        onCommand={onCommand}
        editable={editable}
        streaming={streaming}
        readonly={readonly}
      />
    );
  }

  if (type === "assistant") {
    return (
      <article className={`flex justify-start ${className}`} aria-label="助手消息">
        <div className="w-full min-w-0 space-y-1.5">
          {message.reasoning_content && (
            <ReasoningDisclosure content={message.reasoning_content} streaming={streaming && !message.content} />
          )}
          {hasVisibleText(message.content) && (
            <MarkdownContent
              content={stripInvisible(message.content)}
              className="px-1 text-sm leading-7 text-foreground/90"
            />
          )}
        </div>
      </article>
    );
  }

  return <MessageRenderer message={message} readonly={readonly} onCommand={onCommand} />;
}

export default memo(MessageBubble);
