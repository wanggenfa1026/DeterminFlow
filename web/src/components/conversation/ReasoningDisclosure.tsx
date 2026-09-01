import { memo, useId, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import CopyButton from "./CopyButton";
import MarkdownContent from "./MarkdownContent";

export interface ReasoningDisclosureProps {
  content: string;
  streaming?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

function ReasoningDisclosure({
  content,
  streaming = false,
  defaultExpanded = false,
  className = "",
}: ReasoningDisclosureProps) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const label = streaming ? "思考中" : "思考过程";

  if (!content && !streaming) return null;

  return (
    <section className={`group/reason ${className}`} aria-label={label}>
      <div className="flex h-7 items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-left text-[12px] text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
        >
          {streaming ? (
            <Loader2 size={12} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Sparkles size={12} className="shrink-0 opacity-60" aria-hidden="true" />
          )}
          <span>{label}</span>
          <span className="text-muted-foreground/50" aria-hidden="true">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        </button>
        {content && (
          <span className="opacity-0 transition-opacity group-hover/reason:opacity-100">
            <CopyButton value={content} label="思考过程" />
          </span>
        )}
      </div>
      {expanded && content && (
        <div
          id={contentId}
          className="ml-[9px] mt-0.5 border-l-2 border-border/50 py-0.5 pl-3 opacity-75"
        >
          <MarkdownContent content={content} className="text-[12.5px] leading-6" />
        </div>
      )}
    </section>
  );
}

export default memo(ReasoningDisclosure);
