# AGS Assistant — AI Policy Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI chat assistant at `/assistant` that answers employee questions about uploaded policy documents using Google Gemini 1.5 Flash, with an admin panel at `/admin/documents` for HR to upload and manage PDFs stored in Supabase Storage.

**Architecture:** PDFs are stored in a private Supabase Storage bucket (`policy-docs`). On every chat query, the server downloads all active PDFs, encodes them as base64, and sends them inline to Gemini 1.5 Flash with the full multi-turn conversation history. The system prompt restricts Gemini to only answer from the documents.

**Tech Stack:** `@google/generative-ai`, `@supabase/supabase-js` (already installed), Prisma ORM, Next.js App Router, Tailwind CSS, `zod`, `useApiClient` hook.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `PolicyDocument` model |
| `lib/supabase/storageClient.ts` | Create | Supabase service-role client + PDF upload/download/delete helpers |
| `lib/gemini/client.ts` | Create | Gemini client + `generateChatReply()` function |
| `app/api/admin/documents/route.ts` | Create | GET (list) + POST (upload) documents |
| `app/api/admin/documents/[id]/route.ts` | Create | DELETE + PATCH (toggle active) |
| `app/api/assistant/chat/route.ts` | Create | POST chat endpoint |
| `app/admin/documents/page.tsx` | Create | HR Admin document management UI |
| `app/(dashboard)/assistant/page.tsx` | Create | Employee chat UI |
| `app/(dashboard)/layout.tsx` | Modify | Add "Assistant" to sidebar nav |
| `app/admin/layout.tsx` | Modify | Add "Documents" to admin sidebar nav |

---

## Task 1: Install Gemini SDK

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the package**

```bash
npm install @google/generative-ai
```

Expected output: `added 1 package` (or similar — no errors)

- [ ] **Step 2: Verify it's installed**

```bash
node -e "require('@google/generative-ai'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @google/generative-ai"
```

---

## Task 2: Add PolicyDocument to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model to the schema**

Open `prisma/schema.prisma`. Add the following AFTER the `Challenge` model (end of file):

```prisma
model PolicyDocument {
  id           String   @id @default(uuid())
  name         String
  storagePath  String
  fileName     String
  fileSize     Int
  isActive     Boolean  @default(true)
  uploadedAt   DateTime @default(now())
  uploadedById String

  uploadedBy User @relation(fields: [uploadedById], references: [id])
}
```

Also add this relation to the `User` model, inside its body after `challengesCreated Challenge[]`:

```prisma
  policyDocuments PolicyDocument[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_policy_document
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify the generated client has the new model**

```bash
node -e "const { PrismaClient } = require('./lib/generated/prisma'); const p = new PrismaClient(); console.log(typeof p.policyDocument); p.\$disconnect()"
```

Expected: `object`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add PolicyDocument model to schema"
```

---

## Task 3: Supabase Storage Helper

**Files:**
- Create: `lib/supabase/storageClient.ts`

The Supabase Storage bucket `policy-docs` must exist. Before writing code, create it:
1. Go to your Supabase dashboard → Storage
2. Click "New bucket" → name it `policy-docs` → set to **Private** → Save

- [ ] **Step 1: Create the storage helper**

Create `lib/supabase/storageClient.ts` with this exact content:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "policy-docs";

