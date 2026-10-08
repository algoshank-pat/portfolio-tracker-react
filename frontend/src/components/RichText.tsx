// Tiny, safe formatter for assistant answers: **bold**, "- " / "* " bullets, "1. " numbered lists,
// paragraphs. It builds React elements only (never raw HTML), so model text can't inject markup;
// anything else stays plain text.

import type { ReactNode } from "react";

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/^\s*#{1,6}\s+/, ""); // a stray heading becomes plain text
    const b = BULLET.exec(line);
    const n = b ? null : NUMBERED.exec(line);
    const last = out[out.length - 1];
    if (b || n) {
      const kind = b ? "ul" : "ol";
      const item = (b ?? n)![1];
      if (last && last.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    } else if (!line.trim()) {
      out.push({ kind: "p", lines: [] }); // paragraph break
    } else if (last && last.kind === "p" && last.lines.length) {
      last.lines.push(line);
    } else {
      out.push({ kind: "p", lines: [line] });
    }
  }
  return out.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}

/** "**x**" → <strong>x</strong>; everything else is text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part.replace(/\*\*/g, "")
    ),
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {blocks(text).map((b, i) => {
        if (b.kind === "p")
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </span>
              ))}
            </p>
          );
        const List = b.kind;
        return (
          <List key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
