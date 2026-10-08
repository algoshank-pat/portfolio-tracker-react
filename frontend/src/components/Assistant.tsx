// "Ask your portfolio" pop-up assistant (SPEC.md A1, A7, A12).
// Chat on the left, live activity steps on the right (a toggle on phones). Chat history lives in this
// component only: it is never saved, and it resets when the portfolio changes.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { api, ApiError } from "../api/client";
import type { ChatEvent, ChatTurn } from "../api/types";
import { usePortfolio } from "../state/portfolio";
import { RichText } from "./RichText";
import { Icon, cx } from "./ui";
import { useServerStatus } from "./WakingServer";
import s from "./Assistant.module.css";

const MAX_CHARS = 500;
const MAX_HISTORY = 10;

type Kind = "answer" | "declined" | "clarify" | "error";
interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
  kind?: Kind;
  tools?: string[];
}
interface Step {
  id: number;
  q: number;
  tone: "info" | "ok" | "warn" | "tool";
  text: string;
}

let nextId = 1;

function stepFor(e: ChatEvent): Pick<Step, "tone" | "text"> | null {
  switch (e.type) {
    case "received":
      return { tone: "info", text: "Question received" };
    case "scope": {
      const label = e.decision === "in_scope" ? "in scope" : e.decision === "out_of_scope" ? "out of scope" : "unclear";
      return { tone: e.decision === "in_scope" ? "ok" : "warn", text: `Context check: ${label}. ${e.reason}` };
    }
    case "declined":
      return { tone: "warn", text: e.activity };
    case "clarify":
      return { tone: "warn", text: "Asked one clarifying question" };
    case "tool_call": {
      const args = Object.keys(e.args).length ? JSON.stringify(e.args) : "";
      return { tone: "tool", text: `Tool call: ${e.tool}(${args})` };
    }
    case "tool_result":
      return { tone: "tool", text: `Result: ${e.summary}` };
    case "answer":
      return { tone: "ok", text: `Answer sent. Tools used: ${e.tools_used.join(", ")}` };
    case "error":
      return { tone: "warn", text: `Error: ${e.text}` };
  }
}

