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
export type IconName =
  | "info"
  | "alert"
  | "chart"
  | "upload"
  | "trend"
  | "plus"
  | "download"
  | "zoom"
  | "close"
  | "minus"
  | "server"
  | "pie"
  | "linkedin"
  | "github";

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
  // Brand marks are filled, not stroked.
  linkedin: (
    <path
      fill="currentColor"
      stroke="none"
      d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"
    />
  ),
  github: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.57A12 12 0 0 0 12 .3Z"
    />
  ),
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
