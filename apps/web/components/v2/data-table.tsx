"use client";

import React from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Lớp Tailwind cho độ rộng/căn lề, vd "w-32 text-right". */
  className?: string;
  /** Ẩn trên thẻ điện thoại (cột phụ). */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  loading?: boolean;
  error?: string | null;
  empty: { title: string; text?: string; action?: React.ReactNode };
  toolbar?: React.ReactNode;
}

/**
 * Bảng V2: thanh công cụ + bảng ≤ 6 cột; bấm dòng (hoặc Enter) mở chi tiết.
 * Dưới 768px chuyển thành danh sách thẻ (không ép bảng desktop lên điện thoại).
 */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, selectedKey, loading, error, empty, toolbar }: DataTableProps<T>) {
  const clickable = !!onRowClick;
  const rowProps = (r: T) =>
    clickable
      ? { role: "button", tabIndex: 0, onClick: () => onRowClick!(r), onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick!(r)) }
      : {};
  const body = loading ? (
    <p className="px-4 py-10 text-center text-sm text-[#64748B]">Đang tải…</p>
  ) : error ? (
    <p role="alert" className="px-4 py-10 text-center text-sm text-[#B42318]">{error}</p>
  ) : rows.length === 0 ? (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-medium text-[#202333]">{empty.title}</p>
      {empty.text && <p className="mt-1 text-sm text-[#64748B]">{empty.text}</p>}
      {empty.action && <div className="mt-4 flex justify-center">{empty.action}</div>}
    </div>
  ) : null;

  return (
    <section className="rounded-xl border border-[#E7E9F0] bg-white overflow-hidden">
      {toolbar && <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-[#E7E9F0]">{toolbar}</div>}
      {body ?? (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FBFBFD] text-left text-xs text-[#64748B] border-b border-[#E7E9F0]">
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={`px-4 py-2.5 font-medium whitespace-nowrap ${c.className ?? ""}`}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9F0]">
                {rows.map((r) => {
                  const k = rowKey(r);
                  return (
                    <tr key={k} {...rowProps(r)} className={`${clickable ? "cursor-pointer hover:bg-[#F8F9FC] focus-visible:bg-[#F8F9FC] focus-visible:outline-none" : ""} ${selectedKey === k ? "bg-[#F2EEFF]" : ""}`}>
                      {columns.map((c) => (
                        <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>{c.render(r)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden divide-y divide-[#E7E9F0]">
            {rows.map((r) => {
              const k = rowKey(r);
              const [first, ...rest] = columns.filter((c) => !c.hideOnMobile);
              return (
                <li key={k} {...rowProps(r)} className={`px-4 py-3 space-y-1.5 ${clickable ? "active:bg-[#F8F9FC]" : ""} ${selectedKey === k ? "bg-[#F2EEFF]" : ""}`}>
                  <div className="text-sm">{first?.render(r)}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#475569]">
                    {rest.map((c) => (
                      <span key={c.key} className="inline-flex items-center gap-1">
                        <span className="text-[#94A3B8]">{c.header}:</span> {c.render(r)}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
