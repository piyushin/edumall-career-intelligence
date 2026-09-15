import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import {
  CreateAssessmentCounsellorNoteDto,
  WithdrawAssessmentReportReleaseDto,
} from "./assessment-report-review.types";

describe("assessment report review DTO validation", () => {
  it("rejects a whitespace-only withdrawal reason", async () => {
    const dto = Object.assign(new WithdrawAssessmentReportReleaseDto(), { reason: "   " });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "reason")).toBe(true);
  });

  it("accepts an ordinary withdrawal reason", async () => {
    const dto = Object.assign(new WithdrawAssessmentReportReleaseDto(), {
      reason: "Duplicate submission, releasing the corrected attempt instead.",
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it("rejects a whitespace-only counsellor note body", async () => {
    const dto = Object.assign(new CreateAssessmentCounsellorNoteDto(), { body: "   " });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "body")).toBe(true);
  });

  it("accepts an ordinary counsellor note body", async () => {
    const dto = Object.assign(new CreateAssessmentCounsellorNoteDto(), {
      body: "Candidate seemed rushed through the final section; consider a re-take.",
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
