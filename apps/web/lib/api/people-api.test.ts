import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";
import { peopleApi } from "./people";

vi.mock("./client", () => ({ request: vi.fn() }));

const requestMock = vi.mocked(request);

describe("People API client", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("uses the safe account termination endpoint and never sends DELETE", () => {
    peopleApi.terminatePerson(
      "11111111-1111-4111-8111-111111111111",
      "Nhân sự đã nghỉ việc",
    );

    expect(requestMock).toHaveBeenCalledWith(
      "/admin/people/11111111-1111-4111-8111-111111111111/terminate",
      {
        method: "POST",
        body: JSON.stringify({ reason: "Nhân sự đã nghỉ việc" }),
      },
    );
    expect(requestMock).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
