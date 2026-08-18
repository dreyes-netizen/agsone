"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { DOCUMENT_CATEGORY_LABEL, DOCUMENT_CATEGORY_BADGE } from "@/lib/constants/documentCategories";

type HrDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  version: string | null;
  fileUrl: string;
  fileName: string;
  createdAt: string;
};

function isPdf(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf");
}

export default function DocumentsPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<HrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<HrDocument | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{ data: HrDocument[] }>("/api/hr-documents");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 text-sm mt-1">Company handbook, policies, and memos.</p>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-12 bg-white rounded-card border border-table-border">
          <FileText className="w-8 h-8 text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500">No documents published yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-card border border-table-border p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <FileText className="w-8 h-8 text-navy-500 shrink-0" aria-hidden="true" />
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${DOCUMENT_CATEGORY_BADGE[doc.category] ?? "bg-gray-100 text-gray-700"}`}>
                  {DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 leading-tight">{doc.title}</h2>
                {doc.version && <p className="text-xs text-gray-400 mt-0.5">Version {doc.version}</p>}
              </div>
              {doc.description && <p className="text-sm text-gray-600 flex-1">{doc.description}</p>}
              <button
                onClick={() => setViewing(doc)}
                className="mt-auto inline-flex items-center justify-center gap-1.5 bg-command-black text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                {isPdf(doc.fileName) ? "View Document" : "Download"}
              </button>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-card w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 truncate">{viewing.title}</h2>
              <div className="flex items-center gap-3">
                <a href={viewing.fileUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-800" title="Open in new tab">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a href={viewing.fileUrl} download={viewing.fileName} className="text-gray-500 hover:text-gray-800" title="Download">
                  <Download className="w-4 h-4" />
                </a>
                <button onClick={() => setViewing(null)} className="text-gray-500 hover:text-gray-800" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100">
              {isPdf(viewing.fileName) ? (
                <iframe src={viewing.fileUrl} title={viewing.title} className="w-full h-full border-0" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 text-sm p-8 text-center">
                  <FileText className="w-10 h-10 text-gray-300" />
                  <p>Preview isn&apos;t available for this file type.</p>
                  <a
                    href={viewing.fileUrl}
                    download={viewing.fileName}
                    className="inline-flex items-center gap-1.5 bg-command-black text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800"
                  >
                    <Download className="w-4 h-4" /> Download {viewing.fileName}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
