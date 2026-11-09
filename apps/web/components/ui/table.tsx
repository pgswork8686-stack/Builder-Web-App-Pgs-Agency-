import React from "react";

export function TableContainer({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`w-full overflow-x-auto rounded-2xl border border-[#F2EAD3] bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] ${className}`}
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
      className={`w-full text-left border-collapse text-sm text-[#161827] ${className}`}
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
      className={`border-b border-[#F2EAD3] bg-[#FFFBF0] text-xs font-semibold uppercase tracking-wider text-[#64748B] ${className}`}
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
    <tbody className={`divide-y divide-[#F2EAD3] ${className}`} {...props}>
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
      className={`transition-colors hover:bg-[#FFFBF0] ${className}`}
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
    <th className={`px-4 sm:px-6 py-3.5 select-none ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  className = "",
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 sm:px-6 py-4 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
