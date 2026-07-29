import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const [departments, total] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    }),
    prisma.department.count(),
  ]);

  const data = departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    createdAt: d.createdAt,
    employeeCount: d._count.users,
  }));

  return NextResponse.json(paginatedResponse(data, total, page, limit));
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.department.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Department name already exists" },
      { status: 400 }
    );
  }

  const department = await prisma.department.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: department }, { status: 201 });
}
