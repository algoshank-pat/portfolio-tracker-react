// App state: the validated transactions and the portfolio/performance results computed from them.
// Your own transactions are saved in this browser only (localStorage, SPEC.md A11) and re-validated on
// the next visit; the sample is never saved. The server stores nothing.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "../api/client";
import type { PerformanceResponse, PortfolioResponse, Transaction } from "../api/types";
import { clearSaved, loadSaved, saveTransactions } from "../lib/storage";

export const SAMPLE_URL = "/sample_transactions.csv";
export const MAX_UPLOAD_BYTES = 2_000_000;

export type Query<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; errors: string[] };

export type InputStatus = { kind: "idle" } | { kind: "loading"; label: string } | { kind: "error"; errors: string[]; title?: string };

interface PortfolioState {
  transactions: Transaction[];
  useSample: boolean;
  input: InputStatus;
  portfolio: Query<PortfolioResponse>;
  performance: Query<PerformanceResponse>;
  setUseSample: (on: boolean) => void;
  uploadCsv: (file: File) => Promise<boolean>;
  addTransaction: (row: Omit<Transaction, "fees"> & { fees?: number }) => Promise<boolean>;
  clearAll: () => void;
  clearMyData: () => void;
  /** True when the transactions shown were restored from this browser on load. */
  restored: boolean;
  dismissInputError: () => void;
  retryResults: () => void;
}

const Ctx = createContext<PortfolioState | null>(null);

