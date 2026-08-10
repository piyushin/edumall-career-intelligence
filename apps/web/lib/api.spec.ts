import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, ApiError, apiRequest } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("web API client", () => {
  it("performs safe GET requests with credentials without fetching a CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    await expect(apiRequest<{ ok: boolean }>("/example")).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/example`,
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
      }),
    );
  });

  it("uses the CSRF endpoint response token for mutating requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-test-token" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ created: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      );

    await expect(
      apiRequest<{ created: boolean }>("/admin/example", {
        method: "POST",
        body: JSON.stringify({ value: "test" }),
      }),
    ).resolves.toEqual({
      created: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_BASE_URL}/auth/csrf`);

    const mutationInit = fetchMock.mock.calls[1]?.[1];

    expect(mutationInit).toBeDefined();

    const mutationHeaders = new Headers(mutationInit?.headers);

    expect(mutationHeaders.get("x-csrf-token")).toBe("csrf-test-token");
    expect(mutationHeaders.get("content-type")).toBe("application/json");
    expect(mutationInit?.credentials).toBe("include");
  });

  it("maps structured API failures into ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "ASSESSMENT_CONFLICT",
          message: "Assessment conflict.",
        }),
        {
          status: 409,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    try {
      await apiRequest("/example");
      throw new Error("Expected request to fail.");
    } catch (caught) {
      expect(caught).toBeInstanceOf(ApiError);

      const error = caught as ApiError;

      expect(error.status).toBe(409);
      expect(error.code).toBe("ASSESSMENT_CONFLICT");
      expect(error.message).toBe("Assessment conflict.");
    }
  });
});
