// Small shared building blocks. Styling lives in ui.module.css.

import { useId, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import s from "./ui.module.css";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---- Card -----------------------------------------------------------------------------
export function Card({
  title,
  meta,
  children,
  className,
  as: Tag = "section",
  labelledBy,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  labelledBy?: string;
}) {
  const id = useId();
  return (
    <Tag className={cx(s.card, className)} aria-labelledby={title ? labelledBy ?? id : undefined}>
      {(title || meta) && (
        <header className={s.cardHeader}>
          {title && (
            <h2 className={s.cardTitle} id={labelledBy ?? id}>
              {title}
            </h2>
          )}
          {meta && <div className={s.cardMeta}>{meta}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

// ---- Metric ---------------------------------------------------------------------------
export function Metric({
  label,
  value,
  sub,
  tip,
  large,
  valueClass,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tip?: string;
  large?: boolean;
  valueClass?: string;
}) {
  return (
    <div className={s.metric}>
      <span className={s.metricLabel}>
        {label}
        {tip && <InfoTip label={`About ${label}`}>{tip}</InfoTip>}
      </span>
      <span className={cx(s.metricValue, large && s.metricValueLarge, valueClass)}>{value}</span>
      {sub && <span className={s.metricSub}>{sub}</span>}
    </div>
  );
}

// ---- Banner ---------------------------------------------------------------------------
export function Banner({
  tone = "info",
  title,
  children,
  action,
  role,
}: {
  tone?: "info" | "warn" | "error";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div className={cx(s.banner, s[tone])} role={role ?? (tone === "error" ? "alert" : "status")}>
      <Icon name={tone === "info" ? "info" : "alert"} className={s.bannerIcon} />
      <div className={s.bannerBody}>
        {title && <div className={s.bannerTitle}>{title}</div>}
        {children}
      </div>
      {action && <div className={s.bannerAction}>{action}</div>}
    </div>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 1) return <p>{errors[0]}</p>;
  return (
    <ul className={s.bannerList}>
      {errors.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ul>
  );
}

// ---- Button ---------------------------------------------------------------------------
export function Button({
  variant = "primary",
  size,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "small" }) {
  return (
    <button
      type="button"
      className={cx(s.button, variant !== "primary" && s[variant], size === "small" && s.small, className)}
      {...rest}
    />
  );
}

// ---- Skeleton -------------------------------------------------------------------------
export function Skeleton({ width = "100%", height = 16, style }: { width?: string | number; height?: number; style?: CSSProperties }) {
  return <span className={s.skeleton} style={{ width, height, ...style }} aria-hidden="true" />;
}

// ---- Empty and error states --------------------------------------------------------
export function EmptyState({
  title,
  children,
  actions,
  icon = "chart",
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className={cx(s.state, s.fadeIn)}>
      <Icon name={icon} className={s.stateArt} />
      <h2 className={s.stateTitle}>{title}</h2>
      {children && <p className={s.stateText}>{children}</p>}
      {actions && <div className={s.stateActions}>{actions}</div>}
    </div>
  );
}

export function ErrorState({ errors, onRetry }: { errors: string[]; onRetry?: () => void }) {
  return (
    <div className={cx(s.state, s.fadeIn)} role="alert">
      <Icon name="alert" className={s.stateArt} />
      <h2 className={s.stateTitle}>We couldn’t load this</h2>
      <div className={s.stateText}>
        <ErrorList errors={errors} />
      </div>
      {onRetry && (
        <div className={s.stateActions}>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

// ---- Info tooltip (hover, focus or tap) ------------------------------------------
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={s.tipWrap} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={s.tipButton}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        <Icon name="info" style={{ width: 15, height: 15 }} />
      </button>
      {open && (
        <span role="tooltip" id={id} className={s.tip}>
          {children}
        </span>
      )}
    </span>
  );
}

// ---- Icons (inline, stroke uses currentColor) ------------------------------------
export type IconName = "info" | "alert" | "chart" | "upload" | "trend" | "plus" | "download" | "zoom" | "close" | "minus" | "server" | "pie";

const PATHS: Record<IconName, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 19.5h19L12 3Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="m7 15 4-4 3 3 5-6" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  pie: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  zoom: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4M11 8v6M8 11h6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
};

export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export { s as ui, cx };
