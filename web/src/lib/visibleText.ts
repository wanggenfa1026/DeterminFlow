/**
 * 判断文本是否包含可见内容。
 *
 * 模型在两次工具调用之间常输出零宽空格（U+200B）等占位字符，
 * 这类字符非空、且 String.trim() 不会移除，直接用 trim() 判空会漏掉，
 * 导致渲染出只含流式光标的空气泡。
 */
const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g;

export function hasVisibleText(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.replace(INVISIBLE_CHARS, "").trim().length > 0;
}

/** 移除不可见字符，避免 Markdown 把它们渲染成空段落。 */
export function stripInvisible(value: string | null | undefined): string {
  return (value ?? "").replace(INVISIBLE_CHARS, "");
}
