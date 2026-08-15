"use client";

import { useMemo, useState } from "react";

export type MentionEmployee = { id: string; displayName: string };

/**
 * @mention typing for a single plain textarea.
 *
 * The feed composer has had mentions for a while, but the logic lived inline in
 * lib/hooks/useFeedActions.ts and was tied to that one textarea's state, so
 * comments and replies had no way to reuse it. This is the same behaviour
 * extracted so any composer can opt in — one hook instance per textarea.
 *
 * Storage format matches the composer exactly: the textarea holds a readable
 * `@Display Name`, and `encode()` rewrites it to the `@[Display Name|uuid]`
 * token the server parses and PostMentionText renders. Keeping one format
 * matters — the server-side parser is shared, so a second format would silently
 * fail to notify anyone.
 */

// Stops at a newline and caps the length, so an unmatched "@" early in a long
// comment doesn't leave the dropdown open over everything typed afterwards.
const TRIGGER = /@(?!\[)([^@\n]{0,40})$/;

/**
 * Whether the caret currently sits in a mention query.
 *
 * Exposed so a composer can lazily fetch the employee roster the first time
 * someone types "@", instead of loading it on mount for every user who never
 * mentions anyone — /api/employees is a full-roster call and this app is
 * actively trying to reduce per-page invocations.
 */
export function hasMentionTrigger(value: string, cursor: number): boolean {
  return TRIGGER.test(value.slice(0, cursor));
}

export function useMentionInput(employees: MentionEmployee[]) {
  const [query, setQuery] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  // displayName -> id, captured at pick time. Only these are encoded, so typing
  // a literal "@someone" that was never selected stays plain text.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    if (query === null) return [];
    return employees
      .filter((e) => query === "" || e.displayName.toLowerCase().includes(query))
      .slice(0, 6);
  }, [employees, query]);

  const open = query !== null && results.length > 0;

  /** Call on every change with the new value and the caret position. */
  function detect(value: string, cursor: number) {
    const match = value.slice(0, cursor).match(TRIGGER);
    if (match) {
      setQuery(match[1].toLowerCase().trim());
      setStart(cursor - match[0].length);
      setActiveIndex(0);
    } else {
      setQuery(null);
    }
  }

  /** Returns the text with the partial @query replaced by the chosen name. */
  function select(value: string, cursor: number, emp: MentionEmployee): string {
    const before = value.slice(0, start);
    const after = value.slice(cursor);
    setPicked((prev) => ({ ...prev, [emp.displayName]: emp.id }));
    setQuery(null);
    return `${before}@${emp.displayName} ${after.trimStart()}`;
  }

  /**
   * Rewrite picked names into `@[Name|id]` tokens. Longest name first so
   * "Ana Cruz" is not partially consumed by a shorter "Ana".
   */
  function encode(text: string): string {
    const entries = Object.entries(picked).sort((a, b) => b[0].length - a[0].length);
    let out = text;
    for (const [name, id] of entries) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`@${escaped}`, "g"), `@[${name}|${id}]`);
    }
    return out;
  }

  function reset() {
    setQuery(null);
    setPicked({});
    setActiveIndex(0);
  }

  function close() {
    setQuery(null);
  }

  return { open, results, activeIndex, setActiveIndex, detect, select, encode, reset, close };
}

export type MentionInput = ReturnType<typeof useMentionInput>;
