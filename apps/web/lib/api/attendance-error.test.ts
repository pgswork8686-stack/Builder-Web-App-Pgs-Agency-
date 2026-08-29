import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => {
  class MockApiError extends Error {
    public code?: string;
    constructor(
      public status: number,
      message: string,
      public data?: any,
    ) {
      super(message);
      this.name = "ApiError";
      this.code = data?.code;
    }
  }
  return {
    request: vi.fn(),
    ApiError: MockApiError,
  };
});

import { getAttendanceErrorMessage } from "./attendance";
import { ApiError } from "./client";

describe("getAttendanceErrorMessage", () => {
  it("maps ATTENDANCE_LOCATION_REQUIRED to friendly message", () => {
    const error = new ApiError(400, "GPS required", {
      code: "ATTENDANCE_LOCATION_REQUIRED",
    });
    expect(getAttendanceErrorMessage(error)).toBe(
      "Tọa độ GPS là bắt buộc theo chính sách chấm công. Vui lòng bật vị trí trình duyệt.",
    );
  });

  it("maps OUTSIDE_ALLOWED_LOCATION to friendly message", () => {
    const error = { code: "OUTSIDE_ALLOWED_LOCATION", message: "Outside" };
    expect(getAttendanceErrorMessage(error)).toBe(
      "Vị trí của bạn nằm ngoài bán kính cho phép chấm công của văn phòng.",
    );
  });

  it("maps ATTENDANCE_ALREADY_CHECKED_IN to friendly message", () => {
    const error = {
      data: { code: "ATTENDANCE_ALREADY_CHECKED_IN" },
      message: "Already checked in",
    };
    expect(getAttendanceErrorMessage(error)).toBe(
      "Bạn đã thực hiện vào ca (check-in) cho ngày hôm nay rồi.",
    );
  });

  it("maps ATTENDANCE_NOT_CHECKED_IN to friendly message", () => {
    const error = { code: "ATTENDANCE_NOT_CHECKED_IN" };
    expect(getAttendanceErrorMessage(error)).toBe(
      "Bạn chưa thực hiện vào ca cho ngày hôm nay.",
    );
  });

  it("maps ATTENDANCE_PHOTO_REQUIRED to friendly message", () => {
    const error = { code: "ATTENDANCE_PHOTO_REQUIRED" };
    expect(getAttendanceErrorMessage(error)).toBe(
      "Ảnh bằng chứng khuôn mặt là bắt buộc theo chính sách. Vui lòng chụp hoặc chọn ảnh.",
    );
  });

  it("falls back to error message if code unknown", () => {
    const error = new Error("Custom server error");
    expect(getAttendanceErrorMessage(error)).toBe("Custom server error");
  });
});
