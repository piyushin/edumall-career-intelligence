import { BadRequestException } from "@nestjs/common";

export interface CreatedCursor {
  createdAt: Date;
  id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeCreatedCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString(
    "base64url",
  );
}

export function decodeCreatedCursor(cursor?: string): CreatedCursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    const createdAt = new Date(String(value.createdAt));
    const id = String(value.id);
    if (!Number.isFinite(createdAt.getTime()) || !UUID_PATTERN.test(id)) throw new Error();
    return { createdAt, id };
  } catch {
    throw new BadRequestException({
      code: "INVALID_CURSOR",
      message: "Pagination cursor is invalid.",
    });
  }
}

export function boundedLimit(limit?: string, fallback = 50): number {
  const parsed = Number.parseInt(limit ?? String(fallback), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 100)) : fallback;
}

export function pageResult<T extends { id: string; createdAt: Date }>(rows: T[], limit: number) {
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    pageInfo: {
      hasNext,
      nextCursor: hasNext && last ? encodeCreatedCursor(last.createdAt, last.id) : null,
    },
  };
}
