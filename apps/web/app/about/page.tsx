import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { ArrowUpRight, Star } from "lucide-react";

const inter = Inter({ subsets: ["latin", "vietnamese"], display: "swap" });

export const metadata: Metadata = {
  title: "Về chúng tôi — PGS Agency",
  description:
    "PGS Agency — đối tác Digital Marketing thực chiến cho cá nhân, chủ shop và doanh nghiệp SME toàn quốc.",
};

/* Token trang công khai (Figma: PGS Tokens + NexSaaS Visual System) */
const ACCENT = "#864FFE";
const BG = "#F2F5FA";
const MUTED = "#5A5E66";

const NAV = [
  ["Trang chủ", "/"],
  ["Về chúng tôi", "#top"],
  ["Năng lực", "#expertise"],
  ["Quy trình", "#approach"],
  ["Case Study", "#projects"],
  ["Đội ngũ", "#team"],
  ["Liên hệ", "#contact"],
] as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wide text-black">
      <Star className="w-3.5 h-3.5" style={{ color: ACCENT }} fill={ACCENT} />
      {children}
    </p>
  );
}

function H2({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2 className={`text-3xl md:text-5xl leading-[1.1] tracking-tight ${light ? "text-white" : "text-black"}`}>
      {children}
    </h2>
  );
}

