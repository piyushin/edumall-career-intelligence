import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "./api";
import { platformAdminApi } from "./platform-admin";

afterEach(() => vi.restoreAllMocks());

describe("Control Centre API integration", () => {
  it("normalizes bounded directory filters through URLSearchParams", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [], pageInfo: { hasNext: false, nextCursor: null } }),
          { status: 200 },
        ),
      );
    await platformAdminApi.users({
      search: "asha+patel@example.com",
      organizationId: "tenant id",
      limit: "50",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_BASE_URL}/admin/platform/users?search=asha%2Bpatel%40example.com&organizationId=tenant+id&limit=50`,
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      cache: "no-store",
    });
  });

  it("uses the shared CSRF-protected client for privileged mutations", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "admin-id" }), { status: 201 }));
    await platformAdminApi.adminAction("admin-id", "suspend");
    const mutation = fetchMock.mock.calls[1];
    expect(mutation?.[0]).toBe(`${API_BASE_URL}/admin/platform/admins/admin-id/suspend`);
    expect(new Headers(mutation?.[1]?.headers).get("x-csrf-token")).toBe("csrf-token");
  });
});