export async function uploadPdf(
  storagePath: string,
  buffer: Buffer,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function downloadPdf(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deletePdf(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/storageClient.ts
git commit -m "feat: add Supabase Storage helpers for policy PDFs"
```

---

## Task 4: Gemini Client

**Files:**
- Create: `lib/gemini/client.ts`

- [ ] **Step 1: Create the Gemini client**

Create `lib/gemini/client.ts`:

```typescript
import { GoogleGenerativeAI, Content } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are an HR assistant for Alliance Global Solutions. 
Answer questions strictly based on the provided company documents. 
If a question cannot be answered from the documents, respond with: 
"I don't have that information in the provided documents. Please contact HR directly." 
Do not make assumptions or answer questions outside the scope of the documents.`;

export async function generateChatReply(
  message: string,
  history: Content[],
  pdfBuffers: Buffer[],
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const inlinePdfs = pdfBuffers.map((buf) => ({
    inlineData: {
      mimeType: "application/pdf" as const,
      data: buf.toString("base64"),
    },
  }));

  const chat = model.startChat({ history });

  const result = await chat.sendMessage([
    ...inlinePdfs,
    { text: message },
  ]);

  return result.response.text();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add lib/gemini/client.ts
git commit -m "feat: add Gemini client for policy chat"
```

---

## Task 5: Admin Documents API — List + Upload

**Files:**
- Create: `app/api/admin/documents/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/documents/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { uploadPdf } from "@/lib/supabase/storageClient";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.policyDocument.findMany({
    orderBy: { uploadedAt: "desc" },
    include: { uploadedBy: { select: { displayName: true } } },
  });

  return NextResponse.json({ data: documents });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;

  if (!file || !name?.trim()) {
    return NextResponse.json({ error: "file and name are required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  }
  const TEN_MB = 10 * 1024 * 1024;
  if (file.size > TEN_MB) {
    return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storagePath = `${randomUUID()}-${file.name.replace(/\s+/g, "_")}`;

  await uploadPdf(storagePath, buffer);

  const doc = await prisma.policyDocument.create({
    data: {
      name: name.trim(),
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      uploadedById: user!.id,
    },
    include: { uploadedBy: { select: { displayName: true } } },
  });

  return NextResponse.json({ data: doc }, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/documents/route.ts
git commit -m "feat: admin documents API — list and upload endpoints"
```

---

## Task 6: Admin Documents API — Delete + Toggle

**Files:**
- Create: `app/api/admin/documents/[id]/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/documents/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { deletePdf } from "@/lib/supabase/storageClient";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await prisma.policyDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deletePdf(doc.storagePath);
  await prisma.policyDocument.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) is required" }, { status: 400 });
  }

  const doc = await prisma.policyDocument.update({
    where: { id },
    data: { isActive: body.isActive },
  });

  return NextResponse.json({ data: doc });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/documents/[id]/route.ts"
git commit -m "feat: admin documents API — delete and toggle endpoints"
```

---

## Task 7: Chat API Route

**Files:**
- Create: `app/api/assistant/chat/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/assistant/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { downloadPdf } from "@/lib/supabase/storageClient";
import { generateChatReply } from "@/lib/gemini/client";
import { z } from "zod";
import { Content } from "@google/generative-ai";

const historySchema = z.array(
  z.object({
    role: z.enum(["user", "model"]),
    parts: z.array(z.object({ text: z.string() })),
  }),
);

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: historySchema,
});

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { message, history } = parsed.data;

  const documents = await prisma.policyDocument.findMany({
    where: { isActive: true },
    select: { storagePath: true },
  });

  if (documents.length === 0) {
    return NextResponse.json({
      reply: "No policy documents have been uploaded yet. Please contact HR directly.",
    });
  }

  const pdfBuffers = await Promise.all(
    documents.map((doc) => downloadPdf(doc.storagePath)),
  );

  const reply = await generateChatReply(message, history as Content[], pdfBuffers);

  return NextResponse.json({ reply });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add app/api/assistant/chat/route.ts
git commit -m "feat: assistant chat API route with Gemini + Supabase Storage"
```

---

## Task 8: Admin Documents Page

**Files:**
- Create: `app/admin/documents/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/admin/documents/page.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add app/admin/documents/page.tsx
git commit -m "feat: admin documents management page"
```

---

## Task 9: Employee Assistant Chat Page

**Files:**
- Create: `app/(dashboard)/assistant/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/(dashboard)/assistant/page.tsx`:

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Bot, Send, User } from "lucide-react";

type Message = {
  role: "user" | "model";
  parts: [{ text: string }];
};

const SUGGESTED = [
  "What is the leave policy?",
  "What are the working hours?",
  "What is the code of conduct for social media?",
  "How do I report a workplace concern?",
];

export default function AssistantPage() {
  const { apiFetch } = useApiClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", parts: [{ text: trimmed }] };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch<{ reply: string }>("/api/assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          history: messages,
        }),
      });

      const modelMsg: Message = { role: "model", parts: [{ text: res.reply }] };
      setMessages([...newMessages, modelMsg]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setMessages(newMessages.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">AGS Assistant</h1>
            <p className="text-zinc-500 text-sm">Ask me anything about company policies</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="py-8">
            <div className="bg-white border border-zinc-100 rounded-xl p-5 mb-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-zinc-700 text-sm leading-relaxed">
                    Hi! I can answer questions about the <strong>Employee Handbook</strong> and <strong>Code of Conduct</strong>.
                    I only answer based on company documents — for anything else, please reach out to HR directly.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-3">Suggested questions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left text-sm text-zinc-600 bg-white border border-zinc-100 rounded-lg px-4 py-3 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "model" && (
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-white border border-zinc-100 text-zinc-700 rounded-bl-sm shadow-sm"
              }`}
            >
              {msg.parts[0].text}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-zinc-500" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 pt-3 border-t border-zinc-200">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about company policies…"
            rows={1}
            disabled={loading}
            className="flex-1 border border-zinc-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ minHeight: "48px" }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/assistant/page.tsx"
git commit -m "feat: employee assistant chat page"
```

---

## Task 10: Add Nav Links

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add "Assistant" to the dashboard sidebar**

Open `app/(dashboard)/layout.tsx`.

Add `Bot` to the import line at the top:

```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target, UtensilsCrossed, MessageSquare, Sparkles, Swords, Search, Bot,
} from "lucide-react";
```

Then in the `mainNav` array, add the Assistant entry after the Feedback entry:

```typescript
const mainNav = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/games",       label: "Games",       icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/shoutouts",   label: "Shoutouts",   icon: Sparkles },
  { href: "/challenges",  label: "Challenges",  icon: Swords },
  { href: "/profile",     label: "Profile",     icon: User },
  { href: "/feedback",    label: "Feedback",    icon: MessageSquare },
  { href: "/assistant",   label: "Assistant",   icon: Bot },
];
```

- [ ] **Step 2: Add "Documents" to the admin sidebar**

Open `app/admin/layout.tsx`.

Add `FileText` to the import:

```typescript
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Gamepad2, Building2, Target, MessageSquare, Gift, Swords, FileText } from "lucide-react";
```

Add the Documents entry to `navItems` after the Feedback entry:

```typescript
const navItems = [
  { href: "/admin",              label: "Overview",     icon: LayoutDashboard },
  { href: "/admin/employees",    label: "Employees",    icon: Users },
  { href: "/admin/departments",  label: "Departments",  icon: Building2 },
  { href: "/admin/missions",     label: "Missions",     icon: Target },
  { href: "/admin/milestones",   label: "Milestones",   icon: Gift },
  { href: "/admin/challenges",   label: "Challenges",   icon: Swords },
  { href: "/admin/points",       label: "Award Points", icon: Award },
  { href: "/admin/rewards",      label: "Rewards",      icon: ShoppingBag },
  { href: "/admin/redemptions",  label: "Redemptions",  icon: ClipboardList },
  { href: "/admin/games",        label: "Games",        icon: Gamepad2 },
  { href: "/admin/feedback",     label: "Feedback",     icon: MessageSquare },
  { href: "/admin/documents",    label: "Documents",    icon: FileText },
];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/layout.tsx" app/admin/layout.tsx
git commit -m "feat: add Assistant and Documents nav links to sidebars"
```

---

## Task 11: Create Supabase Storage Bucket

This is a one-time manual step — cannot be scripted.

- [ ] **Step 1: Create the bucket**

1. Open your Supabase dashboard at [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (`fqmrnvjjkotusiymrqum`)
3. Go to **Storage** in the left sidebar
4. Click **New bucket**
5. Name: `policy-docs`
6. Toggle: **Private** (not public)
7. Click **Save**

- [ ] **Step 2: Verify the bucket exists**

In Supabase dashboard → Storage, confirm `policy-docs` appears in the bucket list.

- [ ] **Step 3: Test the full flow**

1. Run the dev server: `npm run dev`
2. Log in as HR Admin
3. Go to `/admin/documents`
4. Upload one of your PDF files (Employee Handbook or Code of Conduct)
5. Confirm it appears in the table as Active
6. Go to `/assistant`
7. Ask: "What is the leave policy?"
8. Confirm Gemini returns a grounded answer from the document

---

## Done

All tasks complete. The AGS Assistant is live:
- Employees can chat at `/assistant`
- HR Admins manage documents at `/admin/documents`
- Gemini only answers from uploaded PDFs
- Multi-turn conversation works within each session