function Btn({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full pl-6 pr-2 py-2 text-[15px] font-medium transition-opacity hover:opacity-90 ${
        dark ? "bg-black text-white" : "bg-white text-black border border-black/10"
      }`}
    >
      {children}
      <span className="w-9 h-9 rounded-full grid place-items-center" style={{ background: dark ? "#F7D327" : "#F7D327" }}>
        <ArrowUpRight className="w-4 h-4 text-black" />
      </span>
    </Link>
  );
}

function Img({ className = "", label }: { className?: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`bg-gradient-to-br from-[#E4DCFF] via-[#F2F5FA] to-[#FDEFA8] ${className}`}
    />
  );
}

const BENTO = [
  ["01 • PGS LÀ AI", "Đối tác Marketing Thực chiến", "Tư vấn & triển khai đồng bộ như phòng Marketing in-house của doanh nghiệp."],
  ["02 • KHÁCH HÀNG", "Cá nhân, Chủ Shop & SME", "Thiết kế gói giải pháp vừa vặn cho hộ kinh doanh và doanh nghiệp vừa & nhỏ."],
  ["03 • PHẠM VI GIẢI PHÁP", "Hệ sinh thái Đa kênh", "Kết nối Website, SEO Google, Quảng cáo chuyển đổi, Social Media và PR."],
  ["04 • CÁCH TIẾP CẬN", "Tư vấn Đúng — Làm Thật", "Phân bổ ngân sách minh bạch, đo lường bằng kết quả thực tế (Rated 4.8/5 Demo)."],
];

const STORY = [
  [".01 • Câu chuyện hình thành", "Giải quyết khoảng trống Chi phí & Chuyên môn", "Chuẩn hóa quy trình để chủ shop và SME tiếp cận dịch vụ Marketing bài bản với chi phí hợp lý."],
  [".02 • Định hướng phát triển", "Hệ sinh thái Marketing Trọn gói Toàn quốc", "Triển khai khép kín từ Website, SEO, Quảng cáo đến Social Media và PR trên 63 tỉnh thành."],
  [".03 • Triết lý & Cột mốc", "Lấy hiệu quả thực tế làm thước đo duy nhất", "Giai đoạn 01: Chuẩn hóa nền tảng • Giai đoạn 02: Đa kênh • Giai đoạn 03: Phủ sóng toàn quốc."],
];

const WHY = [
  ["Giải pháp Marketing toàn diện", "Trọn gói từ Website, SEO đến Quảng cáo, Social Media & PR đồng bộ.", true],
  ["Chi phí cạnh tranh", "Tối ưu ngân sách cho chủ shop & SME, bảng giá minh bạch từng hạng mục.", false],
  ["Triển khai nhanh", "Quy trình tinh gọn, đi vào vận hành thực tế đúng tiến độ.", false],
  ["Đội ngũ chuyên môn", "Chuyên gia thực chiến đa ngành, am hiểu thị trường Việt Nam.", false],
  ["Chăm sóc tận tâm", "Đồng hành sát sao 1-1, hỗ trợ nhanh chóng qua Zalo & Hotline.", false],
  ["Hiệu quả thực tế", "Tập trung vào chuyển đổi, khách hàng tiềm năng và doanh số thật.", true],
] as const;

const EXPERTISE = [
  ["Nền tảng số", "Website & Landing Page", "Thiết kế chuẩn UI/UX, tối ưu tốc độ và tỷ lệ chuyển đổi đơn hàng."],
  ["Tăng trưởng tự nhiên", "SEO & Google", ""],
  ["Tối ưu doanh số", "Digital Advertising", ""],
  ["Xây dựng kênh", "Social Media", ""],
  ["Uy tín thương hiệu", "Marketing & PR", ""],
];

const STEPS = ["Khảo sát & Hoạch định Chiến lược", "Xây dựng Nền tảng & Kích hoạt", "Đo lường, Báo cáo & Tối ưu"];

const STATS = [
  ["120+", "Dự án & chiến dịch hoàn thành (Demo)"],
  ["95%", "Tỷ lệ khách hàng hài lòng & gia hạn (Demo)"],
  ["50+", "Thương hiệu, Chủ shop & SME đồng hành (Demo)"],
  ["2X ROI", "Tăng trưởng hiệu suất chuyển đổi (-40% chi phí Demo)"],
];

const TEAM = [
  ["Nguyễn Minh Quân", "Founder & Chiến lược", "SME Growth Strategy"],
  ["Trần Thảo Vy", "Lead Website & UI/UX", "Web & Landing Page"],
  ["Lê Hoàng Nam", "Lead SEO & Google", "SEO Tổng thể"],
  ["Phạm Đức Anh", "Lead Digital Ads", "Google/Meta/TikTok Ads"],
  ["Võ Khánh Linh", "Lead Social & PR", "Content & Brand PR"],
];

const WORK = [
  ["Website & SEO Tổng thể", "FinovaX Pro (SME Tài chính)", "+180% lượng truy cập tự nhiên (Demo)"],
  ["Landing Page & Google Ads", "NexaCore Studio (Nội thất)", "Giảm 35% chi phí/khách hàng (Demo)"],
  ["Marketing Toàn diện", "QuantroX Suite (B2B SME)", "Tăng 2.4X khách hàng B2B (Demo)"],
  ["Social & TikTok/Meta Ads", "Veltrix One (Hệ thống Shop)", "Bứt phá doanh số đa kênh (Demo)"],
  ["Branding, PR & Quảng cáo", "Orbix Prime (Thẩm mỹ & Spa)", "+95% lượng đặt lịch hẹn (Demo)"],
  ["Website & Lead Gen", "StratosFlow (Giáo dục)", "Vượt 130% KPI tuyển sinh (Demo)"],
];

const REVIEWS = [
  ["Anh Minh Hoàng (Demo)", "Chủ Shop Phụ kiện • Website & Ads", "Giao diện website sắc nét, tốc độ tải nhanh và đội ngũ chạy quảng cáo theo sát từng ngày."],
  ["Chị Thanh Thảo (Demo)", "Founder Spa & Clinic • Landing Page", "Thiết kế vượt ngoài mong đợi, tỷ lệ khách để lại SĐT đăng ký tư vấn tăng rõ rệt."],
  ["Anh Quốc Bảo (Demo)", "Giám đốc SME • SEO & Google Ads", "Cách làm việc bài bản, minh bạch. Website lên top từ khóa nhanh và mang về khách B2B đều đặn."],
  ["Chị Lan Hương (Demo)", "Thương hiệu Thời trang • Social Media", "Hình ảnh và nội dung Fanpage được chăm chút sáng tạo, thu hút tương tác thật."],
  ["Anh Tuấn Kiệt (Demo)", "Quản lý SME • Marketing Toàn diện", "Hợp tác với PGS giúp công ty có ngay một phòng Marketing chuyên nghiệp với chi phí hợp lý."],
];

export default function AboutPage() {
  return (
    <main id="top" className={`${inter.className} text-black`} style={{ background: BG }}>
      {/* 00 Header */}
      <header className="sticky top-0 z-30 backdrop-blur border-b border-black/5" style={{ background: "rgba(242,245,250,.92)" }}>
        <div className="mx-auto max-w-[1280px] px-5 md:px-0 h-[88px] flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl grid place-items-center text-[13px] font-bold text-white" style={{ background: ACCENT }}>PGS</span>
            <span className="text-lg font-semibold">PGS Agency</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-8 text-sm" style={{ color: MUTED }}>
            {NAV.map(([label, href]) => (
              <Link key={label} href={href} className={label === "Về chúng tôi" ? "font-semibold" : "hover:text-black"} style={label === "Về chúng tôi" ? { color: ACCENT } : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <Btn href="#contact" dark>Nhận tư vấn ngay</Btn>
        </div>
      </header>

      {/* 01 Hero */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-0 pt-16 md:pt-24 pb-16 grid lg:grid-cols-[1.4fr_1fr] gap-12 items-center">
        <div className="space-y-6">
          <Eyebrow>Về chúng tôi — PGS Agency</Eyebrow>
          <h1 className="text-4xl md:text-[64px] leading-[1.05] tracking-tight font-medium">
            Đồng hành bứt phá tăng trưởng trên một nền tảng toàn diện
          </h1>
          <p className="text-base max-w-[640px]" style={{ color: MUTED }}>
            Giải pháp Digital Marketing thực chiến giúp cá nhân, chủ shop và doanh nghiệp SME toàn quốc tăng trưởng doanh số bền vững.
          </p>
          <div className="flex flex-wrap gap-3">
            <Btn href="#contact" dark>Đăng ký tư vấn</Btn>
            <Btn href="#expertise">Khám phá năng lực</Btn>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {["Cá nhân & Chủ shop", "Hộ kinh doanh", "Doanh nghiệp SME Toàn quốc"].map((t) => (
              <span key={t} className="rounded-full bg-white border border-black/10 px-4 py-1.5 text-[13px] font-medium">{t}</span>
            ))}
          </div>
        </div>
        <div className="relative">
          <Img label="Đội ngũ PGS Agency" className="aspect-[4/5] rounded-[28px]" />
          <div className="absolute -bottom-6 -left-6 rounded-2xl bg-white p-5 shadow-sm border border-black/5 max-w-[260px]">
            <p className="text-sm font-semibold" style={{ color: ACCENT }}>63+ Tỉnh thành Việt Nam</p>
            <p className="text-sm mt-1" style={{ color: MUTED }}>Đồng hành thực chiến cùng Chủ shop & SME trên toàn quốc.</p>
          </div>
          <div className="absolute -top-4 -right-2 rounded-2xl bg-black text-white px-5 py-3">
            <p className="text-[13px] font-bold">PGS AGENCY</p>
            <p className="text-[10px] font-medium" style={{ color: ACCENT }}>GROWTH PARTNER</p>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1280px] px-5 md:px-0 grid grid-cols-2 gap-4 pb-16">
        {[["95%", "Khách hàng hài lòng (Demo)"], ["130+", "Dự án hoàn thành (Demo)"]].map(([n, l]) => (
          <div key={n} className="rounded-2xl bg-white p-6 border border-black/5">
            <p className="text-4xl font-medium">{n}</p>
            <p className="text-[13px] mt-1" style={{ color: MUTED }}>{l}</p>
          </div>
        ))}
      </div>

      {/* 02 Who we are */}
      <section id="about" className="mx-auto max-w-[1280px] px-5 md:px-0 py-16 space-y-10">
        <div className="max-w-[860px] space-y-4">
          <Eyebrow>Chúng tôi là ai</Eyebrow>
          <H2>Từ chiến lược đến thực thi — Xây dựng nền tảng tăng trưởng thật</H2>
          <p style={{ color: MUTED }}>PGS tập trung giải quyết bài toán doanh số và thương hiệu thực tế cho khách hàng trên toàn quốc.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 grid sm:grid-cols-2 gap-4">
            {BENTO.map(([k, t, d]) => (
              <article key={k} className="rounded-3xl bg-white p-7 border border-black/5 space-y-3">
                <p className="text-[13px] font-semibold" style={{ color: ACCENT }}>{k}</p>
                <h3 className="text-[22px] font-medium">{t}</h3>
                <p className="text-[15px]" style={{ color: MUTED }}>{d}</p>
              </article>
            ))}
          </div>
          <article className="relative rounded-3xl overflow-hidden bg-black text-white min-h-[360px] flex flex-col justify-end p-7">
            <Img label="PGS Team" className="absolute inset-0 opacity-30" />
            <p className="relative text-xs font-semibold" style={{ color: ACCENT }}>VISUAL SHOWCASE • PGS TEAM</p>
            <h3 className="relative text-2xl font-medium mt-2">Đồng hành sát sao trên từng chiến dịch</h3>
          </article>
        </div>
      </section>

      {/* 03 Story */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-5 md:px-0 grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <Eyebrow>Câu chuyện & định hướng</Eyebrow>
            <H2>Trở thành phòng Marketing đồng hành đáng tin cậy của doanh nghiệp Việt</H2>
            <p style={{ color: MUTED }}>
              PGS ra đời từ sự thấu hiểu nỗi đau của chủ shop và SME: chi phí quảng cáo đắt đỏ, khó tuyển đội ngũ và thiếu quy trình đo lường rõ ràng.
            </p>
            <div className="relative">
              <Img label="Văn hóa làm việc thực chất tại PGS Agency" className="aspect-[16/10] rounded-3xl" />
              <p className="absolute left-5 bottom-4 text-sm font-medium text-black">Văn hóa làm việc thực chất tại PGS Agency</p>
            </div>
          </div>
          <div className="divide-y divide-black/10">
            {STORY.map(([k, t, d]) => (
              <div key={k} className="py-7 space-y-2 first:pt-0">
                <p className="text-[13px] font-semibold" style={{ color: ACCENT }}>{k}</p>
                <h3 className="text-[22px] font-medium">{t}</h3>
                <p className="text-[15px]" style={{ color: MUTED }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 Why */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-0 py-16 space-y-10">
        <div className="space-y-4">
          <Eyebrow>Vì sao chọn PGS Agency</Eyebrow>
          <H2>6 lợi thế cạnh tranh tạo nên sự khác biệt</H2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {WHY.map(([t, d, key], i) => (
            <article key={t} className={`rounded-3xl p-7 border border-black/5 space-y-3 ${key ? "bg-white md:row-span-1 ring-1 ring-[#864FFE]/20" : "bg-white"}`}>
              <p className="text-xs font-semibold" style={{ color: ACCENT }}>{key ? "★ LỢI THẾ TRỌNG TÂM" : "LỢI THẾ PGS"}</p>
              <p className="text-[28px] font-medium" style={{ color: key ? ACCENT : MUTED }}>.0{i + 1}</p>
              <h3 className="text-[22px] font-medium">{t}</h3>
              <p className="text-[15px]" style={{ color: MUTED }}>{d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 05 Expertise */}
      <section id="expertise" className="bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-5 md:px-0 space-y-10">
          <div className="space-y-4 max-w-[760px]">
            <Eyebrow>Năng lực cốt lõi</Eyebrow>
            <H2>5 nhóm giải pháp Marketing tổng thể</H2>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 lg:h-[420px]">
            {EXPERTISE.map(([k, t, d], i) => (
              <article
                key={t}
                className={`rounded-3xl p-7 flex flex-col justify-between border border-black/5 ${i === 0 ? "bg-black text-white lg:flex-[3]" : "bg-[#F2F5FA] lg:flex-1"}`}
              >
                <div>
                  <p className="text-[13px] font-medium" style={{ color: i === 0 ? ACCENT : MUTED }}>{k}</p>
                  <h3 className="text-[22px] font-medium mt-2">{t}</h3>
                  {d && <p className="text-sm mt-3 max-w-[360px]" style={{ color: "#CDD0D8" }}>{d}</p>}
                </div>
                <p className="text-[44px] leading-none">.0{i + 1}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 06 Approach */}
      <section id="approach" className="py-16" style={{ background: "#FCFCFC" }}>
        <div className="mx-auto max-w-[1280px] px-5 md:px-0 space-y-10">
          <div className="space-y-4 max-w-[760px]">
            <Eyebrow>Phương pháp triển khai</Eyebrow>
            <H2>Quy trình phối hợp 3 giai đoạn minh bạch, nhanh gọn</H2>
          </div>
          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-8">
            <ol className="space-y-4">
              {STEPS.map((s, i) => (
                <li key={s} className={`rounded-2xl p-5 border ${i === 0 ? "bg-white border-[#864FFE]/40" : "bg-white/60 border-black/5"}`}>
                  <p className="text-xs font-semibold" style={{ color: i === 0 ? ACCENT : MUTED }}>BƯỚC .0{i + 1}{i === 0 ? " (ACTIVE)" : ""}</p>
                  <p className="text-lg font-medium mt-1">{s}</p>
                </li>
              ))}
            </ol>
            <div className="rounded-3xl bg-white border border-black/5 p-7 space-y-4">
              <p className="text-[13px] font-semibold" style={{ color: ACCENT }}>GIAI ĐOẠN .01 • CLARITY BEFORE CREATIVITY</p>
              <h3 className="text-[32px] leading-tight font-medium">Thấu hiểu bài toán thực tế trước khi đề xuất giải pháp</h3>
              <p style={{ color: MUTED }}>Lắng nghe mục tiêu doanh số, phân tích đối thủ và đề xuất lộ trình kênh kèm dự toán ngân sách minh bạch.</p>
              <Img label="Minh họa quy trình Bước 01" className="aspect-[16/8] rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* 07 Results */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-0 py-16 space-y-10">
        <div className="space-y-4 max-w-[860px]">
          <Eyebrow>Kết quả & ghi nhận (Demo data)</Eyebrow>
          <H2>Định hướng bởi kết quả, chứng minh bằng con số thực tế</H2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map(([n, l], i) => (
            <article key={n} className={`rounded-3xl p-7 space-y-3 ${i === 1 ? "bg-black text-white" : "bg-white border border-black/5"}`}>
              <p className="text-xs font-semibold" style={{ color: ACCENT }}>CHỈ SỐ THỰC TẾ</p>
              <p className="text-5xl font-medium">{n}</p>
              <p className="text-[15px]" style={{ color: i === 1 ? "#CDD0D8" : MUTED }}>{l}</p>
            </article>
          ))}
        </div>
        <div className="rounded-3xl bg-white border border-black/5 p-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <p className="text-[15px] font-medium">Chứng nhận & Đối tác: Google Partner • Meta Business • TikTok & Zalo Ads</p>
          <p className="text-sm font-semibold tracking-wide" style={{ color: MUTED }}>SCAPIC • NOTION • SPOTIFY • LATTICE</p>
        </div>
      </section>

      {/* 08 Team */}
      <section id="team" className="mx-auto max-w-[1280px] px-5 md:px-0 py-16 space-y-10">
        <div className="space-y-4 max-w-[860px]">
          <Eyebrow>Đội ngũ chủ chốt (Squad)</Eyebrow>
          <H2>Những nhân sự đứng sau thành công của mỗi chiến dịch</H2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {TEAM.map(([n, r, tag]) => (
            <article key={n} className="rounded-3xl bg-white border border-black/5 p-4 space-y-3">
              <Img label={n} className="aspect-[3/4] rounded-2xl" />
              <h3 className="text-[19px] font-medium">{n}</h3>
              <p className="text-sm" style={{ color: MUTED }}>{r}</p>
              <p className="text-xs font-medium" style={{ color: ACCENT }}>{tag}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 09 Selected work */}
      <section id="projects" className="mx-auto max-w-[1280px] px-5 md:px-0 py-16 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 max-w-[760px]">
            <Eyebrow>Dự án tiêu biểu</Eyebrow>
            <H2>Dự án thực tế chứng minh năng lực triển khai</H2>
          </div>
          <Btn href="#contact">Xem tất cả Case Study</Btn>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WORK.map(([tag, name, result], i) => (
            <article key={name} className="relative rounded-3xl overflow-hidden min-h-[360px] flex flex-col justify-end p-7 text-white bg-black">
              <div className="absolute inset-0 opacity-60" style={{ background: `linear-gradient(${140 + i * 25}deg, ${ACCENT}, #1B1B2F 70%)` }} />
              <div className="relative space-y-2">
                <p className="text-xs font-medium">{tag}</p>
                <h3 className="text-[22px] font-medium">{name}</h3>
                <p className="text-[15px]" style={{ color: "#CDD0D8" }}>{result}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 10 Testimonials */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-0 py-16 space-y-10">
        <div className="space-y-4 max-w-[860px]">
          <Eyebrow>Khách hàng đánh giá</Eyebrow>
          <H2>Phản hồi thực tế từ các Chủ shop & Doanh nghiệp SME</H2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REVIEWS.slice(0, 3).map(([n, r, q]) => (
            <figure key={n} className="rounded-3xl bg-white border border-black/5 p-7 space-y-3">
              <figcaption>
                <p className="text-base font-semibold">{n}</p>
                <p className="text-[13px]" style={{ color: MUTED }}>{r}</p>
              </figcaption>
              <p className="text-sm font-bold" style={{ color: "#FFB800" }} aria-label="5 sao">★★★★★</p>
              <blockquote className="text-[15px]" style={{ color: MUTED }}>{q}</blockquote>
            </figure>
          ))}
          <article className="rounded-3xl p-7 text-white flex flex-col justify-between min-h-[260px]" style={{ background: ACCENT }}>
            <p className="text-sm font-bold">4.8/5 • ĐIỂM HÀI LÒNG DỊCH VỤ (DEMO)</p>
            <div>
              <p className="text-xl font-medium">Được tin chọn bởi các Chủ shop, Hộ kinh doanh & Doanh nghiệp SME trên toàn quốc.</p>
              <p className="text-sm mt-3">Đồng hành tận tâm • Ngân sách minh bạch</p>
            </div>
          </article>
          {REVIEWS.slice(3).map(([n, r, q]) => (
            <figure key={n} className="rounded-3xl bg-white border border-black/5 p-7 space-y-3">
              <figcaption>
                <p className="text-base font-semibold">{n}</p>
                <p className="text-[13px]" style={{ color: MUTED }}>{r}</p>
              </figcaption>
              <p className="text-sm font-bold" style={{ color: "#FFB800" }} aria-label="5 sao">★★★★★</p>
              <blockquote className="text-[15px]" style={{ color: MUTED }}>{q}</blockquote>
            </figure>
          ))}
        </div>
      </section>

      {/* 11 CTA */}
      <section id="contact" className="mx-auto max-w-[1280px] px-5 md:px-0 py-20 text-center space-y-6">
        <div className="flex justify-center"><Eyebrow>Bắt đầu cùng PGS Agency</Eyebrow></div>
        <h2 className="text-3xl md:text-5xl leading-[1.1] tracking-tight max-w-[900px] mx-auto">Sẵn sàng bứt phá doanh số và thương hiệu cùng PGS?</h2>
        <p style={{ color: MUTED }} className="max-w-[640px] mx-auto">Nhận tư vấn lộ trình Marketing sát với ngân sách và mục tiêu thực tế của bạn.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Btn href="#contact" dark>Đăng ký tư vấn ngay</Btn>
          <Btn href="#contact">Chat trực tiếp qua Zalo</Btn>
        </div>
      </section>

      {/* 12 Footer */}
      <footer className="border-t border-black/5 py-14" style={{ background: "#FCFCFC" }}>
        <div className="mx-auto max-w-[1280px] px-5 md:px-0 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-3">
            <p className="text-[22px] font-semibold">PGS Agency</p>
            <p className="text-[15px]" style={{ color: MUTED }}>Đối tác Digital Marketing toàn diện cho Cá nhân, Chủ shop và Doanh nghiệp SME trên toàn quốc.</p>
          </div>
          <div className="space-y-3">
            <p className="text-[17px] font-semibold">Điều hướng</p>
            {["Trang chủ", "Về chúng tôi", "Dịch vụ", "Case Study", "Blog", "Liên hệ"].map((t) => (
              <p key={t} className="text-[15px]" style={{ color: MUTED }}>{t}</p>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-[17px] font-semibold">Năng lực Marketing</p>
            {["Website & Landing Page", "SEO & Google", "Digital Advertising", "Social Media", "Marketing & PR"].map((t) => (
              <p key={t} className="text-[15px]" style={{ color: MUTED }}>{t}</p>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-[17px] font-semibold">Liên hệ PGS Agency</p>
            <p className="text-[15px]" style={{ color: MUTED }}>Thị trường: Toàn quốc Việt Nam</p>
            <p className="text-[15px]" style={{ color: MUTED }}>Hotline: 09xx.xxx.xxx (Demo)</p>
            <p className="text-[15px]" style={{ color: MUTED }}>Email: contact@pgs.vn (Demo)</p>
            <p className="text-[15px] font-medium" style={{ color: ACCENT }}>Kênh hỗ trợ: Zalo OA PGS Agency</p>
          </div>
        </div>
        <p className="mx-auto max-w-[1280px] px-5 md:px-0 mt-10 text-sm" style={{ color: MUTED }}>
          Copyright © PGS Agency – Giải pháp Digital Marketing thực chiến.
        </p>
      </footer>
    </main>
  );
}
