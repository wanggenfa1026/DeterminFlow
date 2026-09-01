import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 统一的 Markdown 渲染组件
 * 使用相同的样式配置，确保整个应用中 markdown 显示一致
 */
function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div
      className={`markdown-body prose max-w-none dark:prose-invert
        prose-headings:text-foreground prose-headings:font-semibold
        prose-p:text-foreground/85 prose-p:leading-relaxed
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground prose-strong:font-semibold
        prose-code:text-foreground/90 prose-code:bg-muted/60 prose-code:border prose-code:border-border/40 prose-code:text-[13px] prose-code:font-normal prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-muted/40 prose-pre:text-foreground/85 prose-pre:border prose-pre:border-border/50 prose-pre:rounded-lg prose-pre:text-[13px] prose-pre:leading-6
        prose-ul:text-foreground/85 prose-ol:text-foreground/85
        prose-li:text-foreground/85 prose-li:my-1
        prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:bg-transparent prose-blockquote:pl-4 prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:font-normal
        prose-hr:border-border/60
        prose-table:text-foreground/85
        prose-th:text-foreground prose-th:bg-muted/50
        prose-td:border-border/60
        ${className}
      `}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
