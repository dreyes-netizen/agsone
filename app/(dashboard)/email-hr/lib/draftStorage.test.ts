import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDraft, saveDraft, clearDraft } from "./draftStorage";

const KEY = "ags-one:hr-request-draft:v1";
const NOW = Date.UTC(2026, 7, 29);
const DAY = 24 * 60 * 60 * 1000;

// The Vitest env is node, which has no localStorage — install a minimal one.
let store: Map<string, string>;

function installStorage(overrides: Partial<Storage> = {}) {
  store = new Map();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    ...overrides,
  };
  vi.stubGlobal("localStorage", storage);
}

const draft = {
  categoryId: "documents",
  typeId: "coe",
  values: { purpose: "loan_bank", include_salary: "yes" },
  notes: "For a bank loan.",
};

beforeEach(() => {
  vi.unstubAllGlobals();
  installStorage();
});

describe("HR request draft storage", () => {
  it("round-trips a draft", () => {
    saveDraft(draft, NOW);
    expect(loadDraft(NOW)).toEqual({ ...draft, savedAt: NOW });
  });

  it("returns null when nothing is stored", () => {
    expect(loadDraft(NOW)).toBeNull();
  });

  it("discards a draft older than seven days", () => {
    saveDraft(draft, NOW);
    expect(loadDraft(NOW + 6 * DAY)).not.toBeNull();
    expect(loadDraft(NOW + 8 * DAY)).toBeNull();
  });

  it("discards a draft whose request type has left the catalog", () => {
    store.set(KEY, JSON.stringify({ ...draft, typeId: "retired_type", savedAt: NOW }));
    expect(loadDraft(NOW)).toBeNull();
  });

  it("returns null rather than throwing on malformed JSON", () => {
    store.set(KEY, "{not json");
    expect(loadDraft(NOW)).toBeNull();
  });

  it("returns null when the stored shape is wrong", () => {
    store.set(KEY, JSON.stringify({ typeId: "coe", values: { a: 1 }, savedAt: NOW }));
    expect(loadDraft(NOW)).toBeNull();
  });

  it("does not persist an empty draft", () => {
    saveDraft({ categoryId: "documents", typeId: "coe", values: {}, notes: "" }, NOW);
    expect(store.has(KEY)).toBe(false);
  });

  it("persists a draft that has only notes", () => {
    saveDraft({ categoryId: "general", typeId: "general_hr_question", values: {}, notes: "hi" }, NOW);
    expect(loadDraft(NOW)).not.toBeNull();
  });

  it("swallows a setItem that throws, so a full quota never breaks the form", () => {
    installStorage({
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(() => saveDraft(draft, NOW)).not.toThrow();
  });

  it("swallows a getItem that throws, as in Safari private mode", () => {
    installStorage({
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(loadDraft(NOW)).toBeNull();
  });

  it("clears a stored draft", () => {
    saveDraft(draft, NOW);
    clearDraft();
    expect(loadDraft(NOW)).toBeNull();
  });
});
