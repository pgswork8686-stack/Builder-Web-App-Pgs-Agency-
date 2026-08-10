import { expect, test } from "vitest";
import { EmailSchema } from "./index";

test("validates email addresses correctly", () => {
  const result1 = EmailSchema.safeParse("test@pgsagency.vn");
  expect(result1.success).toBe(true);

  const result2 = EmailSchema.safeParse("invalid-email");
  expect(result2.success).toBe(false);
});
