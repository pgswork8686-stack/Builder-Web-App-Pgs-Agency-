import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";
import { attendanceApi } from "./attendance";

vi.mock("./client", () => ({ request: vi.fn() }));

const requestMock = vi.mocked(request);

describe("Phase 5 Attendance API client — Fix Round 3 contract", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("reads canonical attendance settings from the admin-only endpoint", () => {
    attendanceApi.getSettings();
    expect(requestMock).toHaveBeenCalledWith("/attendance/settings");
  });

  it("updates canonical settings with a PATCH instead of legacy system_settings", () => {
    attendanceApi.updateSettings({
      workdayStartTime: "08:00",
      workdayEndTime: "17:30",
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      locationRequired: true,
      locationRadiusMeters: 100,
    });

    expect(requestMock).toHaveBeenCalledWith("/attendance/settings", {
      method: "PATCH",
      body: JSON.stringify({
        workdayStartTime: "08:00",
        workdayEndTime: "17:30",
        lateGraceMinutes: 5,
        earlyLeaveGraceMinutes: 5,
        locationRequired: true,
        locationRadiusMeters: 100,
      }),
    });
  });

  // T1: fileSize is sent in request body
  it("T1: getPhotoUploadSignature sends fileName, mimeType AND fileSize", () => {
    attendanceApi.getPhotoUploadSignature("photo.jpg", "image/jpeg", 102400);
    expect(requestMock).toHaveBeenCalledWith("/attendance/signed-upload", {
      method: "POST",
      body: JSON.stringify({
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSize: 102400,
      }),
    });
  });

  // T2: fileSize = 0 is structurally passed (backend rejects, but client must send it)
  it("T2: zero-byte upload sends fileSize=0 to backend for authoritative rejection", () => {
    attendanceApi.getPhotoUploadSignature("empty.jpg", "image/jpeg", 0);
    expect(requestMock).toHaveBeenCalledWith("/attendance/signed-upload", {
      method: "POST",
      body: JSON.stringify({
        fileName: "empty.jpg",
        mimeType: "image/jpeg",
        fileSize: 0,
      }),
    });
  });

  // T3: large file size is sent (backend rejects, client passes it through)
  it("T3: oversized upload sends fileSize to backend for authoritative rejection", () => {
    const bigSize = 6 * 1024 * 1024;
    attendanceApi.getPhotoUploadSignature("big.png", "image/png", bigSize);
    expect(requestMock).toHaveBeenCalledWith("/attendance/signed-upload", {
      method: "POST",
      body: JSON.stringify({
        fileName: "big.png",
        mimeType: "image/png",
        fileSize: bigSize,
      }),
    });
  });

  // T4: invalid MIME is passed to backend (backend rejects)
  it("T4: invalid MIME sends to backend for authoritative rejection", () => {
    attendanceApi.getPhotoUploadSignature("anim.gif", "image/gif", 1024);
    expect(requestMock).toHaveBeenCalledWith("/attendance/signed-upload", {
      method: "POST",
      body: JSON.stringify({
        fileName: "anim.gif",
        mimeType: "image/gif",
        fileSize: 1024,
      }),
    });
  });

  // T5: check-in does NOT send photo path (only session ID)
  it("T5: checkIn body never includes a photo path — only photoUploadSessionId", () => {
    attendanceApi.checkIn({
      latitude: 21.028,
      longitude: 105.854,
      photoUploadSessionId: "session-abc",
      note: "morning",
    });
    expect(requestMock).toHaveBeenCalledWith(
      "/attendance/check-in",
      expect.objectContaining({
        method: "POST",
        body: expect.not.stringContaining("photoPath"),
      }),
    );
    const body = JSON.parse(
      (requestMock.mock.calls[0][1] as any).body as string,
    );
    expect(body).not.toHaveProperty("photoPath");
    expect(body).toHaveProperty("photoUploadSessionId", "session-abc");
  });

  // T6: check-out similarly sends only session ID, no path
  it("T6: checkOut body never includes a photo path — only photoUploadSessionId", () => {
    attendanceApi.checkOut({
      photoUploadSessionId: "session-xyz",
    });
    const body = JSON.parse(
      (requestMock.mock.calls[0][1] as any).body as string,
    );
    expect(body).not.toHaveProperty("photoPath");
    expect(body).toHaveProperty("photoUploadSessionId", "session-xyz");
  });
});