export function Assistant() {
  const { transactions, useSample } = usePortfolio();
  const status = useServerStatus();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "activity">("chat");
  // The Activity panel is for demos: hidden until someone clicks "Show activity".
  const [showActivity, setShowActivity] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const stepsEnd = useRef<HTMLDivElement>(null);
  const run = useRef(0);
  const titleId = useId();

  // A different portfolio makes earlier answers wrong: start a fresh conversation.
  useEffect(() => {
    run.current++;
    setMsgs([]);
    setSteps([]);
    setBusy(false);
  }, [transactions]);

  // Braces matter: newer browsers return a Promise from scrollIntoView, which React must not get back.
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);
  useEffect(() => {
    stepsEnd.current?.scrollIntoView({ block: "end" });
  }, [steps]);

  // Focus moves into the panel on open, and back to the "Ask" button (re-rendered after close) on close.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) input.current?.focus();
    else if (wasOpen.current) fab.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  // Esc closes; Tab stays inside the panel while it is open.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>("button, textarea, [tabindex='0']")].filter(
      (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const ask = async () => {
    const message = draft.trim();
    if (!message || busy || message.length > MAX_CHARS) return;
    const r = ++run.current;
    const q = nextId++;
    const history: ChatTurn[] = msgs.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.text }));
    setMsgs((m) => [...m, { id: nextId++, role: "user", text: message }]);
    setSteps((st) => [...st, { id: nextId++, q, tone: "info", text: `Q: ${message}` }]);
    setDraft("");
    setBusy(true);
    const reply = (text: string, kind: Kind, tools?: string[]) =>
      setMsgs((m) => [...m, { id: nextId++, role: "assistant", text, kind, tools }]);
    try {
      await api.chat({ transactions, message, history }, (e) => {
        if (r !== run.current) return; // a newer portfolio or question took over
        const step = stepFor(e);
        if (step) setSteps((st) => [...st, { id: nextId++, q, ...step }]);
        if (e.type === "answer") reply(e.text, "answer", e.tools_used);
        else if (e.type === "declined" || e.type === "clarify") reply(e.text, e.type === "declined" ? "declined" : "clarify");
        else if (e.type === "error") reply(e.text, "error");
      });
    } catch (err) {
      if (r !== run.current) return;
      const text = err instanceof ApiError ? err.errors[0] : "The assistant couldn’t answer right now. Please try again.";
      setSteps((st) => [...st, { id: nextId++, q, tone: "warn", text: `Error: ${text}` }]);
      reply(text, "error");
    } finally {
      if (r === run.current) setBusy(false);
    }
  };

  const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask();
    }
  };

  if (!transactions.length) return null;
  const left = MAX_CHARS - draft.length;

  return (
    <>
      {!open && (
        <button ref={fab} type="button" className={s.fab} onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Icon name="chat" className={s.fabIcon} />
          <span>Ask</span>
        </button>
      )}
      {open && (
        <div
          ref={panel}
          className={cx(s.panel, showActivity && s.panelWide)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={onKeyDown}
        >
          <header className={s.head}>
            <div>
              <h2 id={titleId} className={s.title}>
                Ask your portfolio
              </h2>
              <p className={s.sub}>
                {useSample ? "About the sample portfolio" : "About your transactions"} · not investment advice ·{" "}
                <button
                  type="button"
                  className={s.activityLink}
                  aria-pressed={showActivity}
                  onClick={() => {
                    setShowActivity((on) => !on);
                    setView("chat");
                  }}
                >
                  {showActivity ? "Hide activity" : "Show activity"}
                </button>
              </p>
            </div>
            <button type="button" className={s.close} onClick={close} aria-label="Close the assistant">
              <Icon name="close" className={s.closeIcon} />
            </button>
          </header>

          {showActivity && (
            <div className={s.switch} role="tablist" aria-label="Assistant view">
              {(["chat", "activity"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className={cx(s.switchBtn, view === v && s.switchOn)}
                  onClick={() => setView(v)}
                >
                  {v === "chat" ? "Chat" : `Activity${steps.length ? ` (${steps.length})` : ""}`}
                </button>
              ))}
            </div>
          )}

          <div className={cx(s.body, showActivity && s.bodyWide)} data-view={showActivity ? view : "chat"}>
            <section className={s.chat} aria-label="Conversation">
              <div className={s.log} aria-live="polite" tabIndex={0}>
                {!msgs.length && (
                  <div className={s.empty}>
                    <p className={s.emptyTitle}>Questions about this portfolio only</p>
                    <p>
                      For example: what each holding is worth, your total return or XIRR, whether prices are live, or what
                      a hypothetical buy or sell would change. Every number comes from the app’s own calculations.
                    </p>
                  </div>
                )}
                {msgs.map((m) => (
                  <div key={m.id} className={cx(s.msg, m.role === "user" ? s.user : s.bot, m.kind && s[m.kind])}>
                    {m.role === "assistant" ? <RichText text={m.text} className={s.rich} /> : m.text}
                  </div>
                ))}
                {busy && (
                  <div className={cx(s.msg, s.bot, s.typing)} aria-label="The assistant is working">
                    {status === "waking" ? "Waking the server, this can take about a minute…" : <><i /><i /><i /></>}
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              <form
                className={s.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask();
                }}
              >
                <label htmlFor={`${titleId}-q`} className="visually-hidden">
                  Your question
                </label>
                <textarea
                  ref={input}
                  id={`${titleId}-q`}
                  className={s.input}
                  rows={2}
                  maxLength={MAX_CHARS}
                  placeholder="Ask about this portfolio…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onInputKey}
                />
                <div className={s.formRow}>
                  <span className={cx(s.count, left < 50 && s.countLow)} aria-live="polite">
                    {left} characters left
                  </span>
                  <button type="submit" className={s.send} disabled={busy || !draft.trim()}>
                    {busy ? "Working…" : "Ask"}
                  </button>
                </div>
              </form>
            </section>

            {showActivity && (
              <section className={s.activity} aria-label="Activity">
                <h3 className={s.actTitle}>Activity</h3>
                {!steps.length ? (
                  <p className={s.actEmpty}>Each step appears here as it happens: the context check, every tool call and its result, then the answer.</p>
                ) : (
                  <ol className={s.steps}>
                    {steps.map((st) => (
                      <li key={st.id} className={cx(s.step, s[st.tone])}>
                        {st.text}
                      </li>
                    ))}
                  </ol>
                )}
                <div ref={stepsEnd} />
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
