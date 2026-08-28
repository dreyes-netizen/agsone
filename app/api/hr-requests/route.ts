import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { notifyRole, ADMIN_ROLES } from "@/lib/helpers/notifyRole";
import { composeHrRequest } from "@/lib/email/composeHrRequest";
import {
  HR_CATALOG_VERSION,
  findHrRequestType,
  findHrCategoryForType,
  validateHrRequestFields,
} from "@/lib/constants/hrRequests";

// `verifyAuth` would return an AuthUser that carries neither `employeeId`,
// `position`, nor the department *name* — all three go into the composed email —
// so it would cost a second query for the same row. `verifyToken` skips the DB
// entirely and lets one wide select do the work, the same trade-off documented
// in app/api/me/route.ts.
const REQUESTER_SELECT = {
  id: true,
  isActive: true,
  displayName: true,
  email: true,
  employeeId: true,
  position: true,
  department: { select: { name: true } },
} satisfies Prisma.UserSelect;

const createSchema = z.object({
  // Client-generated so it can be minted synchronously, before the Gmail
  // window opens — see the popup-blocker note in the Email HR page.
  clientRef: z.string().regex(/^HRQ-[A-Z0-9]{8}$/, "Invalid request reference"),
  typeId: z.string().min(1).max(64),
  fields: z.record(z.string().min(1).max(64), z.string().max(2000)),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const uid = await verifyToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requester = await prisma.user.findUnique({
    where: { firebaseUid: uid },
    select: REQUESTER_SELECT,
  });
  // Mirrors the isActive gate in verifyAuth — a deactivated employee's
  // still-valid Firebase token must not be able to file requests.
  if (!requester || !requester.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    // A string, not `flatten()`: apiFetch only surfaces `error` when it is a
    // string and otherwise degrades the toast to "Request failed (400)".
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { clientRef, typeId, fields, notes } = parsed.data;

  const type = findHrRequestType(typeId);
  const category = findHrCategoryForType(typeId);
  if (!type || !category) {
    // The realistic cause is a tab left open across a deploy that retired the
    // type, so the message tells the employee what will actually fix it.
    return NextResponse.json(
      { error: "That request type is no longer available — please reload the page." },
      { status: 400 },
    );
  }

  const validated = validateHrRequestFields(type, fields);
  if (!validated.ok) {
    const firstMessage = Object.values(validated.errors)[0] ?? "Please check the form";
    return NextResponse.json(
      { error: firstMessage, fieldErrors: validated.errors },
      { status: 400 },
    );
  }

  // Subject and body are re-composed here rather than accepted from the client.
  // Two payoffs: a doctored body can't be stored as if the employee wrote it,
  // and the row can never drift from the catalog the server is running.
  const { subject, body } = composeHrRequest({
    profile: {
      displayName: requester.displayName,
      email: requester.email,
      employeeId: requester.employeeId,
      position: requester.position,
      departmentName: requester.department?.name ?? null,
    },
    category,
    type,
    values: validated.cleaned,
    notes,
    ref: clientRef,
  });

  try {
    const created = await prisma.hrRequest.create({
      data: {
        userId: requester.id,
        clientRef,
        categoryId: category.id,
        typeId: type.id,
        tag: type.tag,
        subject,
        body,
        fields: validated.cleaned,
        notes: notes?.trim() || null,
        catalogVersion: HR_CATALOG_VERSION,
      },
      select: { id: true, clientRef: true, typeId: true, status: true, createdAt: true },
    });

    notifyRole([...ADMIN_ROLES], {
      type: "HR_REQUEST_SUBMITTED",
      title: "HR request waiting",
      // Subject only. `fields` and `body` can carry SSS/TIN numbers, and a push
      // notification renders on a lock screen.
      body: `${requester.displayName} submitted: ${type.label}.`,
      data: { hrRequestId: created.id },
    }).catch((err) => console.error("hr request admin notification failed", err));

    scheduleBroadcast([
      { topic: realtimeTopics.hrRequests },
      { topic: realtimeTopics.hrRequestsUser(requester.id) },
    ]);

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    // A double-click or a client retry reuses the same clientRef. Returning the
    // existing row keeps the write idempotent instead of filing a duplicate.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.hrRequest.findUnique({
        where: { clientRef },
        select: { id: true, clientRef: true, typeId: true, status: true, createdAt: true },
      });
      if (existing) return NextResponse.json({ data: existing });
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  const uid = await verifyToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requester = await prisma.user.findUnique({
    where: { firebaseUid: uid },
    select: { id: true, isActive: true },
  });
  if (!requester || !requester.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams, { limit: 10 });

  const [rows, total] = await Promise.all([
    prisma.hrRequest.findMany({
      where: { userId: requester.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      // Deliberately omits `body` — the employee already has it in their Gmail,
      // and it is the field most likely to hold government ID numbers.
      select: {
        id: true,
        clientRef: true,
        categoryId: true,
        typeId: true,
        tag: true,
        subject: true,
        status: true,
        createdAt: true,
        handledAt: true,
        adminNote: true,
      },
    }),
    prisma.hrRequest.count({ where: { userId: requester.id } }),
  ]);

  return NextResponse.json({
    ...paginatedResponse(rows, total, page, limit),
    realtimeTopic: realtimeTopics.hrRequestsUser(requester.id),
  });
}
