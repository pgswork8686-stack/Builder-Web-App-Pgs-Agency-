import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface QuickActionItem {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  highlight?: boolean;
}

export interface QuickActionGridProps {
  items: QuickActionItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function QuickActionGrid({
  items,
  columns = 3,
  className = "",
}: QuickActionGridProps) {
  const colStyles = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid ${colStyles[columns]} gap-4 ${className}`}>
      {items.map((item) => (
        <Link key={item.href + item.title} href={item.href}>
          <Card
            className={`h-full p-5 transition-all duration-150 hover:border-[#6044E8]/40 hover:shadow-md group flex flex-col justify-between ${
              item.highlight ? "bg-[#F2EEFF]/40 border-[#E7E0FF]" : "bg-white"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#F2EEFF] text-[#6044E8] flex items-center justify-center group-hover:scale-105 transition-transform">
                  {item.icon}
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F2EEFF] text-[#6044E8] text-xs font-bold border border-[#E7E0FF]">
                    {item.badge}
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#202333] group-hover:text-[#6044E8] transition-colors">
                  {item.title}
                </h4>
                <p className="mt-1 text-xs text-[#475569] leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#6044E8] opacity-90 group-hover:opacity-100 transition-opacity">
              <span>Truy cập</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
