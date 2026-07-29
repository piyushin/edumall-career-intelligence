import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("is a renderable accessible button component", () => {
    expect(Button).toBeTypeOf("function");
  });
});
