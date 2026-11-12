import React from "react";

export function TableContainer({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`w-full overflow-x-auto rounded-2xl border border-[#E7E9F0] bg-white ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Table({
  className = "",
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={`w-full text-left border-collapse text-sm text-[#202333] ${className}`}
      {...props}
    >
      {children}
    </table>
  );
}

export function TableHead({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-b border-[#E7E9F0] bg-[#F4F2FD] text-xs font-bold uppercase tracking-wide text-[#475569] ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-[#E7E9F0] ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`transition-colors hover:bg-[#F8F9FC] ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  className = "",
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 sm:px-6 py-3.5 select-none whitespace-nowrap ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  className = "",
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  // Giá trị ngắn (tiền, ngày, mã) giữ một dòng; văn bản dài vẫn tự xuống dòng.
  const short = typeof children === "string" && children.length <= 28 ? "whitespace-nowrap" : "";
  return (
    <td className={`px-4 sm:px-6 py-4 align-middle ${short} ${className}`} {...props}>
      {children}
    </td>
  );
}
