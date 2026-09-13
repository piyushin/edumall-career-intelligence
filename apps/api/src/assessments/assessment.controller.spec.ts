import type { INestApplication } from "@nestjs/common";
import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadConfig, StructuredLogger, type AppConfig } from "@edumall/config";
import { MembershipRole } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureApi } from "../bootstrap";
import { APP_CONFIG } from "../config/app-config.token";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { CsrfGuard } from "../auth/csrf.guard";
import { CsrfService } from "../auth/csrf.service";
import { RolesGuard } from "../auth/roles.guard";
import { AssessmentReportPdfService } from "./assessment-report-pdf.service";
import { AssessmentReportViewService } from "./assessment-report-view.service";
import { AssessmentController } from "./assessment.controller";
import { AssessmentService } from "./assessment.service";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const attemptId = "55555555-5555-4555-8555-555555555555";

const authContext = {
  membershipId,
  organizationId,
  role: MembershipRole.STUDENT,
  sessionId,
  userId,
};

const pdfSource = {
  releasedAt: new Date("2026-01-02T00:00:00Z"),
  candidateName: "Asha Patel",
  organizationName: "Gandhinagar Model School",
  assessment: {
    title: "Career Aptitude Assessment",
    edition: "2026",
    form: "A",
    language: "en",
  },
  results: [
    {
      constructCode: "logic",
      constructName: "Logic",
      outputData: { band: "Strong" },
    },
  ],
};

function testConfig(): AppConfig {
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
    },
    { serviceName: "api" },
  );
}

function createAuthService() {
  return {
    validateSession: vi.fn().mockResolvedValue(authContext),
  };
}

function createAssessmentReportViewService() {
  return {
    getMyReport: vi.fn(),
    getReleasedReportForPdf: vi.fn().mockResolvedValue(pdfSource),
  };
}

async function createApp(
  config: AppConfig,
  authService: ReturnType<typeof createAuthService>,
  reportView: ReturnType<typeof createAssessmentReportViewService>,
) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AssessmentController],
    providers: [
      { provide: APP_CONFIG, useValue: config },
      { provide: AuthService, useValue: authService },
      { provide: AssessmentService, useValue: {} },
      { provide: AssessmentReportViewService, useValue: reportView },
      AssessmentReportPdfService,
      AuthGuard,
      RolesGuard,
      CsrfGuard,
      CsrfService,
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApi(app, config, new StructuredLogger(config));
  await app.init();
  return app;
}

describe("assessment report PDF", () => {
  let app: INestApplication;
  let authService: ReturnType<typeof createAuthService>;
  let reportView: ReturnType<typeof createAssessmentReportViewService>;

  beforeEach(async () => {
    authService = createAuthService();
    reportView = createAssessmentReportViewService();
    app = await createApp(testConfig(), authService, reportView);
  });

  afterEach(async () => {
    await app.close();
  });

  it("streams a real PDF once the report is released", async () => {
    const response = await request(app.getHttpServer())
      .get(`/assessments/attempts/${attemptId}/report/pdf`)
      .set("Cookie", "edumall_session=raw-session-token")
      .expect(200);

    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["cache-control"]).toBe("no-store");

    const body = response.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    expect(reportView.getReleasedReportForPdf).toHaveBeenCalledWith(authContext, attemptId);
  });

  it("returns 409 when the report has not been released", async () => {
    reportView.getReleasedReportForPdf.mockRejectedValueOnce(
      new ConflictException({
        code: "ASSESSMENT_REPORT_NOT_RELEASED",
        message: "This report has not been released yet.",
      }),
    );

    await request(app.getHttpServer())
      .get(`/assessments/attempts/${attemptId}/report/pdf`)
      .set("Cookie", "edumall_session=raw-session-token")
      .expect(409);
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer())
      .get(`/assessments/attempts/${attemptId}/report/pdf`)
      .expect(401);
  });

  it("rejects a role that is not a candidate", async () => {
    authService.validateSession.mockResolvedValueOnce({
      ...authContext,
      role: MembershipRole.COUNSELLOR,
    });

    await request(app.getHttpServer())
      .get(`/assessments/attempts/${attemptId}/report/pdf`)
      .set("Cookie", "edumall_session=raw-session-token")
      .expect(403);
  });
});
