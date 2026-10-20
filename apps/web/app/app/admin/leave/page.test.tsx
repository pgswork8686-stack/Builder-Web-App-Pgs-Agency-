import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leaveApi } from "@/lib/api/leave";
import AdminLeavePage from "./page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/api/leave", () => ({
  leaveApi: {
    getDirectory: vi.fn(),
    getCalendar: vi.fn(),
    reviewRequest: vi.fn(),
  },
}));

const directory = (total: number) => ({
  items: [],
  total,
  page: 1,
  pageSize: 15,
  totalPages: total > 0 ? 1 : 0,
});

function localDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

describe("AdminLeavePage KPI cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows counts from the API instead of fixed numbers", async () => {
    vi.mocked(leaveApi.getDirectory).mockImplementation(async (query) => {
      if (query?.status === "pending") return directory(7);
      if (query?.status === "approved") return directory(31);
      if (query?.status === "rejected") return directory(5);
      return directory(0);
    });
    vi.mocked(leaveApi.getCalendar).mockResolvedValue([]);

    render(<AdminLeavePage />);

    await waitFor(() => expect(screen.getByText("07")).toBeTruthy());
    expect(screen.getByText("31")).toBeTruthy();
    expect(screen.getByText("05")).toBeTruthy();
    // The old hard-coded values must be gone.
    expect(screen.queryByText("18")).toBeNull();
    expect(screen.queryByText("02")).toBeNull();
  });

  it("asks for this month's leave using local calendar dates", async () => {
    vi.mocked(leaveApi.getDirectory).mockResolvedValue(directory(0));
    vi.mocked(leaveApi.getCalendar).mockResolvedValue([]);

    render(<AdminLeavePage />);

    const now = new Date();
    const from = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    await waitFor(() =>
      expect(leaveApi.getDirectory).toHaveBeenCalledWith({
        status: "approved",
        from,
        to,
        page: 1,
        pageSize: 1,
      }),
    );
    expect(leaveApi.getCalendar).toHaveBeenCalledWith(from, to);
  });

  it("counts distinct people on leave today from approved calendar events", async () => {
    const today = localDate(new Date());
    vi.mocked(leaveApi.getDirectory).mockResolvedValue(directory(0));
    vi.mocked(leaveApi.getCalendar).mockResolvedValue([
      {
        id: "r1",
        userId: "u1",
        fullName: "A",
        startDate: today,
        endDate: today,
        leaveType: "Phép năm",
      },
      {
        id: "r2",
        userId: "u1",
        fullName: "A",
        startDate: today,
        endDate: today,
        leaveType: "Phép năm",
      },
      {
        id: "r3",
        userId: "u2",
        fullName: "B",
        startDate: "2000-01-01",
        endDate: "2000-01-02",
        leaveType: "Phép năm",
      },
    ]);

    render(<AdminLeavePage />);

    const card = (await screen.findByText("Đang nghỉ")).closest("div");
    await waitFor(() =>
      expect(card?.parentElement?.textContent).toContain("01"),
    );
  });

  it("shows an honest placeholder when the KPIs cannot be loaded", async () => {
    vi.mocked(leaveApi.getDirectory).mockRejectedValue(new Error("down"));
    vi.mocked(leaveApi.getCalendar).mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<AdminLeavePage />);

    await waitFor(() =>
      expect(screen.getAllByText("Không tải được").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText("18")).toBeNull();
  });
});
