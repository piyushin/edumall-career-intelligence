import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import {
  CreateAssessmentConstructDto,
  CreateAssessmentItemDto,
  CreateAssessmentItemOptionDto,
  UpdateAssessmentVersionDto,
} from "./assessment-admin.types";
import { AssessmentItemType } from "@prisma/client";

describe("assessment administration DTO validation", () => {
  it("rejects whitespace-only draft version titles", async () => {
    const dto = Object.assign(new UpdateAssessmentVersionDto(), {
      title: "   ",
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "title")).toBe(true);
  });

  it("accepts an ordinary draft version title", async () => {
    // Regression test: the non-whitespace check was written as a doubly-escaped
    // /\\S/ (matching a literal backslash followed by "S"), not /\S/ (matching any
    // non-whitespace character). That rejected every ordinary value -- an update
    // like { title: "Career Interest Inventory" } would fail validation and this
    // DTO's every text field was, in effect, impossible to set through the real
    // HTTP API. The bug was invisible to service-level tests because they call
    // AssessmentAdminService methods directly, bypassing class-validator entirely.
    const dto = Object.assign(new UpdateAssessmentVersionDto(), {
      title: "Career Interest Inventory",
      edition: "Second Edition",
      form: "A",
      language: "en",
      scoringVersion: "v1",
      normVersion: "v1",
      reportVersion: "v1",
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects whitespace-only construct and item codes", async () => {
    const construct = Object.assign(new CreateAssessmentConstructDto(), {
      code: "   ",
      name: "Construct",
      orderIndex: 0,
    });
    const item = Object.assign(new CreateAssessmentItemDto(), {
      code: "   ",
      type: AssessmentItemType.SINGLE_CHOICE,
      prompt: "Question",
      orderIndex: 0,
    });

    expect((await validate(construct)).some((error) => error.property === "code")).toBe(true);
    expect((await validate(item)).some((error) => error.property === "code")).toBe(true);
  });

  it("accepts ordinary construct and item codes", async () => {
    const construct = Object.assign(new CreateAssessmentConstructDto(), {
      code: "OPENNESS",
      name: "Openness to Experience",
      orderIndex: 0,
    });
    const item = Object.assign(new CreateAssessmentItemDto(), {
      code: "Q1",
      type: AssessmentItemType.SINGLE_CHOICE,
      prompt: "I enjoy trying new things.",
      orderIndex: 0,
    });

    expect(await validate(construct)).toHaveLength(0);
    expect(await validate(item)).toHaveLength(0);
  });

  it("rejects whitespace-only option codes", async () => {
    const dto = Object.assign(new CreateAssessmentItemOptionDto(), {
      code: "   ",
      label: "Option",
      orderIndex: 0,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "code")).toBe(true);
  });

  it("accepts an ordinary option code", async () => {
    const dto = Object.assign(new CreateAssessmentItemOptionDto(), {
      code: "STRONGLY_AGREE",
      label: "Strongly agree",
      orderIndex: 0,
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
