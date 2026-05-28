# AGS Assistant — AI Policy Chatbot Design

**Date:** 2026-05-28
**Author:** D. Reyes

---

## Goal

Build an AI-powered chat assistant that answers employee questions about company policy documents (Employee Handbook, Code of Conduct, and any additional guidelines uploaded by HR). The AI only answers from the uploaded documents — it does not hallucinate or answer off-topic questions.

---

## Architecture

**Approach:** Full document in context (no RAG/embeddings). On every chat query, the server fetches all active policy PDFs from Supabase Storage, encodes them as base64, and sends them inline to Gemini 1.5 Flash alongside the full conversation history. Gemini returns a grounded answer.

**LLM:** Google Gemini 1.5 Flash (free tier, 1M token context window)
**PDF Storage:** Supabase Storage (private bucket — `policy-docs`)
**Document metadata:** PostgreSQL via Prisma (`PolicyDocument` model)
**Auth:** Existing `verifyAuth` + `requireRole` pattern
**Frontend state:** Conversation history kept in React state (not persisted to DB) — cleared on page refresh

---

## Tech Stack

- `@google/generative-ai` npm package
- Supabase JS client (service role key for server-side storage access)
- Prisma ORM (new `PolicyDocument` model)
- Next.js App Router API routes
- React state for multi-turn conversation history

---

## Database

### New Model: `PolicyDocument`

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
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
}
```

Fields:
- `name` — display name shown in admin UI (e.g. "Employee Handbook")
- `storagePath` — path within the Supabase Storage bucket (e.g. `handbooks/handbook-2026.pdf`)
- `fileName` — original uploaded filename
- `fileSize` — bytes, shown in admin UI
- `isActive` — soft delete; inactive documents are excluded from queries

---

## API Routes

### `POST /api/assistant/chat`
- **Auth:** Any authenticated user (EMPLOYEE, MANAGER, HR_ADMIN)
- **Body:** `{ message: string, history: { role: "user" | "model", parts: [{ text: string }] }[] }`
- **Logic:**
  1. Fetch all `PolicyDocument` records where `isActive = true`
  2. For each document, download PDF bytes from Supabase Storage using service role key
  3. Build Gemini request: system prompt + all PDFs inline (base64, `application/pdf`) + conversation history + new message
  4. Call `gemini-1.5-flash` generateContent
  5. Return `{ reply: string }`
- **Error handling:** If no documents are uploaded, return a friendly message. If Gemini fails, return a 500 with a user-facing error.
- **System prompt:**
  > You are an HR assistant for Alliance Global Solutions. Answer questions strictly based on the provided company documents. If a question cannot be answered from the documents, respond with: "I don't have that information in the provided documents. Please contact HR directly." Do not make assumptions or answer questions outside the scope of the documents.

### `GET /api/admin/documents`
- **Auth:** HR_ADMIN only
- **Returns:** Array of `PolicyDocument` records ordered by `uploadedAt` desc

### `POST /api/admin/documents`
- **Auth:** HR_ADMIN only
- **Body:** `multipart/form-data` with `file` (PDF) and `name` (string)
- **Logic:**
  1. Validate file is PDF, max 10MB
  2. Upload to Supabase Storage bucket `policy-docs` at path `{uuid}-{filename}`
  3. Create `PolicyDocument` record in DB
  4. Return created document
- **Validation:** PDF only, max 10MB per file

### `DELETE /api/admin/documents/[id]`
- **Auth:** HR_ADMIN only
- **Logic:**
  1. Find document by ID
  2. Delete file from Supabase Storage
  3. Delete `PolicyDocument` record from DB
  4. Return 204

### `PATCH /api/admin/documents/[id]`
- **Auth:** HR_ADMIN only
- **Body:** `{ isActive: boolean }`
- **Logic:** Toggle document active/inactive without deleting the file

---

## Frontend Pages

### `/assistant` — Employee Chat Page

**Access:** All authenticated users
**Sidebar:** Add "Assistant" link in the employee sidebar

**UI layout:**
- Header: "AGS Assistant" with subtitle "Ask me anything about company policies"
- Chat area: scrollable message thread, user messages on right, AI on left
- AI messages include a small robot avatar
- Empty state: welcome message listing what the assistant can help with, 3–4 suggested questions
- Input: textarea at the bottom with send button, disabled while loading
- Loading state: typing indicator (3 animated dots) while waiting for Gemini
- Conversation history persists in React state for the session (cleared on page refresh)
- Error state: inline error below input if API call fails

**Multi-turn behavior:** Frontend maintains a `history` array in state. Each time the user sends a message, the full history is sent to the API alongside the new message. The API returns a reply which is added to history for the next turn.

### `/admin/documents` — Document Management Page

**Access:** HR_ADMIN only
**Sidebar:** Add "Documents" link under the admin navigation

**UI layout:**
- Header: "Policy Documents" with "Upload Document" button
- Table: columns for Name, File Name, Size, Status (Active/Inactive toggle), Uploaded date, Delete action
- Upload modal: name input + PDF file picker, shows file name and size after selection, upload button
- Delete: confirmation prompt before removing
- Empty state: prompt to upload the first document

---

## Data Flow

```
Employee types question
        ↓
POST /api/assistant/chat { message, history }
        ↓
Server: fetch active PolicyDocuments from DB
        ↓
Server: download each PDF from Supabase Storage (service role)
        ↓
Server: build Gemini request (system prompt + PDFs + history + message)
        ↓
Gemini 1.5 Flash → returns answer
        ↓
Server: return { reply }
        ↓
Frontend: append to history, display reply
```

---

## Security

- Chat endpoint requires authentication — unauthenticated users cannot query
- Document upload/delete is HR_ADMIN only
- PDFs stored in a private Supabase Storage bucket — not publicly accessible via URL
- Server uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never exposed to browser) to access storage
- Gemini API key is server-side only (`GEMINI_API_KEY`, no `NEXT_PUBLIC_` prefix)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| No documents uploaded | API returns friendly message: "No policy documents have been uploaded yet. Please contact HR." |
| Gemini API failure | API returns 500, frontend shows: "Something went wrong. Please try again." |
| File too large (upload) | Frontend validates before upload, shows error |
| Non-PDF uploaded | Frontend validates file type, rejects with error message |
| Question outside documents | Gemini responds per system prompt: "I don't have that information..." |

---

## Out of Scope

- Chat history persistence to database (session-only)
- Per-document Q&A (user cannot choose which document to query)
- Search within documents
- Voice input
- File versioning (uploading a new version replaces the old one manually)
