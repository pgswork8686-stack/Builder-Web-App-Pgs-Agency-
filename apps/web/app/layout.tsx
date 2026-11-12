import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

// Một họ phông đủ dấu tiếng Việt cho toàn bộ ứng dụng (PGS Hub V2).
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "PGS Hub",
  description: "Hệ thống quản trị vận hành PGS Agency",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#F8F9FC] text-[#202333]">
        {children}
      </body>
    </html>
  );
}
