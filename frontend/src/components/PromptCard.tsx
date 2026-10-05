// "The prompt behind it": the single build prompt, collapsible, with copy and download.

import { useEffect, useId, useState } from "react";
import { Button, Card, Icon } from "./ui";
import s from "./PromptCard.module.css";

const PROMPT_URL = "/build-prompt.txt";

export function PromptCard() {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const id = useId();

  useEffect(() => {
    let live = true;
    fetch(PROMPT_URL)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => live && setText(t.trim()))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen(true); // clipboard blocked: show it all so it can be selected by hand
    }
  };

  const words = text ? text.split(/\s+/).length : 0;

  return (
    <Card
      title="The prompt behind it"
      meta={
        <div className={s.actions}>
          <Button variant="secondary" size="small" onClick={copy} disabled={!text} aria-live="polite">
            <Icon name={copied ? "check" : "copy"} style={{ width: 15, height: 15 }} />
            {copied ? "Copied" : "Copy prompt"}
          </Button>
          <a className={s.download} href={PROMPT_URL} download="portfolio-tracker-prompt.txt">
            <Icon name="download" style={{ width: 15, height: 15 }} />
            .txt
          </a>
        </div>
      }
    >
      <p className={s.intro}>
        This app was vibe-coded with an AI coding assistant, one approved step at a time. Here is one prompt
        {words ? ` (about ${Math.round(words / 10) * 10} words)` : ""} that sums up everything it does. Paste it into
        your own assistant to build something similar.
      </p>
      {failed ? (
        <p className={s.intro}>
          The prompt couldn’t be loaded. <a href={PROMPT_URL}>Open it as a text file</a>.
        </p>
      ) : (
        <div className={s.wrap} data-open={open ? "" : undefined} tabIndex={0} role="region" aria-label="Build prompt, scrollable">
          <pre id={id} className={s.prompt} aria-label="Build prompt">
            {text ?? "Loading…"}
          </pre>
        </div>
      )}
      {text && (
        <div className={s.more}>
          <Button variant="ghost" size="small" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}>
            {open ? "Collapse" : "Expand to full length"}
          </Button>
        </div>
      )}
    </Card>
  );
}
