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

  it("rejects whitespace-only option codes", async () => {
    const dto = Object.assign(new CreateAssessmentItemOptionDto(), {
      code: "   ",
      label: "Option",
      orderIndex: 0,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "code")).toBe(true);
  });
});
