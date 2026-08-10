export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  public constructor(status: number, body?: ApiErrorBody) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    if (body?.code !== undefined) {
      this.code = body.code;
    }
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));

  return value ? decodeURIComponent(value.slice(prefix.length)) : undefined;
}

async function parseError(response: Response): Promise<ApiErrorBody | undefined> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return undefined;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const method = (init.method ?? "GET").toUpperCase();

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    let csrfCookie = readCookie("edumall_csrf");

    if (!csrfCookie) {
      const csrfResponse = await fetch(`${API_BASE_URL}/auth/csrf`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!csrfResponse.ok) {
        throw new ApiError(csrfResponse.status, await parseError(csrfResponse));
      }

      csrfCookie = readCookie("edumall_csrf");
    }

    if (!csrfCookie) {
      throw new Error("CSRF token could not be established.");
    }

    const token = csrfCookie.split(".")[0];

    if (!token) {
      throw new Error("CSRF token cookie is malformed.");
    }

    headers.set("x-csrf-token", token);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
