"use client";

import { useRef } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  ariaLabel?: string;
}

/**
 * A HackerRank-style dark code editor: monospace text, a line-number gutter
 * that scrolls with the content, and Tab indentation.
 */
export function CodeEditor({
  value,
  onChange,
  placeholder,
  minRows = 10,
  ariaLabel,
}: CodeEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = Math.max(value.split("\n").length, minRows);

  function syncScroll() {
    const ta = taRef.current;
    const gutter = gutterRef.current;
    if (ta && gutter) gutter.scrollTop = ta.scrollTop;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    onChange(value.slice(0, start) + "  " + value.slice(end));
    // Restore the caret after the inserted indentation.
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2;
    });
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-900 focus-within:border-indigo-500">
      <div
        ref={gutterRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-11 select-none overflow-hidden border-r border-slate-700/70 bg-slate-800/60 text-right"
      >
        <div className="font-code px-2 py-3 text-xs leading-6 text-slate-500">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        wrap="off"
        rows={minRows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="font-code block w-full resize-y bg-transparent py-3 pl-14 pr-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
      />
    </div>
  );
}