function errorsOf(e: unknown): string[] {
  if (e instanceof ApiError) return e.errors;
  return ["Something went wrong. Please try again."];
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [useSample, setUseSampleFlag] = useState(true);
  const [input, setInput] = useState<InputStatus>({ kind: "idle" });
  const [portfolio, setPortfolio] = useState<Query<PortfolioResponse>>({ status: "idle" });
  const [performance, setPerformance] = useState<Query<PerformanceResponse>>({ status: "idle" });
  const [resultsNonce, setResultsNonce] = useState(0);
  const inputSeq = useRef(0);
  const [restored, setRestored] = useState(false);

  const loadSample = useCallback(async () => {
    const seq = ++inputSeq.current;
    setInput({ kind: "loading", label: "Loading the sample portfolio…" });
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new ApiError(res.status, ["Could not load the sample file."]);
      const out = await api.validateCsv(await res.text());
      if (seq !== inputSeq.current) return;
      setTransactions(out.transactions);
      setInput({ kind: "idle" });
    } catch (e) {
      if (seq !== inputSeq.current) return;
      setInput({ kind: "error", errors: errorsOf(e) });
    }
  }, []);

  // First load: your saved transactions (re-checked by the backend), else the sample.
  useEffect(() => {
    const saved = loadSaved();
    if (!saved) {
      void loadSample();
      return;
    }
    const seq = ++inputSeq.current;
    setUseSampleFlag(false);
    setInput({ kind: "loading", label: "Loading your saved transactions…" });
    api
      .validateRows(saved)
      .then((out) => {
        if (seq !== inputSeq.current) return;
        setTransactions(out.transactions);
        setRestored(true);
        setInput({ kind: "idle" });
      })
      .catch((e) => {
        if (seq !== inputSeq.current) return;
        const rejected = e instanceof ApiError && e.status === 422;
        if (rejected) clearSaved(); // no longer valid: drop it rather than fail on every visit
        setUseSampleFlag(true);
        void loadSample().then(() =>
          setInput({
            kind: "error",
            title: rejected
              ? "Your saved transactions couldn’t be loaded, so the sample is shown:"
              : "Your saved transactions couldn’t be checked right now, so the sample is shown:",
            errors: errorsOf(e),
          }),
        );
      });
  }, [loadSample]);

  const setUseSample = useCallback(
    (on: boolean) => {
      setUseSampleFlag(on);
      inputSeq.current++;
      setTransactions([]);
      setRestored(false);
      setInput({ kind: "idle" });
      if (on) {
        clearSaved(); // showing the sample means nothing of yours is kept
        void loadSample();
      }
    },
    [loadSample],
  );

  const uploadCsv = useCallback(async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      setInput({ kind: "error", errors: ["That file is larger than 2 MB. Please upload a smaller CSV."] });
      return false;
    }
    if (!/\.csv$/i.test(file.name) && file.type && !file.type.includes("csv") && file.type !== "text/plain") {
      setInput({ kind: "error", errors: ["Please choose a .csv file."] });
      return false;
    }
    const seq = ++inputSeq.current;
    setInput({ kind: "loading", label: `Checking ${file.name}…` });
    try {
      const out = await api.validateCsv(await file.text());
      if (seq !== inputSeq.current) return false;
      setUseSampleFlag(false); // uploading (from the header card too) switches off the sample
      setTransactions(out.transactions); // an upload replaces the current list
      saveTransactions(out.transactions);
      setRestored(false);
      setInput({ kind: "idle" });
      return true;
    } catch (e) {
      if (seq !== inputSeq.current) return false;
      setInput({ kind: "error", errors: errorsOf(e) });
      return false;
    }
  }, []);

  const addTransaction = useCallback(
    async (row: Omit<Transaction, "fees"> & { fees?: number }) => {
      const seq = ++inputSeq.current;
      setInput({ kind: "loading", label: "Checking the new transaction…" });
      const rows = [...transactions, { ...row, fees: row.fees ?? 0 }];
      try {
        const out = await api.validateRows(rows);
        if (seq !== inputSeq.current) return false;
        setTransactions(out.transactions);
        saveTransactions(out.transactions);
        setInput({ kind: "idle" });
        return true;
      } catch (e) {
        if (seq !== inputSeq.current) return false;
        // The new row is last; name it plainly instead of by number.
        const newRow = `Row ${rows.length}:`;
        const errors = errorsOf(e).map((m) => (m.startsWith(newRow) ? m.replace(newRow, "New transaction:") : m));
        setInput({ kind: "error", errors, title: "That transaction wasn’t added:" });
        return false;
      }
    },
    [transactions],
  );

  const clearAll = useCallback(() => {
    inputSeq.current++;
    setTransactions([]);
    clearSaved();
    setRestored(false);
    setInput({ kind: "idle" });
  }, []);

  // "Clear my data": forget everything saved in this browser and show the sample again.
  const clearMyData = useCallback(() => setUseSample(true), [setUseSample]);

  const dismissInputError = useCallback(() => setInput({ kind: "idle" }), []);
  const retryResults = useCallback(() => setResultsNonce((n) => n + 1), []);

  // Recompute both result sets whenever the transactions change.
  useEffect(() => {
    if (!transactions.length) {
      setPortfolio({ status: "idle" });
      setPerformance({ status: "idle" });
      return;
    }
    let live = true;
    setPortfolio({ status: "loading" });
    setPerformance({ status: "loading" });
    api
      .portfolio(transactions)
      .then((data) => live && setPortfolio({ status: "success", data }))
      .catch((e) => live && setPortfolio({ status: "error", errors: errorsOf(e) }));
    api
      .performance(transactions)
      .then((data) => live && setPerformance({ status: "success", data }))
      .catch((e) => live && setPerformance({ status: "error", errors: errorsOf(e) }));
    return () => {
      live = false;
    };
  }, [transactions, resultsNonce]);

  const value = useMemo<PortfolioState>(
    () => ({
      transactions,
      useSample,
      input,
      portfolio,
      performance,
      setUseSample,
      uploadCsv,
      addTransaction,
      clearAll,
      clearMyData,
      restored,
      dismissInputError,
      retryResults,
    }),
    [transactions, useSample, input, portfolio, performance, setUseSample, uploadCsv, addTransaction, clearAll, clearMyData, restored, dismissInputError, retryResults],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortfolio(): PortfolioState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortfolio must be used inside <PortfolioProvider>");
  return v;
}
