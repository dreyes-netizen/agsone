"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Copy, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { buildGmailComposeUrl } from "@/lib/email/gmailCompose";
import { composeHrRequest } from "@/lib/email/composeHrRequest";
import { HR_EMAIL } from "@/lib/constants/hr";
import {
  findHrCategory,
  findHrCategoryForType,
  findHrRequestType,
  validateHrRequestFields,
  type HrFieldErrors,
} from "@/lib/constants/hrRequests";
import { HrRequestPicker } from "./components/HrRequestPicker";
import { HrRequestField } from "./components/HrRequestField";
import { HrRequestGuidance } from "./components/HrRequestGuidance";
import { MyHrRequests } from "./components/MyHrRequests";
import { newClientRef } from "./lib/clientRef";
import { loadDraft, saveDraft, clearDraft } from "./lib/draftStorage";

export default function EmailHrPage() {
  const { dbUser } = useAuth();
  const { apiFetch } = useApiClient();

  const [tab, setTab] = useState<"compose" | "mine">("compose");
  const [categoryId, setCategoryId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<HrFieldErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const category = categoryId ? findHrCategory(categoryId) : null;
  const type = typeId ? findHrRequestType(typeId) : null;

  const profile = useMemo(
    () => ({
      displayName: dbUser?.displayName ?? "",
      email: dbUser?.email ?? null,
      employeeId: dbUser?.employeeId ?? null,
      position: dbUser?.position ?? null,
      departmentName: dbUser?.department?.name ?? null,
    }),
    [dbUser],
  );

  // Derived, never stored: keeping the composed message in state is how a
  // preview ends up showing something the employee is no longer sending.
  const composed = useMemo(() => {
    if (!type || !category) return null;
    return composeHrRequest({ profile, category, type, values, notes, ref: "HRQ-XXXXXXXX" });
  }, [profile, category, type, values, notes]);

  // Restore a half-filled draft once, on mount. Deferred a microtask so these
  // setState calls don't run synchronously inside the effect body
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => {
      const draft = loadDraft();
      if (!draft) return;
      setCategoryId(draft.categoryId);
      setTypeId(draft.typeId);
      setValues(draft.values);
      setNotes(draft.notes);
      setRestored(true);
    });
  }, []);

  // Debounced save. A leave application or loan query takes real effort to
  // fill in and shouldn't be lost to a stray refresh.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!typeId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft({ categoryId, typeId, values, notes }), 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [categoryId, typeId, values, notes]);

  function resetForm() {
    setTypeId("");
    setValues({});
    setNotes("");
    setErrors({});
    setTouched(new Set());
    setDraftUrl(null);
  }

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    resetForm();
  }

  function handlePick(nextCategoryId: string, nextTypeId: string) {
    const resolvedCategory = nextCategoryId || findHrCategoryForType(nextTypeId)?.id || "";
    setCategoryId(resolvedCategory);
    setTypeId(nextTypeId);
    setErrors({});
    setTouched(new Set());
    setDraftUrl(null);

    // Carry over any answer the new type also asks for, so switching between
    // two document requests doesn't re-ask for the same "needed by" date.
    const nextType = findHrRequestType(nextTypeId);
    setValues((prev) => {
      if (!nextType) return {};
      const carried: Record<string, string> = {};
      for (const field of nextType.fields) {
        if (prev[field.id]) carried[field.id] = prev[field.id];
      }
      return carried;
    });
  }

  function setValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    // Clear an error as soon as the employee starts fixing it.
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function handleBlur(fieldId: string) {
    if (!type) return;
    setTouched((prev) => new Set(prev).add(fieldId));
    const result = validateHrRequestFields(type, values);
    if (result.ok) return;
    const message = result.errors[fieldId];
    if (message) setErrors((prev) => ({ ...prev, [fieldId]: message }));
  }

  /**
   * NOT async, deliberately. `window.open` is blocked unless it runs in the
   * same synchronous turn as the click — a single `await` before it forfeits
   * the user gesture and the draft silently never opens. So the Gmail window
   * goes first and the tracking POST follows: the email is what the employee
   * came for, the row is bookkeeping, and bookkeeping must never gate it.
   */
  function handleSubmit() {
    if (!type || !category || submitting) return;

    const result = validateHrRequestFields(type, values);
    if (!result.ok) {
      setErrors(result.errors);
      setTouched(new Set(Object.keys(result.errors)));
      toast.error("Please complete the highlighted fields");
      return;
    }

    const ref = newClientRef();
    const { subject, body } = composeHrRequest({
      profile,
      category,
      type,
      values: result.cleaned,
      notes,
      ref,
    });
    const url = buildGmailComposeUrl({ to: HR_EMAIL, subject, body });

    window.open(url, "_blank", "noopener,noreferrer");
    // Kept regardless of whether the popup actually opened: `window.open` with
    // "noopener" returns null even on success, so blocking cannot be detected.
    // The anchor rendered below is a fresh gesture and can never be blocked.
    setDraftUrl(url);
    setSubmitting(true);

    apiFetch("/api/hr-requests", {
      method: "POST",
      body: JSON.stringify({ clientRef: ref, typeId: type.id, fields: result.cleaned, notes }),
    })
      .then(() => {
        clearDraft();
        setRestored(false);
        toast.success("Draft opened in Gmail — review and send it");
      })
      .catch((err: unknown) => {
        toast.error(
          err instanceof Error
            ? `Draft opened, but we couldn't log it: ${err.message}`
            : "Draft opened, but we couldn't log it",
        );
      })
      .finally(() => setSubmitting(false));
  }

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
      active ? "bg-command-black text-white" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email HR</h1>
        <p className="text-gray-500 text-sm mt-1">
          Pick what you need and we&apos;ll write the email for you. It opens as a pre-filled Gmail
          draft to {HR_EMAIL} — you review and send it yourself.
        </p>
      </div>

      <div className="flex gap-1" role="tablist" aria-label="Email HR sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "compose"}
          onClick={() => setTab("compose")}
          className={tabClass(tab === "compose")}
        >
          New request
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mine"}
          onClick={() => setTab("mine")}
          className={tabClass(tab === "mine")}
        >
          My requests
        </button>
      </div>

      {tab === "mine" ? (
        <div className="bg-white rounded-card border border-table-border p-6">
          <MyHrRequests userId={dbUser?.id ?? null} />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-card border border-table-border p-6 space-y-5">
            {restored && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-600">We restored your unfinished request.</p>
                <button
                  type="button"
                  onClick={() => {
                    clearDraft();
                    setRestored(false);
                    setCategoryId("");
                    resetForm();
                  }}
                  className="text-xs font-medium text-gray-700 hover:underline"
                >
                  Discard
                </button>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-1">Name</p>
                <p className="text-sm text-gray-500">{profile.displayName || "—"}</p>
              </div>
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-1">Department</p>
                <p className="text-sm text-gray-500">{profile.departmentName || "—"}</p>
              </div>
            </div>

            <HrRequestPicker
              categoryId={categoryId}
              typeId={typeId}
              onPick={handlePick}
              onCategoryChange={handleCategoryChange}
            />

            {!type ? (
              <p className="text-sm text-gray-500 border-t border-table-border pt-5">
                Choose a request above and we&apos;ll ask only for what HR needs to action it.
              </p>
            ) : (
              <div className="space-y-4 border-t border-table-border pt-5">
                <HrRequestGuidance type={type} />

                {type.fields.map((field) => (
                  <HrRequestField
                    key={field.id}
                    field={field}
                    value={values[field.id] ?? ""}
                    error={touched.has(field.id) ? errors[field.id] : undefined}
                    onChange={(value) => setValue(field.id, value)}
                    onBlur={() => handleBlur(field.id)}
                  />
                ))}

                <div>
                  <label htmlFor="hr-notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Anything else?
                    <span className="float-right font-normal text-xs text-gray-500">
                      {notes.length}/1000
                    </span>
                  </label>
                  <textarea
                    id="hr-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Optional — add any detail HR should know"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                </div>

                {composed && (
                  <section aria-labelledby="hr-preview-heading">
                    <h2 id="hr-preview-heading" className="block text-sm font-medium text-gray-700 mb-1">
                      Preview
                    </h2>
                    <pre className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">
                      {composed.subject}
                      {"\n\n"}
                      {composed.body}
                    </pre>
                  </section>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    aria-busy={submitting}
                    className="inline-flex items-center gap-2 bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    Open in Gmail
                  </button>

                  {composed && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(`${composed.subject}\n\n${composed.body}`)
                          .then(() => toast.success("Message copied"))
                          .catch(() => toast.error("Couldn't copy the message"));
                      }}
                      className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      Copy message
                    </button>
                  )}
                </div>

                {draftUrl && (
                  <p className="text-xs text-gray-500">
                    Draft didn&apos;t open?{" "}
                    <a
                      href={draftUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-navy-700 hover:underline"
                    >
                      Open it in Gmail
                    </a>
                    .
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs text-gray-500">
            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
            <span>
              Reporting harassment, misconduct or an ethical concern? Use{" "}
              <Link href="/feedback" className="font-medium text-navy-700 hover:underline">
                Feedback
              </Link>{" "}
              instead — it&apos;s confidential and can be sent anonymously.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
