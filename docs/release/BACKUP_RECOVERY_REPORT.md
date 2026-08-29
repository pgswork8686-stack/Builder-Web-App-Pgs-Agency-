# PGS HUB - BACKUP & DISASTER RECOVERY VALIDATION REPORT

**Date:** 2026-08-26
**Auditor:** PGS HUB Production Infrastructure Team
**Scope:** PostgreSQL Database Backup, File Storage Replication, Point-In-Time-Recovery (PITR) & Disaster Recovery Runbook

---

## 1. Database Backup & Retention Architecture

Hệ thống cơ sở dữ liệu Supabase / PostgreSQL trên Production áp dụng kiến trúc sao lưu đa tầng:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATABASE BACKUP STRATEGY                        │
├────────────────────────────────────────────────────────────────────────┤
│  1. Automated Daily Snapshots: Thực hiện lúc 02:00 UTC (09:00 AM VN)   │
│  2. Point-In-Time-Recovery (PITR): Ghi nhận Write-Ahead-Log (WAL) liên │
│     tục, cho phép khôi phục về bất kỳ giây nào trong 7 ngày qua.        │
│  3. Retention Policy: Lưu trữ 30 ngày đối với bản sao lưu hàng ngày.   │
│  4. Storage Redundancy: Lưu trữ phân tán địa lý (Multi-region S3).     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. File Storage Buckets Backup & Replication

| Bucket Name        | Loại dữ liệu                             | Quyền truy cập                   | Chính sách sao lưu                |
| ------------------ | ---------------------------------------- | -------------------------------- | --------------------------------- |
| **`documents`**    | Hợp đồng, biểu mẫu, tài liệu dự án       | Private (Signed URL qua Backend) | Daily Versioning & Lifecycle Rule |
| **`deliverables`** | Ấn phẩm bàn giao, file demo, bản vẽ      | Private (Client / Member token)  | Multi-AZ Object Replication       |
| **`attachments`**  | File đính kèm task, chat, support ticket | Private (Session scoped)         | 30-day Soft-delete retention      |
| **`avatars`**      | Ảnh đại diện người dùng                  | Public CDN cache                 | Cached via Cloudflare / Fastly    |

---

## 3. Restore & Disaster Recovery Verification Test

Đã tiến hành bài kiểm thử diễn tập khôi phục thảm họa (Disaster Recovery Drill):

1. **Khôi phục cấu trúc Schema & Dữ liệu (Schema Dump & Restore):**
   - Áp dụng các migration tuần tự từ `20260811100000_enterprise_foundation.sql` đến `20260826024721_production_audit_hardening.sql`.
   - Kết quả: Toàn bộ bảng, views, triggers, functions, và RLS policies được khởi tạo nguyên vẹn 100%.
2. **Khôi phục bản ghi RLS & Permissions:**
   - Ma trận phân quyền 8 roles và bảng liên kết `role_permissions` được khôi phục chính xác.
3. **Mục tiêu thời gian & điểm phục hồi (RPO / RTO):**
   - **RPO (Recovery Point Objective):** < 1 phút (nhờ WAL Streaming).
   - **RTO (Recovery Time Objective):** < 15 phút (triển khai lại toàn bộ cluster).
