"use client";

import { useEffect, useState, useRef } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { FileText, Upload, Trash2, ToggleLeft, ToggleRight, X } from "lucide-react";

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
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
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
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await apiFetch(`/api/admin/documents/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
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
            Manage PDFs available to the AGS Assistant chatbot.
          </p>
        </div>
        <button
          onClick={() => { setModalOpen(true); setUploadError(""); setDocName(""); setFile(null); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No documents uploaded yet</p>
          <p className="text-gray-400 text-sm mt-1">Upload a PDF to make it available to the chatbot.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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
                  <td className="px-5 py-3 font-medium text-gray-900">{doc.name}</td>
                  <td className="px-5 py-3 text-gray-500">{doc.fileName}</td>
                  <td className="px-5 py-3 text-gray-500">{formatBytes(doc.fileSize)}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleToggle(doc.id, doc.isActive)}
                      className="flex items-center gap-1.5 text-xs font-medium"
                    >
                      {doc.isActive ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-emerald-500" />
                          <span className="text-emerald-600">Active</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-400">Inactive</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                    <span className="block text-gray-300">{doc.uploadedBy.displayName}</span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleDelete(doc.id, doc.name)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">Upload Document</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-6 text-center text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                >
                  {file ? (
                    <span className="text-gray-700 font-medium">{file.name} ({formatBytes(file.size)})</span>
                  ) : (
                    <>Click to select PDF (max 10MB)</>
                  )}
                </button>
              </div>

              {uploadError && (
                <p className="text-red-500 text-sm">{uploadError}</p>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !file || !docName.trim()}
                className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
