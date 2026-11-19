import prisma from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import type { SparePart, StockChangeType, StockMovement } from "../types.js";

// The maintenance store room: spare parts and every time stock went in or out.

type PartRow = { id: string; name: string; category: string | null; unit: string; quantity: number; minQuantity: number; location: string | null };

const toPart = (row: PartRow): SparePart => ({
  id: row.id,
  name: row.name,
  category: row.category ?? "",
  unit: row.unit,
  quantity: row.quantity,
  minQuantity: row.minQuantity,
  location: row.location ?? "",
  low: row.quantity <= row.minQuantity,
});

const TYPE_FROM_DB = { ADDED: "added", TAKEN: "taken", RESTOCKED: "restocked" } as const satisfies Record<string, StockChangeType>;

const movementInclude = {
  part: { select: { name: true, unit: true } },
  user: { select: { fullName: true } },
  issue: { select: { reference: true } },
} as const;

type MovementRow = {
  id: string;
  partId: string;
  type: keyof typeof TYPE_FROM_DB;
  change: number;
  balance: number;
  issueId: string | null;
  note: string | null;
  createdAt: Date;
  part: { name: string; unit: string };
  user: { fullName: string } | null;
  issue: { reference: string } | null;
};

const toMovement = (row: MovementRow): StockMovement => ({
  id: row.id,
  partId: row.partId,
  // A removed part keeps a "#removed-<time>" tag on its name (see removePart); show the real name.
  partName: row.part.name.replace(/#removed-\d+$/, " (removed)"),
  unit: row.part.unit,
  type: TYPE_FROM_DB[row.type],
  change: row.change,
  balance: row.balance,
  by: row.user?.fullName ?? null,
  issueId: row.issueId,
  issueRef: row.issue?.reference ?? null,
  note: row.note ?? "",
  at: row.createdAt.toISOString(),
});

export async function listParts(): Promise<SparePart[]> {
  const rows = await prisma.sparePart.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return rows.map(toPart);
}

export async function getPart(id: string): Promise<SparePart | undefined> {
  const row = await prisma.sparePart.findFirst({ where: { id, isActive: true } });
  return row ? toPart(row) : undefined;
}

export async function findPartByName(name: string): Promise<SparePart | undefined> {
  const row = await prisma.sparePart.findFirst({ where: { name: { equals: name, mode: "insensitive" }, isActive: true } });
  return row ? toPart(row) : undefined;
}

// Newest first. With a userId, only that person's changes (what a technician sees).
export async function listMovements(options: { userId?: string; limit: number }): Promise<StockMovement[]> {
  const rows = await prisma.stockMovement.findMany({
    where: options.userId ? { userId: options.userId } : {},
    orderBy: { createdAt: "desc" },
    take: options.limit,
    include: movementInclude,
  });
  return rows.map(toMovement);
}

export interface PartDetails {
  name: string;
  category: string;
  unit: string;
  minQuantity: number;
  location: string;
}

// A new part, with its starting stock recorded as the first movement.
export async function insertPart(details: PartDetails, quantity: number, userId: string): Promise<SparePart> {
  const row = await prisma.sparePart.create({
    data: {
      ...details,
      category: details.category || null,
      location: details.location || null,
      quantity,
      movements: { create: { type: "ADDED", userId, change: quantity, balance: quantity, note: "Added to the store" } },
    },
  });
  return toPart(row);
}

export async function updatePart(id: string, changes: Partial<PartDetails>): Promise<SparePart> {
  // An empty category or location is stored as "none".
  const row = await prisma.sparePart.update({
    where: { id },
    data: {
      ...changes,
      ...(changes.category !== undefined ? { category: changes.category || null } : {}),
      ...(changes.location !== undefined ? { location: changes.location || null } : {}),
    },
  });
  return toPart(row);
}

// Its history stays in the log, so it is switched off rather than deleted.
// The name is freed so a new part can use it later.
export async function removePart(id: string): Promise<void> {
  const row = await prisma.sparePart.findUnique({ where: { id } });
  if (!row) return;
  await prisma.sparePart.update({ where: { id }, data: { isActive: false, name: `${row.name}#removed-${Date.now()}` } });
}

// Takes stock out for a job. The quantity check and the update are one statement, so two people
// taking the last plate at the same moment can't both get it. Returns the stock before and after.
export async function takeStock(
  partId: string,
  quantity: number,
  userId: string,
  issueId: string | null,
  note: string,
): Promise<{ part: SparePart; before: number }> {
  return prisma.$transaction(async (tx) => {
    const taken = await tx.sparePart.updateMany({
      where: { id: partId, isActive: true, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    const row = await tx.sparePart.findUniqueOrThrow({ where: { id: partId } });
    if (taken.count === 0) {
      throw new HttpError(409, row.quantity === 0 ? `${row.name} is out of stock` : `Only ${row.quantity} ${row.unit} of ${row.name} left`);
    }
    await tx.stockMovement.create({
      data: { partId, userId, issueId, type: "TAKEN", change: -quantity, balance: row.quantity, note: note || null },
    });
    return { part: toPart(row), before: row.quantity + quantity };
  });
}

// The staff manager puts more stock in the store.
export async function restock(partId: string, quantity: number, userId: string, note: string): Promise<SparePart> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.sparePart.update({ where: { id: partId }, data: { quantity: { increment: quantity } } });
    await tx.stockMovement.create({
      data: { partId, userId, type: "RESTOCKED", change: quantity, balance: row.quantity, note: note || null },
    });
    return toPart(row);
  });
}
