"use client";

import type { HrField } from "@/lib/constants/hrRequests";

const INPUT_CLASS =
  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400";

/**
 * Renders one catalog field. Every control is paired with its label through
 * `htmlFor`/`id` — the page this replaced had four labels with no pairing at
 * all, so a screen reader announced the inputs unnamed.
 */
export function HrRequestField({
  field,
  value,
  error,
  onChange,
  onBlur,
}: {
  field: HrField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const id = `hrf-${field.id}`;
  const hintId = field.hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const borderClass = error ? "border-red-400" : "border-gray-300";
  const shared = {
    id,
    value,
    onBlur,
    "aria-required": field.required,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
  } as const;

  const isCounted = field.kind === "textarea" && field.maxLength !== undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        {isCounted && (
          <span className="float-right font-normal text-xs text-gray-500">
            {value.length}/{field.maxLength}
          </span>
        )}
      </label>

      {field.kind === "select" ? (
        <select
          {...shared}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLASS} ${borderClass} bg-white`}
        >
          <option value="">Select…</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.kind === "textarea" ? (
        <textarea
          {...shared}
          rows={field.rows ?? 3}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLASS} ${borderClass}`}
        />
      ) : (
        <input
          {...shared}
          type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
          maxLength={field.maxLength}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLASS} ${borderClass}`}
        />
      )}

      {field.hint && (
        <p id={hintId} className="text-xs text-gray-500 mt-1">
          {field.hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
