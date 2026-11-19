// All data is stored in PostgreSQL through Prisma (see prisma/schema.prisma and src/lib/prisma.ts).
// The other files in src/store/ are the only code that talks to the database.

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
