import { describe, expect, it } from "vitest";
import { isTaskOverdue, taskHref, toIsoDate } from "./task-meta";

const today = new Date(2026, 9, 16); // 2026-10-16 (local)

describe("isTaskOverdue", () => {
  it("is false without a due date", () => {
    expect(isTaskOverdue({ due_date: null, status: "todo" }, today)).toBe(
      false,
    );
  });

  it("is true for open tasks past their due date", () => {
    expect(
      isTaskOverdue({ due_date: "2026-10-15", status: "in_progress" }, today),
    ).toBe(true);
  });

  it("is false on the due date itself and afterwards", () => {
    expect(
      isTaskOverdue({ due_date: "2026-10-16", status: "todo" }, today),
    ).toBe(false);
    expect(
      isTaskOverdue({ due_date: "2026-10-17", status: "todo" }, today),
    ).toBe(false);
  });

  it("is false for finished or cancelled tasks", () => {
    expect(
      isTaskOverdue({ due_date: "2026-01-01", status: "done" }, today),
    ).toBe(false);
    expect(
      isTaskOverdue({ due_date: "2026-01-01", status: "cancelled" }, today),
    ).toBe(false);
  });
});

describe("helpers", () => {
  it("formats ISO dates with zero padding", () => {
    expect(toIsoDate(2026, 0, 5)).toBe("2026-01-05");
  });

  it("builds the project task href", () => {
    expect(taskHref({ id: "t1", project_id: "p1" })).toBe(
      "/app/projects/p1/tasks/t1",
    );
  });
});
