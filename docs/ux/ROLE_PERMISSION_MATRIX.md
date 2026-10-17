# Role Permission Matrix (rút từ source)

Nguồn chính thức vẫn là `docs/ROLE_MATRIX.md` và `docs/audit/RBAC_SECURITY_MATRIX.md`. Tài liệu này chỉ ghi những điểm đã xác minh trong lần audit này.

| Tài nguyên                                        | Admin | Team Leader | Employee | Accountant | Client                                                    |
| ------------------------------------------------- | ----- | ----------- | -------- | ---------- | --------------------------------------------------------- |
| `GET /tasks` (tổng hợp)                           | ✔     | ✔           | ✔        | ✔          | ✘                                                         |
| `GET /projects/:id/tasks` (`@Roles` ở controller) | ✔     | ✔           | ✔        | ✔          | khai báo ✔ nhưng service ném 403 (`tasks.service.ts:472`) |
| `GET` client project                              | –     | –           | –        | –          | ✔ (kiểm `client_memberships`, IDOR có test)               |

Quy tắc đã giữ: không mở rộng RBAC/RLS để che 403. Client vẫn không được thấy task nội bộ; web được sửa để không gọi.
Lưu ý: decorator `@Roles(... 'client')` ở controller `projects/:projectId/tasks` mâu thuẫn với service từ chối client; nên bỏ `client` khỏi decorator để thống nhất (chưa đổi, cần chủ API xác nhận).

Phần còn lại của ma trận (200+ endpoint) chưa được đối chiếu lần này.
