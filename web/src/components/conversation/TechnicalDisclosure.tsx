import { useId, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatTechnicalValue, isLongTechnicalValue } from "./conversationModel";
import CopyButton from "./CopyButton";

interface TechnicalDisclosureProps {
  label: string;
  value: string;
  tone?: "neutral" | "error";
  emptyLabel?: string;
}

export default function TechnicalDisclosure({
  label,
  value,
  tone = "neutral",
  emptyLabel = "空结果",
}: TechnicalDisclosureProps) {
  const contentId = useId();
  const formatted = useMemo(() => formatTechnicalValue(value), [value]);
  const collapsible = isLongTechnicalValue(formatted);
  const [expanded, setExpanded] = useState(false);
  const visibleValue = formatted || `(${emptyLabel})`;
  const textColor = tone === "error" ? "text-red-400/90" : "text-muted-foreground";

  return (
    <section className="group/tech mt-1.5 first:mt-1" aria-label={label}>
      <div className="flex min-h-5 items-center gap-1">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={contentId}
            className="inline-flex items-center gap-0.5 rounded text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
          >
            {expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
            <span>{label}</span>
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground/70">{label}</span>
        )}
        <span className="ml-auto opacity-0 transition-opacity group-hover/tech:opacity-100">
          <CopyButton value={value} label={label} />
        </span>
      </div>
      <pre
        id={contentId}
        className={`mt-0.5 overflow-x-auto whitespace-pre-wrap break-words rounded bg-muted/30 px-2 py-1.5 font-mono text-[11px] leading-[1.6] ${textColor} ${
          collapsible && !expanded
            ? "max-h-16 overflow-y-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent)]"
            : "max-h-72 overflow-y-auto"
        }`}
      >
        {visibleValue}
      </pre>
    </section>
  );
}
