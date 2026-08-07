import type { INestApplication } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { loadConfig, StructuredLogger, type AppConfig } from "@edumall/config";
import { AuthenticationError, AuthenticationErrorCode } from "@edumall/database";
import { MembershipRole, UserStatus } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureApi } from "../bootstrap";
import { APP_CONFIG } from "../config/app-config.token";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CsrfGuard } from "./csrf.guard";
import { CsrfService } from "./csrf.service";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const expiresAt = new Date("2030-01-01T00:00:00.000Z");
const authContext = {
  membershipId,
  organizationId,
  role: MembershipRole.ORGANIZATION_ADMIN,
  sessionId,
  userId,
};
const safeUser = {
  email: "user@example.com",
  status: UserStatus.ACTIVE,
  userId,
};

function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig(
    {
      APP_ENV: "test",
      APP_VERSION: "test",
      AUTH_COOKIE_SECURE: "true",
      AUTH_CSRF_SECRET: "test-csrf-secret-with-at-least-32-characters",
      AUTH_LOGIN_RATE_LIMIT: "100",
      CORS_ALLOWED_ORIGINS: "http://localhost:3000",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      NODE_ENV: "test",
      REDIS_URL: "redis://localhost:6379",
      ...overrides,
    },
    { serviceName: "api" },
  );
}

