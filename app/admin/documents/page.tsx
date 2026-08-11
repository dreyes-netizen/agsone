"use client";

import { useEffect, useState, useRef } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Pagination } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Upload, Trash2, ToggleLeft, ToggleRight, X, RefreshCw, Pencil, Check, Copy, CheckCheck, Loader2, Bot } from "lucide-react";

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string|null>(null);
  const [allyEnabled, setAllyEnabled] = useState<boolean | null>(null);
  const [togglingAlly, setTogglingAlly] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  function copyPrompt() {
    navigator.clipboard.writeText(MD_CONVERSION_PROMPT);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: PolicyDocument[]; total: number; page: number; pages: number }>(
        `/api/admin/documents?page=${page}`,
      );
      setDocuments(res.data);
      setPages(res.pages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  useEffect(() => {
    apiFetch<{ data: { allyEnabled: boolean } }>("/api/admin/settings")
      .then((res) => setAllyEnabled(res.data.allyEnabled))
      .catch((err) => console.error("Ally settings fetch failed", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggleAlly() {
    if (allyEnabled === null || togglingAlly) return;
    const next = !allyEnabled;
    setTogglingAlly(true);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ allyEnabled: next }),
      });
      setAllyEnabled(next);
      toast.success(next ? "Ally is now ON for everyone." : "Ally is now OFF for everyone.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update Ally.");
    } finally {
      setTogglingAlly(false);
    }
  }

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
      toast.success("Document deleted.");
    } catch (err) {
      setDeleteConfirmId(null);
      toast.error(err instanceof Error ? err.message : "Delete failed.");
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
      toast.success("Re-index complete.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reindex failed";
      setReindexResult(msg);
      toast.error(msg);
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
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
          >
            <RefreshCw className={`w-4 h-4 ${reindexing ? "animate-spin" : ""}`} aria-hidden="true" />
            {reindexing ? "Re-indexing…" : "Re-index Ally"}
          </button>
          <button
            onClick={() => { setModalOpen(true); setUploadError(""); setDocName(""); setFile(null); }}
            className="flex items-center gap-2 bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Ally global on/off switch */}
      <div className="mb-6 flex items-center justify-between gap-4 bg-white rounded-card border border-table-border px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-command-black flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Ally HR Assistant</p>
            <p className="text-gray-500 text-xs mt-0.5 max-w-md">
              {allyEnabled === null
                ? "Checking status…"
                : allyEnabled
                ? "Ally is available to all employees. Turn off to hide the chatbot for everyone."
                : "Ally is turned off. The chatbot is hidden for all employees."}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allyEnabled === true}
          aria-label="Toggle Ally HR Assistant"
          disabled={allyEnabled === null || togglingAlly}
          onClick={handleToggleAlly}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            allyEnabled ? "bg-emerald-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              allyEnabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {reindexResult && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">Re-index result</p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">{reindexResult}</pre>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16 text-gray-500 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-card border border-table-border">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-500 font-medium">No documents uploaded yet</p>
          <p className="text-gray-500 text-sm mt-1">Upload a document to make it available to the chatbot.</p>
        </div>
      ) : (
        <div className="bg-white rounded-card border border-table-border overflow-clip">
          <div className="overflow-auto max-h-[70vh] scroll-hint">
          <table className="w-full border-collapse" aria-label="Policy documents">
            <thead className="sticky top-0 z-10 bg-table-head">
              <tr className="border-b border-table-border">
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Name</th>
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">File</th>
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Size</th>
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Status</th>
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Uploaded</th>
                <th scope="col" className="px-3.5 py-2.5 last:pr-5" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, i) => (
                <tr key={doc.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                  <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
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
                           className="border border-gray-300 rounded px-2 py-1 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy-500/30 w-48"
                        />
                        <button onClick={() => handleRename(doc.id)} className="text-emerald-500 hover:text-emerald-700">
                          <Check className="w-4 h-4" aria-hidden="true" />
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
                           className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-navy-600 transition-opacity"
                          title="Rename"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">{doc.fileName}</td>
                  <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">{formatBytes(doc.fileSize)}</td>
                  <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                    <button
                      onClick={() => handleToggle(doc.id, doc.isActive)}
                       className="flex items-center gap-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 rounded"
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
                  <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                    <span className="block text-gray-500">{doc.uploadedBy.displayName}</span>
                  </td>
                  <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
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
                           className="text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 rounded"
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
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
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

      {!loading && documents.length > 0 && (
        <div className="mt-4">
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}

      {/* Upload modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader className="mb-5">
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Employee Handbook"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>

              {/* MD conversion tip */}
              <div className="bg-navy-50 border border-navy-100 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-navy-700">For best results — convert to Markdown first</p>
                <p className="text-xs text-navy-600 leading-relaxed">
                  Upload a <span className="font-medium">.md file</span> instead of a PDF. Markdown preserves headings, tables, and lists that PDF extraction often mangles, which makes Ally's answers more accurate.
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-navy-500">Use this prompt in <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-navy-700">claude.ai</a> — attach your PDF and send:</p>
                  <div className="bg-white border border-navy-200 rounded-md px-3 py-2 flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-600 leading-relaxed flex-1">{MD_CONVERSION_PROMPT}</p>
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="shrink-0 text-navy-400 hover:text-navy-600 transition-colors mt-0.5"
                      title="Copy prompt"
                    >
                      {promptCopied ? <CheckCheck className="w-4 h-4 text-emerald-500" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
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
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-6 text-center text-sm text-gray-500 hover:border-navy-300 hover:text-navy-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
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
                className="w-full bg-navy-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Uploading…
                  </span>
                ) : "Upload"}
              </button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
