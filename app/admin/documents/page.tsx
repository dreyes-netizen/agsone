"use client";

import { useEffect, useState, useRef } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useModalA11y } from "@/lib/hooks/useModalA11y";
import { FileText, Upload, Trash2, ToggleLeft, ToggleRight, X, RefreshCw, Pencil, Check, Copy, CheckCheck, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const MD_CONVERSION_PROMPT = `Convert this PDF to clean Markdown. Preserve all section headings with proper heading levels (# ## ###), numbered lists, bullet points, and tables exactly as they appear. Do not summarize or skip any content — include everything word for word. Output only the Markdown, no commentary.`;

type PolicyDocument = {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  isActive: boolean;
  uploadedAt: string;
  uploadedBy: { displayName: string };
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { apiFetch } = useApiClient();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [docName, setDocName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<string>("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [toast, setToast] = useState<{type:"success"|"error";msg:string}|null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string|null>(null);
  const uploadModalRef = useModalA11y(modalOpen, () => setModalOpen(false));

  function showToast(t:"success"|"error",m:string){setToast({type:t,msg:m});setTimeout(()=>setToast(null),4000);}

  function copyPrompt() {
    navigator.clipboard.writeText(MD_CONVERSION_PROMPT);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: PolicyDocument[] }>("/api/admin/documents");
      setDocuments(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleUpload() {
    if (!file || !docName.trim()) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = file.type === "application/pdf" || ext === "pdf" || ext === "md" || ext === "txt";
    if (!allowed) {
      setUploadError("Only PDF, Markdown (.md), or plain text (.txt) files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File must be under 10MB.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", docName.trim());
      await apiFetch("/api/admin/documents", { method: "POST", body: form });
      setModalOpen(false);
      setDocName("");
      setFile(null);
      await load();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    setDeleteConfirmId(id);
  }

  async function confirmDelete(id: string) {
    try {
      await apiFetch(`/api/admin/documents/${id}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setDeleteConfirmId(null);
      showToast("success", "Document deleted.");
    } catch (err) {
      setDeleteConfirmId(null);
      showToast("error", err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function handleReindex() {
    setReindexing(true);
    setReindexResult("");
    try {
      const res = await apiFetch<{ data: { name: string; status: string }[] }>(
        "/api/admin/documents/reindex",
        { method: "POST" },
      );
      const summary = res.data.map((r) => `${r.name}: ${r.status}`).join("\n");
      setReindexResult(summary);
      showToast("success", "Re-index complete.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reindex failed";
      setReindexResult(msg);
      showToast("error", msg);
    } finally {
      setReindexing(false);
    }
  }

  async function handleRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    await apiFetch(`/api/admin/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
    setRenamingId(null);
  }

  async function handleToggle(id: string, current: boolean) {
    await apiFetch(`/api/admin/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !current }),
    });
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isActive: !current } : d)),
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Toast banner */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policy Documents</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage documents available to Ally, the AGS HR assistant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReindex}
            disabled={reindexing}
            title="Re-index all active documents for Ally"
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <RefreshCw className={`w-4 h-4 ${reindexing ? "animate-spin" : ""}`} />
            {reindexing ? "Re-indexing…" : "Re-index Ally"}
          </button>
          <button
            onClick={() => { setModalOpen(true); setUploadError(""); setDocName(""); setFile(null); }}
            className="flex items-center gap-2 bg-[#111827] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1f2937] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {reindexResult && (
        <div className="mb-4 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-zinc-500 mb-1">Re-index result</p>
          <pre className="text-xs text-zinc-700 whitespace-pre-wrap">{reindexResult}</pre>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16 text-gray-500 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No documents uploaded yet</p>
          <p className="text-gray-500 text-sm mt-1">Upload a document to make it available to the chatbot.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">File</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Size</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Uploaded</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    {renamingId === doc.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(doc.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="border border-indigo-300 rounded px-2 py-1 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                        />
                        <button onClick={() => handleRename(doc.id)} className="text-emerald-500 hover:text-emerald-700">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setRenamingId(null)} className="text-gray-500 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className="font-medium text-gray-900">{doc.name}</span>
                        <button
                          onClick={() => { setRenamingId(doc.id); setRenameValue(doc.name); }}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-indigo-500 transition-opacity"
                          title="Rename"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{doc.fileName}</td>
                  <td className="px-5 py-3 text-gray-500">{formatBytes(doc.fileSize)}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleToggle(doc.id, doc.isActive)}
                      className="flex items-center gap-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                    >
                      {doc.isActive ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-emerald-500" />
                          <span className="text-emerald-600">Active</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-500">Inactive</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                    <span className="block text-gray-500">{doc.uploadedBy.displayName}</span>
                  </td>
                  <td className="px-5 py-3">
                    {deleteConfirmId === doc.id ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-700 font-medium">Delete?</span>
                        <button
                          onClick={() => confirmDelete(doc.id)}
                          className="text-red-600 font-semibold hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDelete(doc.id, doc.name)}
                        className="text-red-400 hover:text-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div
            ref={uploadModalRef}
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 id="upload-modal-title" className="font-semibold text-gray-900">Upload Document</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Employee Handbook"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* MD conversion tip */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-indigo-700">For best results — convert to Markdown first</p>
                <p className="text-xs text-indigo-600 leading-relaxed">
                  Upload a <span className="font-medium">.md file</span> instead of a PDF. Markdown preserves headings, tables, and lists that PDF extraction often mangles, which makes Ally's answers more accurate.
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-indigo-500">Use this prompt in <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-700">claude.ai</a> — attach your PDF and send:</p>
                  <div className="bg-white border border-indigo-200 rounded-md px-3 py-2 flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-600 leading-relaxed flex-1">{MD_CONVERSION_PROMPT}</p>
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors mt-0.5"
                      title="Copy prompt"
                    >
                      {promptCopied ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document File</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.md,.txt,text/markdown,text/plain"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-6 text-center text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {file ? (
                    <span className="text-gray-700 font-medium">{file.name} ({formatBytes(file.size)})</span>
                  ) : (
                    <>Click to select PDF, Markdown, or text file (max 10MB)</>
                  )}
                </button>
              </div>

              {uploadError && (
                <p className="text-red-500 text-sm">{uploadError}</p>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !file || !docName.trim()}
                className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading…
                  </span>
                ) : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