function createAuthService() {
  return {
    acceptInvitation: vi.fn().mockResolvedValue({ userId }),
    confirmPasswordReset: vi.fn().mockResolvedValue({ userId }),
    getCurrentUser: vi.fn().mockResolvedValue(safeUser),
    login: vi.fn().mockResolvedValue({
      context: authContext,
      expiresAt,
      rawToken: "raw-session-token",
      user: safeUser,
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    validateSession: vi.fn().mockResolvedValue(authContext),
  };
}

async function createApp(config: AppConfig, authService: ReturnType<typeof createAuthService>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    imports: [
      ThrottlerModule.forRoot([
        {
          limit: config.authLoginRateLimit,
          ttl: config.authLoginRateWindowSeconds * 1000,
        },
      ]),
    ],
    providers: [
      { provide: APP_CONFIG, useValue: config },
      { provide: AuthService, useValue: authService },
      AuthGuard,
      CsrfGuard,
      CsrfService,
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApi(app, config, new StructuredLogger(config));
  await app.init();
  return app;
}

describe("authentication HTTP API", () => {
  let app: INestApplication;
  let authService: ReturnType<typeof createAuthService>;

  beforeEach(async () => {
    authService = createAuthService();
    app = await createApp(testConfig(), authService);
  });

  afterEach(async () => {
    await app.close();
  });

  it("sets a secure HTTP-only session cookie and never returns the raw token", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "USER@example.com",
        organizationId,
        password: "password",
      })
      .expect(200);

    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies[0]).toContain("edumall_session=raw-session-token");
    expect(cookies[0]).toContain("Path=/");
    expect(cookies[0]).toContain("Expires=Tue, 01 Jan 2030 00:00:00 GMT");
    expect(cookies[0]).toContain("HttpOnly");
    expect(cookies[0]).toContain("Secure");
    expect(cookies[0]).toContain("SameSite=Lax");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.stringify(response.body)).not.toContain("raw-session-token");
    expect(response.body).toMatchObject({
      session: {
        membershipId,
        organizationId,
        role: MembershipRole.ORGANIZATION_ADMIN,
        userId,
      },
      user: safeUser,
    });
  });

  it("returns the current validated session and user without a token", async () => {
    const response = await request(app.getHttpServer())
      .get("/auth/session")
      .set("Cookie", "edumall_session=raw-session-token")
      .expect(200);

    expect(authService.validateSession).toHaveBeenCalledWith("raw-session-token");
    expect(response.body).toMatchObject({
      session: {
        membershipId,
        organizationId,
        role: MembershipRole.ORGANIZATION_ADMIN,
        userId,
      },
      user: safeUser,
    });
    expect(JSON.stringify(response.body)).not.toContain("raw-session-token");
  });

  it.each([AuthenticationErrorCode.INVALID_SESSION, AuthenticationErrorCode.EXPIRED_SESSION])(
    "rejects an %s session with the same safe response",
    async (code) => {
      authService.validateSession.mockRejectedValueOnce(new AuthenticationError(code));

      const response = await request(app.getHttpServer())
        .get("/auth/session")
        .set("Cookie", "edumall_session=invalid")
        .expect(401);

      expect(response.body.error).toMatchObject({
        code: "INVALID_SESSION",
        message: "Authentication session is invalid.",
      });
    },
  );

  it("requires a valid signed CSRF token for logout, revokes the session, and clears cookies", async () => {
    const csrfResponse = await request(app.getHttpServer()).get("/auth/csrf").expect(200);
    const csrfCookie = (csrfResponse.headers["set-cookie"] as unknown as string[])[0]!.split(
      ";",
    )[0]!;
    const csrfToken = csrfResponse.body.csrfToken as string;
    const response = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", `edumall_session=raw-session-token; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken)
      .expect(204);

    expect(authService.logout).toHaveBeenCalledWith(authContext);
    const clearedCookies = response.headers["set-cookie"] as unknown as string[];
    expect(clearedCookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining("edumall_session=;"),
        expect.stringContaining("edumall_csrf=;"),
      ]),
    );
  });

  it.each([
    ["missing", undefined],
    ["invalid", "not-the-issued-token"],
  ])("rejects %s CSRF validation", async (_case, suppliedToken) => {
    const csrfResponse = await request(app.getHttpServer()).get("/auth/csrf").expect(200);
    const csrfCookie = (csrfResponse.headers["set-cookie"] as unknown as string[])[0]!.split(
      ";",
    )[0]!;
    let logoutRequest = request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", `edumall_session=raw-session-token; ${csrfCookie}`);

    if (suppliedToken) {
      logoutRequest = logoutRequest.set("x-csrf-token", suppliedToken);
    }

    const response = await logoutRequest.expect(403);
    expect(response.body.error.code).toBe("CSRF_REQUIRED");
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it("accepts an invitation through the credential lifecycle service", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/invitations/accept")
      .send({ password: "long-enough-password", token: "invitation-token" })
      .expect(200);

    expect(response.body).toEqual({ status: "accepted" });
    expect(authService.acceptInvitation).toHaveBeenCalledWith(
      "invitation-token",
      "long-enough-password",
      expect.any(String),
    );
  });

  it("returns a safe service error when session storage is unavailable", async () => {
    authService.validateSession.mockRejectedValueOnce(
      new AuthenticationError(AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR),
    );

    const response = await request(app.getHttpServer())
      .get("/auth/session")
      .set("Cookie", "edumall_session=raw-session-token")
      .expect(503);

    expect(response.body.error).toMatchObject({
      code: "AUTHENTICATION_UNAVAILABLE",
      message: "Authentication is temporarily unavailable.",
    });
  });

  it("confirms a password reset through the credential lifecycle service", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/password-reset/confirm")
      .send({ password: "long-enough-password", token: "reset-token" })
      .expect(200);

    expect(response.body).toEqual({ status: "confirmed" });
    expect(authService.confirmPasswordReset).toHaveBeenCalledWith(
      "reset-token",
      "long-enough-password",
      expect.any(String),
    );
  });
});

describe("login throttling", () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp(testConfig({ AUTH_LOGIN_RATE_LIMIT: "2" }), createAuthService());
  });

  afterEach(async () => {
    await app.close();
  });

  it("enforces the configured login rate limit through NestJS", async () => {
    const body = { email: "user@example.com", password: "password" };
    await request(app.getHttpServer()).post("/auth/login").send(body).expect(200);
    await request(app.getHttpServer()).post("/auth/login").send(body).expect(200);

    const response = await request(app.getHttpServer()).post("/auth/login").send(body).expect(429);
    expect(response.body.error.statusCode).toBe(429);
  });
});
