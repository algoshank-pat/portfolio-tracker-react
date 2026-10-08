import { useCallback, useEffect, useState } from "react";
import { AppShell, type TabDef } from "./components/AppShell";
import { Assistant } from "./components/Assistant";
import { DataSource } from "./components/DataSource";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PortfolioProvider } from "./state/portfolio";
import { InputTab } from "./tabs/InputTab";
import { PortfolioTab } from "./tabs/PortfolioTab";
import { PerformanceTab } from "./tabs/PerformanceTab";
import { ArchitectureTab } from "./tabs/ArchitectureTab";

// Dashboards first: visitors land on the sample portfolio, and input is one click away.
const TABS: TabDef[] = [
  { id: "portfolio", label: "Current Portfolio", short: "Portfolio" },
  { id: "performance", label: "Historical Performance", short: "Performance" },
  { id: "input", label: "Input Transactions", short: "Input" },
  { id: "architecture", label: "Architecture", short: "Architecture" },
];
const DEFAULT_TAB = "portfolio";

const fromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, "");
  return TABS.some((t) => t.id === id) ? id : DEFAULT_TAB;
};

export function App() {
  const [active, setActive] = useState(fromHash);

  useEffect(() => {
    const onHash = () => setActive(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const select = useCallback((id: string) => {
    setActive(id);
    if (window.location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
  }, []);

  return (
    <PortfolioProvider>
      <AppShell tabs={TABS} active={active} onSelect={select} aside={<DataSource onGo={select} />}>
        <ErrorBoundary resetKey={active}>
          {active === "portfolio" && <PortfolioTab onGo={select} />}
          {active === "performance" && <PerformanceTab onGo={select} />}
          {active === "input" && <InputTab onGo={select} />}
          {active === "architecture" && <ArchitectureTab />}
        </ErrorBoundary>
      </AppShell>
      <Assistant />
    </PortfolioProvider>
  );
}
