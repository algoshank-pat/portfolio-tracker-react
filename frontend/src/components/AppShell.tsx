// Page frame: editorial header, accessible tab bar (arrow keys, Home/End) and the active panel.

import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./ui";
import { WakingServer } from "./WakingServer";
import s from "./AppShell.module.css";

export interface TabDef {
  id: string;
  label: string;
  short: string;
}

export function AppShell({
  tabs,
  active,
  onSelect,
  aside,
  children,
}: {
  tabs: TabDef[];
  active: string;
  onSelect: (id: string) => void;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const i = tabs.findIndex((t) => t.id === active);
      let next = -1;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      onSelect(tabs[next].id);
      refs.current[tabs[next].id]?.focus();
    },
    [tabs, active, onSelect],
  );

  // Keep the active tab visible in the scrollable bar on small screens.
  // (Scrolls only the tab strip horizontally, never the page.)
  useEffect(() => {
    const el = refs.current[active];
    const bar = el?.parentElement;
    if (!el || !bar) return;
    if (el.offsetLeft < bar.scrollLeft) bar.scrollLeft = el.offsetLeft - 16;
    else if (el.offsetLeft + el.offsetWidth > bar.scrollLeft + bar.clientWidth)
      bar.scrollLeft = el.offsetLeft + el.offsetWidth - bar.clientWidth + 16;
  }, [active]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <WakingServer />
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.intro}>
            <div className={s.brand}>
              <span className={s.mark} aria-hidden="true">
                <Icon name="pie" />
              </span>
              <span className={s.kicker}>Portfolio Tracker</span>
            </div>
            <h1 className={s.title}>Every trade, one clear picture.</h1>
            <p className={s.lede}>
              Holdings, allocation, total return and XIRR from your buy and sell history, priced with daily closes from
              Yahoo Finance.
            </p>
          </div>
          {aside && <div className={s.aside}>{aside}</div>}
        </div>
        <div className={s.tabBar}>
          <div className={s.tabs} role="tablist" aria-label="Sections" onKeyDown={onKey}>
            {tabs.map((t, i) => {
              const selected = t.id === active;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    refs.current[t.id] = el;
                  }}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${t.id}`}
                  aria-label={t.label}
                  tabIndex={selected ? 0 : -1}
                  className={s.tab}
                  onClick={() => onSelect(t.id)}
                >
                  <span className={s.tabNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={s.tabLong}>{t.label}</span>
                  <span className={s.tabShort} aria-hidden="true">
                    {t.short}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <main id="main" className={s.main} tabIndex={-1}>
        <div
          key={active}
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          className={s.panel}
          tabIndex={0}
        >
          {children}
        </div>
      </main>
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span>Read-only demo. Not investment advice.</span>
          <span>USD only · daily closes · splits and dividends ignored</span>
        </div>
      </footer>
    </>
  );
}
