export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

interface CsrfResponse {
  csrfToken: string;
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

async function parseError(response: Response): Promise<ApiErrorBody | undefined> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return undefined;
  }
}

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ApiError(502, {
      code: "CSRF_TOKEN_UNAVAILABLE",
      message: "Request protection could not be established.",
    });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("csrfToken" in body) ||
    typeof (body as CsrfResponse).csrfToken !== "string" ||
    !(body as CsrfResponse).csrfToken.trim()
  ) {
    throw new ApiError(502, {
      code: "CSRF_TOKEN_UNAVAILABLE",
      message: "Request protection could not be established.",
    });
  }

  return (body as CsrfResponse).csrfToken;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const method = (init.method ?? "GET").toUpperCase();

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-csrf-token", await fetchCsrfToken());
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
