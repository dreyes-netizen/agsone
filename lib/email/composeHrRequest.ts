import type { HrRequestCategory, HrRequestType } from "@/lib/constants/hrRequests";

/**
 * Turns a filled-in HR request into the subject and body of a Gmail draft.
 *
 * Deliberately pure — no React, no `Date.now()`, no locale or timezone reads —
 * for two reasons. It has to produce byte-identical output on the client (which
 * opens the draft) and on the server (which stores the record), and a golden
 * test of the exact string is only stable if nothing here varies by machine.
 * That is why dates and numbers pass through as the raw trimmed strings the
 * employee submitted rather than being localised: `toLocaleString` would render
 * differently in Manila and on a Vercel box in `syd1`.
 */

export type HrRequesterProfile = {
  displayName: string;
  email: string | null;
  employeeId: string | null;
  position: string | null;
  departmentName: string | null;
};

export type ComposeHrRequestInput = {
  profile: HrRequesterProfile;
  category: HrRequestCategory;
  type: HrRequestType;
  /** Already validated and trimmed by `validateHrRequestFields`. */
  values: Record<string, string>;
  /** The free-text "anything else", offered on every request type. */
  notes?: string;
  /**
   * Short traceability code shared by the email and the stored row. Passed in
   * rather than generated here so this function stays deterministic.
   */
  ref: string;
};

/** Renders a "Label: value" block, skipping anything blank. */
function detailLines(pairs: readonly (readonly [string, string | null | undefined])[]): string[] {
  return pairs
    .filter((pair): pair is readonly [string, string] => Boolean(pair[1] && pair[1].trim()))
    .map(([label, value]) => `${label}: ${value.trim()}`);
}

function section(heading: string, lines: readonly string[]): string[] {
  // An empty section is omitted entirely rather than left as a bare heading.
  return lines.length > 0 ? [`--- ${heading} ---`, ...lines, ""] : [];
}

/**
 * The text HR should read for a field. Select values are persisted as stable
 * codes, so an unmapped one falls back to the raw code rather than vanishing —
 * a retired option must still be legible in an old email.
 */
function displayValue(field: HrRequestType["fields"][number], value: string): string {
  if (field.kind !== "select") return value;
  return field.options?.find((o) => o.value === value)?.label ?? value;
}

export function composeHrRequest(input: ComposeHrRequestInput): { subject: string; body: string } {
  const { profile, category, type, values, notes, ref } = input;

  const trimmed = (id: string): string => {
    const raw = values[id];
    return typeof raw === "string" ? raw.trim() : "";
  };

  // Iterate the catalog, not the submitted values: the email must read in a
  // stable, designed order regardless of the order keys happen to arrive in.
  const requestLines = type.fields.flatMap((field) => {
    const value = trimmed(field.id);
    return value ? [`${field.label}: ${displayValue(field, value)}`] : [];
  });

  const summaryField = type.summaryFieldId
    ? type.fields.find((f) => f.id === type.summaryFieldId)
    : undefined;
  const summaryRaw = summaryField ? trimmed(summaryField.id) : "";
  const headline =
    summaryField && summaryRaw ? displayValue(summaryField, summaryRaw) : type.label;
  const who = profile.employeeId
    ? `${profile.displayName} (${profile.employeeId})`
    : profile.displayName;

  const subject = `[${type.tag}] ${headline} — ${who}`;

  const body = [
    "Hi HR,",
    "",
    `I would like to request: ${type.label} (${category.label})`,
    "",
    ...section(
      "EMPLOYEE",
      detailLines([
        ["Name", profile.displayName],
        ["Employee ID", profile.employeeId],
        ["Position", profile.position],
        ["Department", profile.departmentName],
        ["Company email", profile.email],
      ]),
    ),
    ...section("REQUEST DETAILS", requestLines),
    ...section("ADDITIONAL NOTES", notes?.trim() ? [notes.trim()] : []),
    ...section(
      "PLEASE ATTACH BEFORE SENDING",
      (type.attachments ?? []).map((a) => `- ${a}`),
    ),
    ...(type.turnaround ? [`Expected turnaround: ${type.turnaround}`, ""] : []),
    `Sent from AGS One · Ref ${ref}`,
  ].join("\n");

  return { subject, body };
}
