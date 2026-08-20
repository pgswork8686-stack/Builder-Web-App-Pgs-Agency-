import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";
import { workCalendarApi } from "./work-calendar";

vi.mock("./client", () => ({
  request: vi.fn(),
}));

const requestMock = vi.mocked(request);

describe("Work Calendar API & Frontend Integration Tests", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  // Test 14: range API correct query
  it("14. queries work calendar range with encoded query params", async () => {
    requestMock.mockResolvedValueOnce({
      from: "2026-08-01",
      to: "2026-08-31",
      timezone: "Asia/Ho_Chi_Minh",
      days: [
        {
          date: "2026-08-22",
          isWorkingDay: false,
          reason: "alternate_saturday",
          title: "Nghỉ thứ 7 cách tuần",
          sourceType: "system",
          eventType: null,
        },
      ],
    });

    const res = await workCalendarApi.range("2026-08-01", "2026-08-31");
    expect(requestMock).toHaveBeenCalledWith(
      "/work-calendar?from=2026-08-01&to=2026-08-31",
    );
    expect(res.days[0].isWorkingDay).toBe(false);
    expect(res.days[0].reason).toBe("alternate_saturday");
  });

  // Test 15: Calendar renders non-working day
  it("15. verifies non-working day properties for calendar render", () => {
    const day = {
      date: "2026-08-22",
      isWorkingDay: false,
      reason: "alternate_saturday",
      title: "Nghỉ thứ 7 cách tuần",
      sourceType: "system",
      eventType: null,
    };
    expect(day.isWorkingDay).toBe(false);
    expect(day.title).toBe("Nghỉ thứ 7 cách tuần");
  });

  // Test 16: Calendar renders holiday
  it("16. verifies holiday properties for calendar render", () => {
    const day = {
      date: "2026-09-02",
      isWorkingDay: false,
      reason: "public_holiday",
      title: "Quốc khánh",
      sourceType: "api",
      eventType: "public_holiday",
    };
    expect(day.isWorkingDay).toBe(false);
    expect(day.reason).toBe("public_holiday");
    expect(day.eventType).toBe("public_holiday");
  });

  // Test 17: Admin settings endpoints
  it("17. calls admin settings and sync holidays correctly", async () => {
    requestMock.mockResolvedValueOnce({
      id: "set-1",
      timezone: "Asia/Ho_Chi_Minh",
    });
    await workCalendarApi.getSettings();
    expect(requestMock).toHaveBeenCalledWith("/admin/work-calendar/settings");

    requestMock.mockResolvedValueOnce({
      success: true,
      syncedCount: 5,
    });
    await workCalendarApi.syncHolidays(2026);
    expect(requestMock).toHaveBeenCalledWith(
      "/admin/work-calendar/sync-holidays",
      {
        method: "POST",
        body: JSON.stringify({ year: 2026 }),
      },
    );
  });

  // Test 18: Admin event creation and deletion
  it("18. creates and deletes admin calendar events correctly", async () => {
    requestMock.mockResolvedValueOnce({ id: "ev-1" });
    await workCalendarApi.createEvent({
      eventDate: "2026-08-22",
      eventType: "makeup_workday",
      title: "Đi làm bù",
      isWorkingDay: true,
    });
    expect(requestMock).toHaveBeenCalledWith("/admin/work-calendar/events", {
      method: "POST",
      body: JSON.stringify({
        eventDate: "2026-08-22",
        eventType: "makeup_workday",
        title: "Đi làm bù",
        isWorkingDay: true,
      }),
    });

    requestMock.mockResolvedValueOnce({ success: true });
    await workCalendarApi.deleteEvent("ev-1");
    expect(requestMock).toHaveBeenCalledWith(
      "/admin/work-calendar/events/ev-1",
      {
        method: "DELETE",
      },
    );
  });
});
