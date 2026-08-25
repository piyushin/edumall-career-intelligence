import { describe, expect, it } from "vitest";
import {
  boundedLimit,
  decodeCreatedCursor,
  encodeCreatedCursor,
  pageResult,
} from "./platform-admin-pagination";

describe("platform admin cursor pagination", () => {
  const createdAt = new Date("2026-08-25T10:00:00.000Z");
  const id = "11111111-1111-4111-8111-111111111111";

  it("round-trips the deterministic createdAt/id cursor", () => {
    expect(decodeCreatedCursor(encodeCreatedCursor(createdAt, id))).toEqual({ createdAt, id });
  });

  it("rejects malformed cursors and safely bounds limits", () => {
    expect(() => decodeCreatedCursor("not-a-cursor")).toThrow(/Pagination cursor is invalid/);
    expect(boundedLimit("0")).toBe(1);
    expect(boundedLimit("999")).toBe(100);
    expect(boundedLimit("invalid", 25)).toBe(25);
  });

  it("emits a next cursor only when another page exists", () => {
    const second = {
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-08-25T09:00:00.000Z"),
    };
    const page = pageResult([{ id, createdAt }, second], 1);
    expect(page.items).toEqual([{ id, createdAt }]);
    expect(page.pageInfo).toEqual({ hasNext: true, nextCursor: expect.any(String) });
  });
});
