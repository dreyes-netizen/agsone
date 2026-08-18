"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { uploadRawToCloudinary } from "@/lib/cloudinary/upload";
import { ALL_DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL } from "@/lib/constants/documentCategories";

type HrDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  version: string | null;
  fileUrl: string;
  fileName: string;
  isActive: boolean;
  createdAt: string;
};

type FormState = { title: string; description: string; category: string; version: string; file: File | null };
const EMPTY_FORM: FormState = { title: "", description: "", category: ALL_DOCUMENT_CATEGORIES[0], version: "", file: null };

export default function AdminHrDocumentsPage() {
  const { apiFetch } = useApiClient();
  const { user, token, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<HrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await apiFetch<{ data: HrDocument[] }>("/api/admin/hr-documents");
      setDocuments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useRealtimeChannel(realtimeTopics.hrDocuments, load, { debounceMs: 200 });

  async function submit() {
    if (!form.title.trim()) return setError("Title is required");
    if (!form.file) return setError("Choose a file to upload");
    setUploading(true);
    setError("");
    try {
      const fileUrl = await uploadRawToCloudinary(form.file, token!);
      await apiFetch("/api/admin/hr-documents", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          category: form.category,
          version: form.version.trim() || undefined,
          fileUrl,
          fileName: form.file.name,
        }),
      });
      toast.success("Document uploaded.");
      setShowForm(false);
      setForm(EMPTY_FORM);
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(doc: HrDocument) {
    try {
      await apiFetch(`/api/admin/hr-documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !doc.isActive }) });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function remove(doc: HrDocument) {
    try {
      await apiFetch(`/api/admin/hr-documents/${doc.id}`, { method: "DELETE" });
      toast.success(`Deleted "${doc.title}".`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Documents</h1>
          <p className="text-gray-500 text-sm mt-1">Handbook, policies, and memos shown on the employee Documents page.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setError(""); }}
            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            Upload Document
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Upload Document</h2>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                placeholder="e.g. AGS Employee Handbook"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              >
                {ALL_DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version (optional)</label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                placeholder="e.g. 2.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-sm file:font-medium hover:file:bg-gray-200"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={uploading}
              className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(""); }}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8">
            <FileText className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh] scroll-hint">
            <table className="w-full border-collapse" aria-label="HR Documents">
              <thead className="sticky top-0 z-10 bg-table-head">
                <tr className="border-b border-table-border">
                  <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Title</th>
                  <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Category</th>
                  <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Status</th>
                  <th scope="col" className="px-3.5 py-2.5 last:pr-5"></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, i) => (
                  <tr key={doc.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                    <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{doc.title}{doc.version ? ` (v${doc.version})` : ""}</td>
                    <td className="px-3.5 py-[11px] text-[13px] text-gray-500">{DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category}</td>
                    <td className="px-3.5 py-[11px] text-[13px]">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${doc.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {doc.isActive ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-3.5 py-[11px] text-[13px] last:pr-5 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => toggleActive(doc)} className="text-navy-600 hover:text-navy-800 text-sm font-medium">
                          {doc.isActive ? "Hide" : "Unhide"}
                        </button>
                        <button onClick={() => remove(doc)} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
