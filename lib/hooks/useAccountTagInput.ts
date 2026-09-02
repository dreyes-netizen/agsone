"use client";

import { useMemo, useState } from "react";

export type AccountEntity = { id: string; name: string };

/**
 * #account tagging for a single plain textarea.
 *
 * Mirrors lib/hooks/useMentionInput.ts's shape exactly, for the # trigger
 * instead of @ -- kept as a deliberately separate, parallel hook rather than
 * a shared generic abstraction (see the design spec's Alternatives
 * Considered section). One hook instance per textarea, same as
 * useMentionInput.
 *
 * Storage format matches the composer exactly: the textarea holds a readable
 * `#Account Name`, and encode() rewrites it to the `#[Account Name|uuid]`
 * token PostMentionText renders. This is purely a visual tag (see the design
 * spec) -- unlike @mentions, no notification or navigation is tied to it.
 */

// Stops at a newline and caps the length, mirroring useMentionInput's TRIGGER
// so an unmatched "#" early in a long post/comment doesn't leave the dropdown
// open over everything typed afterwards.
const TRIGGER = /#(?!\[)([^#\n]{0,40})$/;

/**
 * Whether the caret currently sits in an account-tag query.
 *
 * Exposed so a composer can lazily fetch the account list the first time
 * someone types "#", instead of loading it on mount for every user who never
 * tags an account.
 */
export function hasAccountTagTrigger(value: string, cursor: number): boolean {
  return TRIGGER.test(value.slice(0, cursor));
}

export function useAccountTagInput(accounts: AccountEntity[]) {
  const [query, setQuery] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  // name -> id, captured at pick time. Only these are encoded, so typing a
  // literal "#something" that was never selected stays plain text.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    if (query === null) return [];
    return accounts
      .filter((a) => query === "" || a.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [accounts, query]);

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

  /** Returns the text with the partial #query replaced by the chosen name. */
  function select(value: string, cursor: number, acct: AccountEntity): string {
    const before = value.slice(0, start);
    const after = value.slice(cursor);
    setPicked((prev) => ({ ...prev, [acct.name]: acct.id }));
    setQuery(null);
    return `${before}#${acct.name} ${after.trimStart()}`;
  }

  /** Register an account tag seeded programmatically rather than chosen from the dropdown. */
  function prime(acct: AccountEntity) {
    setPicked((prev) => ({ ...prev, [acct.name]: acct.id }));
  }

  /**
   * Rewrite picked names into `#[Name|id]` tokens. Longest name first so
   * "Flyland Recovery" is not partially consumed by a shorter "Flyland".
   */
  function encode(text: string): string {
    const entries = Object.entries(picked).sort((a, b) => b[0].length - a[0].length);
    let out = text;
    for (const [name, id] of entries) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`#${escaped}`, "g"), `#[${name}|${id}]`);
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

  return { open, results, activeIndex, setActiveIndex, detect, select, prime, encode, reset, close };
}

export type AccountTagInput = ReturnType<typeof useAccountTagInput>;
