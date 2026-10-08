// Saved transactions, in this browser only (SPEC.md A11). The server never stores them.
// Every access is wrapped: a private window or blocked storage simply means nothing is saved.

import type { Transaction } from "../api/types";

const KEY = "portfolio-tracker.transactions.v1";

interface Saved {
  v: 1;
  savedAt: string;
  transactions: Transaction[];
}

export function loadSaved(): Transaction[] | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Saved>;
    return data && data.v === 1 && Array.isArray(data.transactions) && data.transactions.length ? data.transactions : null;
  } catch {
    return null;
  }
}

export function saveTransactions(transactions: Transaction[]): boolean {
  try {
    if (!transactions.length) {
      window.localStorage.removeItem(KEY);
      return true;
    }
    const data: Saved = { v: 1, savedAt: new Date().toISOString(), transactions };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // quota full or storage blocked: the app still works, it just won't remember
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: nothing was saved */
  }
}
