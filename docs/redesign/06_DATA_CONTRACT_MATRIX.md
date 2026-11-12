# 06 · DATA CONTRACT MATRIX

Sinh tự động từ mã nguồn nhánh `feat/pgs-hub-v2-full-role-redesign` (baseline `figma-update@fddab40`). Mức xác minh: **API CONTRACT VERIFIED (đọc code)** · LIVE DATA chỉ xác minh cho các luồng ghi ở 01_REPO_AUDIT §5.

## Endpoint API theo controller (222 endpoint)

| Controller | Method | Path | Handler | @Roles |
|---|---|---|---|---|
| accountant-dashboard/accountant-dashboard.controller.ts | GET | `/accountant/dashboard` | getDashboard | (guard mặc định) |
| admin/admin.controller.ts | GET | `/admin/users/pending` | getPendingUsers | (guard mặc định) |
| admin/admin.controller.ts | POST | `/admin/users/:userId/approve` | HttpCode | (guard mặc định) |
| admin/admin.controller.ts | POST | `/admin/users/:userId/reject` | HttpCode | (guard mặc định) |
| admin-dashboard/admin-dashboard.controller.ts | GET | `/admin/dashboard` | getDashboard | (guard mặc định) |
| attendance/attendance.controller.ts | POST | `/attendance/check-in` | checkIn | (guard mặc định) |
| attendance/attendance.controller.ts | POST | `/attendance/check-out` | checkOut | (guard mặc định) |
| attendance/attendance.controller.ts | GET | `/attendance/settings` | Roles | (guard mặc định) |
| attendance/attendance.controller.ts | PATCH | `/attendance/settings` | Roles | (guard mặc định) |
| attendance/attendance.controller.ts | GET | `/attendance/policy` | Roles | (guard mặc định) |
| attendance/attendance.controller.ts | GET | `/attendance/me` | getMyHistory | (guard mặc định) |
| attendance/attendance.controller.ts | GET | `/attendance/directory` | getDirectory | (guard mặc định) |
| attendance/attendance.controller.ts | POST | `/attendance/records/:id/adjust` | adjustRecord | (guard mặc định) |
| attendance/attendance.controller.ts | GET | `/attendance/summary` | getSummary | (guard mặc định) |
| attendance/attendance.controller.ts | POST | `/attendance/signed-upload` | getPhotoUploadSignature | (guard mặc định) |
| auth/auth.controller.ts | GET | `/auth/me` | UseGuards | (guard mặc định) |
| auth/auth.controller.ts | POST | `/auth/bootstrap-admin` | HttpCode | (guard mặc định) |
| automation/automation.controller.ts | GET | `/automation/rules` | listRules | (guard mặc định) |
| automation/automation.controller.ts | POST | `/automation/rules` | createRule | (guard mặc định) |
| automation/automation.controller.ts | PATCH | `/automation/rules/:id` | updateRule | (guard mặc định) |
| automation/automation.controller.ts | GET | `/automation/executions` | listExecutions | (guard mặc định) |
| automation/automation.controller.ts | POST | `/automation/events/manual` | runManualEvent | (guard mặc định) |
| automation/automation.controller.ts | POST | `/automation/run-scheduled` | runScheduled | (guard mặc định) |
| chat/chat.controller.ts | GET | `/chat/conversations` | listConversations | (guard mặc định) |
| chat/chat.controller.ts | GET | `/chat/unread-count` | unreadCount | (guard mặc định) |
| chat/chat.controller.ts | POST | `/chat/direct` | createDirect | (guard mặc định) |
| chat/chat.controller.ts | POST | `/chat/projects/:projectId` | getProjectConversation | (guard mặc định) |
| chat/chat.controller.ts | GET | `/chat/conversations/:id` | getConversation | (guard mặc định) |
| chat/chat.controller.ts | GET | `/chat/conversations/:id/messages` | listMessages | (guard mặc định) |
| chat/chat.controller.ts | POST | `/chat/conversations/:id/messages` | sendMessage | (guard mặc định) |
| chat/chat.controller.ts | POST | `/chat/conversations/:id/read` | markRead | (guard mặc định) |
| client-dashboard/client-dashboard.controller.ts | GET | `/client/dashboard` | getDashboard | (guard mặc định) |
| clients/clients.controller.ts | GET | `/client/me/companies` | Roles | (guard mặc định) |
| clients/clients.controller.ts | GET | `/admin/clients` | Roles | (guard mặc định) |
| clients/clients.controller.ts | GET | `/admin/clients/:clientId` | Roles | (guard mặc định) |
| clients/clients.controller.ts | POST | `/admin/clients` | Roles | (guard mặc định) |
| clients/clients.controller.ts | PATCH | `/admin/clients/:clientId` | Roles | (guard mặc định) |
| clients/clients.controller.ts | DELETE | `/admin/clients/:clientId` | Roles | (guard mặc định) |
| clients/clients.controller.ts | GET | `/admin/clients/:clientId/members` | Roles | (guard mặc định) |
| clients/clients.controller.ts | POST | `/admin/clients/:clientId/members` | Roles | (guard mặc định) |
| clients/clients.controller.ts | PATCH | `/admin/clients/:clientId/members/:membershipId` | Roles | (guard mặc định) |
| clients/clients.controller.ts | DELETE | `/admin/clients/:clientId/members/:membershipId` | Roles | (guard mặc định) |
| documents/documents.controller.ts | GET | `/documents` | Roles | (guard mặc định) |
| documents/documents.controller.ts | POST | `/documents/upload-session` | Roles | (guard mặc định) |
| documents/documents.controller.ts | POST | `/documents/finalize` | Roles | (guard mặc định) |
| documents/documents.controller.ts | GET | `/documents/:id/download` | Roles | (guard mặc định) |
| documents/documents.controller.ts | DELETE | `/documents/:id` | Roles | (guard mặc định) |
| employee-dashboard/employee-dashboard.controller.ts | GET | `/employee/dashboard` | getDashboard | (guard mặc định) |
| expenses/expenses.controller.ts | GET | `/expenses` | Roles | (guard mặc định) |
| expenses/expenses.controller.ts | GET | `/expenses/:id` | Roles | (guard mặc định) |
| expenses/expenses.controller.ts | POST | `/expenses` | Roles | (guard mặc định) |
| expenses/expenses.controller.ts | POST | `/expenses/:id/review` | Roles | (guard mặc định) |
| expenses/expenses.controller.ts | POST | `/expenses/:id/reimburse` | Roles | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/summary` | getSummary | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/meta/clients` | getMetaClients | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/meta/projects` | getMetaProjects | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/meta/contracts` | getMetaContracts | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/contracts` | getContracts | (guard mặc định) |
| finance/finance.controller.ts | POST | `/finance/contracts` | createContract | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/contracts/:id` | getContractById | (guard mặc định) |
| finance/finance.controller.ts | PATCH | `/finance/contracts/:id` | updateContract | (guard mặc định) |
| finance/finance.controller.ts | POST | `/finance/contracts/:id/transition` | transitionContract | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/invoices` | getInvoices | (guard mặc định) |
| finance/finance.controller.ts | POST | `/finance/invoices` | createInvoice | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/invoices/:id` | getInvoiceById | (guard mặc định) |
| finance/finance.controller.ts | PATCH | `/finance/invoices/:id` | updateInvoice | (guard mặc định) |
| finance/finance.controller.ts | POST | `/finance/invoices/:id/transition` | transitionInvoice | (guard mặc định) |
| finance/finance.controller.ts | POST | `/finance/invoices/:id/payments` | recordPayment | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/invoices/:id/payments` | getPayments | (guard mặc định) |
| finance/finance.controller.ts | GET | `/finance/audit` | getAuditLogs | (guard mặc định) |
| health/health.controller.ts | GET | `/health` | getHealth | (guard mặc định) |
| leave/leave.controller.ts | GET | `/leave/types` | getLeaveTypes | (guard mặc định) |
| leave/leave.controller.ts | POST | `/leave/requests` | createRequest | (guard mặc định) |
| leave/leave.controller.ts | GET | `/leave/me/requests` | getMyRequests | (guard mặc định) |
| leave/leave.controller.ts | GET | `/leave/me/balances` | getMyBalances | (guard mặc định) |
| leave/leave.controller.ts | GET | `/leave/directory` | getDirectory | (guard mặc định) |
| leave/leave.controller.ts | POST | `/leave/requests/:id/review` | reviewRequest | (guard mặc định) |
| leave/leave.controller.ts | POST | `/leave/requests/:id/cancel` | cancelRequest | (guard mặc định) |
| leave/leave.controller.ts | POST | `/leave/balances/:id/adjust` | adjustBalance | (guard mặc định) |
| leave/leave.controller.ts | GET | `/leave/calendar` | getCalendar | (guard mặc định) |
| notifications/notifications.controller.ts | GET | `/notifications` | list | (guard mặc định) |
| notifications/notifications.controller.ts | POST | `/notifications/broadcast` | Roles | (guard mặc định) |
| notifications/notifications.controller.ts | GET | `/notifications/unread-count` | unreadCount | (guard mặc định) |
| notifications/notifications.controller.ts | PATCH | `/notifications/:id/read` | markRead | (guard mặc định) |
| notifications/notifications.controller.ts | POST | `/notifications/read-all` | markAllRead | (guard mặc định) |
| notifications/notifications.controller.ts | GET | `/notifications/preferences` | getPreferences | (guard mặc định) |
| notifications/notifications.controller.ts | PATCH | `/notifications/preferences` | updatePreferences | (guard mặc định) |
| organization/departments.controller.ts | GET | `/admin/departments` | getDepartments | (guard mặc định) |
| organization/departments.controller.ts | GET | `/admin/departments/:id` | getDepartmentById | (guard mặc định) |
| organization/departments.controller.ts | POST | `/admin/departments` | createDepartment | (guard mặc định) |
| organization/departments.controller.ts | PATCH | `/admin/departments/:id` | updateDepartment | (guard mặc định) |
| organization/teams.controller.ts | GET | `/admin/teams` | getTeams | (guard mặc định) |
| organization/teams.controller.ts | GET | `/admin/teams/:id` | getTeamById | (guard mặc định) |
| organization/teams.controller.ts | POST | `/admin/teams` | createTeam | (guard mặc định) |
| organization/teams.controller.ts | PATCH | `/admin/teams/:id` | updateTeam | (guard mặc định) |
| payroll/payroll.controller.ts | GET | `/payroll/runs` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | GET | `/payroll/runs/:id` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | GET | `/payroll/compensations` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | GET | `/payroll/compensations/:userId/history` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | POST | `/payroll/compensations/:userId/revisions` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | PUT | `/payroll/compensations/:userId` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | GET | `/payroll/monthly-reviews` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | PUT | `/payroll/monthly-reviews/:userId` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | POST | `/payroll/runs/generate` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | POST | `/payroll/runs/:id/approve` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | POST | `/payroll/runs/:id/pay` | Roles | (guard mặc định) |
| payroll/payroll.controller.ts | GET | `/payroll/me/payslips` | Roles | (guard mặc định) |
| people/people.controller.ts | GET | `/me/organization` | getMeOrganization | (guard mặc định) |
| people/people.controller.ts | PATCH | `/me/profile` | updateMyProfile | (guard mặc định) |
| people/people.controller.ts | GET | `/team/members` | Roles | (guard mặc định) |
| people/people.controller.ts | GET | `/admin/people` | Roles | (guard mặc định) |
| people/people.controller.ts | GET | `/admin/people/:userId` | Roles | (guard mặc định) |
| people/people.controller.ts | POST | `/admin/people/:userId/employment` | Roles | (guard mặc định) |
| people/people.controller.ts | PATCH | `/admin/people/:userId/employment` | Roles | (guard mặc định) |
| people/people.controller.ts | PATCH | `/admin/people/:userId/full` | Roles | (guard mặc định) |
| people/people.controller.ts | POST | `/admin/people/:userId/terminate` | Roles | (guard mặc định) |
| people/people.controller.ts | GET | `/admin/people/:userId/projects` | Roles | (guard mặc định) |
| people/people.controller.ts | POST | `/admin/people/:userId/projects` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/admin/projects` | Roles | (guard mặc định) |
| projects/projects.controller.ts | POST | `/admin/projects` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/admin/projects/:projectId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | PATCH | `/admin/projects/:projectId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | DELETE | `/admin/projects/:projectId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/admin/projects/:projectId/members` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/projects/:projectId/members` | Roles | (guard mặc định) |
| projects/projects.controller.ts | POST | `/admin/projects/:projectId/members` | Roles | (guard mặc định) |
| projects/projects.controller.ts | PATCH | `/admin/projects/:projectId/members/:membershipId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | DELETE | `/admin/projects/:projectId/members/:membershipId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/admin/projects/:projectId/services` | Roles | (guard mặc định) |
| projects/projects.controller.ts | POST | `/admin/projects/:projectId/services` | Roles | (guard mặc định) |
| projects/projects.controller.ts | PATCH | `/admin/projects/:projectId/services/:projectServiceId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | DELETE | `/admin/projects/:projectId/services/:projectServiceId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/projects/:projectId/service-items` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/projects/:projectId/services/:projectServiceId/items` | Roles | (guard mặc định) |
| projects/projects.controller.ts | PATCH | `/projects/:projectId/service-items/:itemId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/projects` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/projects/:projectId` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/client/me/projects` | Roles | (guard mặc định) |
| projects/projects.controller.ts | GET | `/client/me/projects/:projectId` | Roles | (guard mặc định) |
| services/service-categories.controller.ts | GET | `/admin/service-categories` | getCategories | (guard mặc định) |
| services/service-categories.controller.ts | GET | `/admin/service-categories/:id` | getCategoryById | (guard mặc định) |
| services/service-categories.controller.ts | POST | `/admin/service-categories` | createCategory | (guard mặc định) |
| services/service-categories.controller.ts | PATCH | `/admin/service-categories/:id` | updateCategory | (guard mặc định) |
| services/service-categories.controller.ts | DELETE | `/admin/service-categories/:id` | deactivateCategory | (guard mặc định) |
| services/services.controller.ts | GET | `/admin/services` | getServices | (guard mặc định) |
| services/services.controller.ts | GET | `/admin/services/:id` | getServiceById | (guard mặc định) |
| services/services.controller.ts | POST | `/admin/services` | createService | (guard mặc định) |
| services/services.controller.ts | PATCH | `/admin/services/:id` | updateService | (guard mặc định) |
| services/services.controller.ts | DELETE | `/admin/services/:id` | deactivateService | (guard mặc định) |
| services/services.controller.ts | GET | `/admin/services/:serviceId/responsibilities` | getServiceResponsibilities | (guard mặc định) |
| services/services.controller.ts | PATCH | `/admin/services/:serviceId/responsibilities` | updateServiceResponsibilities | (guard mặc định) |
| services/services.controller.ts | GET | `/admin/services/:serviceId/delivery-items` | getDeliveryItems | (guard mặc định) |
| services/services.controller.ts | POST | `/admin/services/:serviceId/delivery-items` | createDeliveryItem | (guard mặc định) |
| services/services.controller.ts | PATCH | `/admin/services/:serviceId/delivery-items/:itemId` | updateDeliveryItem | (guard mặc định) |
| services/services.controller.ts | DELETE | `/admin/services/:serviceId/delivery-items/:itemId` | deleteDeliveryItem | (guard mặc định) |
| settings/settings.controller.ts | GET | `/admin/settings` | Roles | (guard mặc định) |
| settings/settings.controller.ts | POST | `/admin/settings` | Roles | (guard mặc định) |
| settings/settings.controller.ts | PATCH | `/admin/settings/bulk` | Roles | (guard mặc định) |
| support/support.controller.ts | GET | `/support/tickets` | Roles | (guard mặc định) |
| support/support.controller.ts | GET | `/support/tickets/:id` | Roles | (guard mặc định) |
| support/support.controller.ts | POST | `/support/tickets` | Roles | (guard mặc định) |
| support/support.controller.ts | POST | `/support/tickets/:id/messages` | Roles | (guard mặc định) |
| support/support.controller.ts | PATCH | `/support/tickets/:id/status` | Roles | (guard mặc định) |
| tasks/tasks.controller.ts | GET | `/projects/:projectId/tasks` | getTasks | (guard mặc định) |
| tasks/tasks.controller.ts | POST | `/projects/:projectId/tasks` | createTask | (guard mặc định) |
| tasks/tasks.controller.ts | GET | `/projects/:projectId/tasks/:taskId` | getTask | (guard mặc định) |
| tasks/tasks.controller.ts | POST | `/projects/:projectId/tasks/:taskId/approval` | reviewTaskProposal | (guard mặc định) |
| tasks/tasks.controller.ts | PATCH | `/projects/:projectId/tasks/:taskId` | updateTask | (guard mặc định) |
| team-leader-dashboard/team-leader-dashboard.controller.ts | GET | `/team-leader/dashboard` | getDashboard | (guard mặc định) |
| work-calendar/work-calendar.controller.ts | GET | `/work-calendar` | Roles | (guard mặc định) |
| work-calendar/work-calendar.controller.ts | GET | `/admin/work-calendar/settings` | Roles | (guard mặc định) |
| work-calendar/work-calendar.controller.ts | PATCH | `/admin/work-calendar/settings` | Roles | (guard mặc định) |
| work-calendar/work-calendar.controller.ts | GET | `/admin/work-calendar/events` | Roles | (guard mặc định) |
| work-calendar/work-calendar.controller.ts | POST | `/admin/work-calendar/events` | Roles | (guard mặc định) |
| work-calendar/work-calendar.controller.ts | PATCH | `/admin/work-calendar/events/:eventId` | Roles | (guard mặc định) |
| work-calendar/work-calendar.controller.ts | DELETE | `/admin/work-calendar/events/:eventId` | Roles | (guard mặc định) |
| work-calendar/work-calendar.controller.ts | POST | `/admin/work-calendar/sync-holidays` | Roles | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | GET | `/projects/:projectId/workflows` | getProjectWorkflows | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | POST | `/projects/:projectId/workflows/project-services/:projectServiceId/instantiate` | instantiateWorkflow | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | POST | `/projects/:projectId/workflows/:workflowId/start` | startWorkflow | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | POST | `/projects/:projectId/workflows/stages/:stageId/start` | startStage | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | POST | `/projects/:projectId/workflows/stages/:stageId/complete` | completeStage | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | POST | `/projects/:projectId/workflows/items/:itemId/complete` | completeItem | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | POST | `/projects/:projectId/workflows/dependencies/:dependencyId/override` | overrideDependency | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | GET | `/projects/:projectId/workflows/:workflowId/approvals` | listApprovals | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | POST | `/projects/:projectId/workflows/:workflowId/approvals` | requestApproval | (guard mặc định) |
| workflows/workflow-runtime.controller.ts | POST | `/projects/:projectId/workflows/:workflowId/approvals/:approvalId/respond` | respondApproval | (guard mặc định) |
| workflows/workflow-template.controller.ts | GET | `/admin/workflows/templates` | listTemplates | (guard mặc định) |
| workflows/workflow-template.controller.ts | GET | `/admin/workflows/templates/:id` | getTemplate | (guard mặc định) |
| workflows/workflow-template.controller.ts | GET | `/admin/workflows/templates/:id/validate` | validateTemplate | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | PATCH | `/admin/workflows/templates/:id` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates/:id/clone` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates/:id/publish` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates/:id/set-default` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates/:id/archive` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates/:id/stages` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates/:id/stages/reorder` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | PATCH | `/admin/workflows/stages/:stageId` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | DELETE | `/admin/workflows/stages/:stageId` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/stages/:stageId/items` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | PATCH | `/admin/workflows/stage-items/:itemId` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | DELETE | `/admin/workflows/stage-items/:itemId` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates/:id/stage-dependencies` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | DELETE | `/admin/workflows/stage-dependencies/:id` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | POST | `/admin/workflows/templates/:id/item-dependencies` | Roles | (guard mặc định) |
| workflows/workflow-template.controller.ts | DELETE | `/admin/workflows/item-dependencies/:id` | Roles | (guard mặc định) |
| workspace/comments.controller.ts | GET | `/projects/:projectId/tasks/:taskId/comments` | list | (guard mặc định) |
| workspace/comments.controller.ts | POST | `/projects/:projectId/tasks/:taskId/comments` | create | (guard mặc định) |
| workspace/comments.controller.ts | PATCH | `/projects/:projectId/tasks/:taskId/comments/:commentId` | update | (guard mặc định) |
| workspace/comments.controller.ts | DELETE | `/projects/:projectId/tasks/:taskId/comments/:commentId` | remove | (guard mặc định) |
| workspace/files.controller.ts | GET | `/projects/:projectId/files` | listProjectFiles | (guard mặc định) |
| workspace/files.controller.ts | POST | `/projects/:projectId/files/upload-request` | requestProjectUpload | (guard mặc định) |
| workspace/files.controller.ts | POST | `/projects/:projectId/files/finalize` | finalizeProjectUpload | (guard mặc định) |
| workspace/files.controller.ts | GET | `/projects/:projectId/files/:fileId/download` | download | (guard mặc định) |
| workspace/files.controller.ts | DELETE | `/projects/:projectId/files/:fileId` | remove | (guard mặc định) |
| workspace/files.controller.ts | GET | `/projects/:projectId/tasks/:taskId/files` | listTaskFiles | (guard mặc định) |
| workspace/files.controller.ts | POST | `/projects/:projectId/tasks/:taskId/files/upload-request` | requestTaskUpload | (guard mặc định) |
| workspace/files.controller.ts | POST | `/projects/:projectId/tasks/:taskId/files/finalize` | finalizeTaskUpload | (guard mặc định) |
| workspace/workspace.controller.ts | GET | `/projects/:projectId/board` | getBoard | (guard mặc định) |
| workspace/workspace.controller.ts | GET | `/projects/:projectId/calendar` | getCalendar | (guard mặc định) |
| workspace/workspace.controller.ts | POST | `/projects/:projectId/tasks/:taskId/move` | moveTask | (guard mặc định) |

## Trang web → lời gọi API phía client

| Route | Lời gọi API trong page | Component chính |
|---|---|---|
| `/` | — | ui/card, ui/button, ui/badge |
| `/account/pending` | — | ui/card, ui/button, ui/badge |
| `/account/rejected` | — | ui/card, ui/button, ui/badge |
| `/app` | — | — |
| `/app/accountant` | — | dashboard/figma-widgets |
| `/app/accountant/attendance` | organizationApi.getDepartments, organizationApi.getTeams, attendanceApi.getDirectory, attendanceApi.getSummary, attendanceApi.getMyHistory, attendanceApi.checkIn, attendanceApi.checkOut | dashboard/section-header, dashboard/stat-card, ui/button, ui/badge |
| `/app/accountant/clients` | clientsApi.getClientCompanies | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/accountant/finance` | — | finance/FinanceDashboard |
| `/app/accountant/finance/cashflow` | — | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/accountant/finance/contracts` | — | finance/ContractsWorkspace |
| `/app/accountant/finance/contracts/[id]` | — | finance/ContractDetail |
| `/app/accountant/finance/debts` | — | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/accountant/finance/invoices` | — | finance/InvoicesWorkspace |
| `/app/accountant/finance/invoices/[id]` | — | finance/InvoiceDetail |
| `/app/accountant/finance/payments` | — | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/accountant/finance/project-expenses` | projectsApi.getAdminProjects | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/accountant/payroll` | — | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/accountant/reports` | — | dashboard/section-header, ui/card, ui/button |
| `/app/accountant/vouchers` | — | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/admin` | adminDashboardApi.get | dashboard/figma-widgets |
| `/app/admin/accounts/pending` | — | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/admin/attendance` | organizationApi.getDepartments, organizationApi.getTeams, attendanceApi.getDirectory, attendanceApi.adjustRecord | dashboard/section-header, dashboard/stat-card, ui/button, ui/badge |
| `/app/admin/automation` | — | phase7/automation-workspace |
| `/app/admin/calendar` | — | tasks/task-module-header, ui/month-calendar |
| `/app/admin/clients` | clientsApi.getClientCompanies, clientsApi.createClientCompany, clientsApi.updateClientCompany, clientsApi.deleteClientCompany | dashboard/section-header, ui/button, ui/badge, ui/dialog |
| `/app/admin/clients/[clientId]` | clientsApi.getClientCompanyById, clientsApi.getMemberships, peopleApi.getPeopleDirectory, clientsApi.createMembership, clientsApi.deleteMembership, clientsApi.updateMembership, clientsApi.updateClientCompany | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/admin/departments` | organizationApi.getDepartments, organizationApi.createDepartment, organizationApi.updateDepartment | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/admin/documents` | organizationApi.getDepartments | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/admin/finance` | — | finance/FinanceDashboard |
| `/app/admin/finance/contracts` | — | finance/ContractsWorkspace |
| `/app/admin/finance/contracts/[id]` | — | finance/ContractDetail |
| `/app/admin/finance/invoices` | — | finance/InvoicesWorkspace |
| `/app/admin/finance/invoices/[id]` | — | finance/InvoiceDetail |
| `/app/admin/kanban` | — | tasks/cross-project-tasks |
| `/app/admin/leave` | leaveApi.getDirectory, leaveApi.getCalendar, leaveApi.reviewRequest | dashboard/section-header, dashboard/stat-card, ui/button, ui/badge |
| `/app/admin/organization` | — | dashboard/section-header, ui/card, ui/button |
| `/app/admin/people` | peopleApi.getPeopleDirectory, organizationApi.getDepartments, organizationApi.getTeams, projectsApi.getAdminProjects, peopleApi.updatePersonFull, peopleApi.getUserProjects, peopleApi.assignUserProjects, peopleApi.terminatePerson | dashboard/section-header, ui/button, ui/badge, ui/avatar |
| `/app/admin/people/[userId]` | peopleApi.getPersonByUserId, organizationApi.getDepartments, organizationApi.getTeams, peopleApi.getPeopleDirectory, peopleApi.createEmploymentProfile, peopleApi.updateEmploymentProfile | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/admin/projects` | — | phase3/project-list-view |
| `/app/admin/projects/[projectId]` | — | phase3/project-detail-view |
| `/app/admin/projects/[projectId]/board` | — | phase4/project-board-view |
| `/app/admin/projects/[projectId]/calendar` | — | phase4/project-calendar-view |
| `/app/admin/projects/[projectId]/files` | — | phase4/project-files-view |
| `/app/admin/projects/[projectId]/tasks/[taskId]` | — | phase4/task-detail-view |
| `/app/admin/projects/completed` | projectsApi.getAdminProjects | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/admin/reports` | — | dashboard/section-header, ui/card, ui/button |
| `/app/admin/services` | — | phase3/service-catalog-view |
| `/app/admin/settings` | attendanceApi.getSettings, attendanceApi.updateSettings | dashboard/section-header, ui/card, ui/button |
| `/app/admin/settings/work-calendar` | workCalendarApi.getSettings, workCalendarApi.getEvents, workCalendarApi.updateSettings, workCalendarApi.syncHolidays, workCalendarApi.updateEvent, workCalendarApi.createEvent, workCalendarApi.deleteEvent | dashboard/section-header, ui/card, ui/button, ui/dialog |
| `/app/admin/tasks` | — | tasks/cross-project-tasks |
| `/app/admin/teams` | organizationApi.getDepartments, organizationApi.createTeam, organizationApi.updateTeam | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/admin/workflows` | — | workflows/workflow-builder |
| `/app/attendance` | attendanceApi.getPolicy, attendanceApi.getSummary, attendanceApi.getMyHistory, attendanceApi.checkIn, attendanceApi.checkOut | dashboard/section-header, dashboard/stat-card, ui/card, ui/button |
| `/app/chat` | — | phase7/chat-workspace |
| `/app/client` | clientDashboardApi.get | dashboard/figma-widgets |
| `/app/client/approvals` | — | dashboard/section-header, ui/card, ui/empty-state |
| `/app/client/contracts` | financeApi.getContracts | dashboard/section-header, ui/card, ui/badge, ui/button |
| `/app/client/documents` | — | dashboard/section-header, ui/card, ui/empty-state |
| `/app/client/invoices` | financeApi.getInvoices | dashboard/section-header, ui/card, ui/badge, ui/button |
| `/app/client/meetings` | — | dashboard/section-header, ui/card, ui/empty-state |
| `/app/client/payments` | financeApi.getInvoices | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/client/projects` | — | phase3/project-list-view |
| `/app/client/projects/[projectId]` | — | phase3/project-detail-view |
| `/app/client/projects/completed` | projectsApi.getClientProjects | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/client/support` | — | dashboard/section-header, ui/card, ui/button, ui/badge |
| `/app/employee` | employeeDashboardApi.get | dashboard/figma-widgets |
| `/app/employee/calendar` | — | dashboard/section-header, ui/month-calendar |
| `/app/employee/documents` | — | dashboard/section-header, ui/card, ui/empty-state |
| `/app/employee/payroll` | — | dashboard/section-header, ui/card, ui/badge, ui/empty-state |
| `/app/employee/projects` | projectsApi.getInternalProjects | dashboard/section-header, ui/card, ui/badge, ui/empty-state |
| `/app/employee/projects/completed` | projectsApi.getInternalProjects | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/employee/reports` | — | dashboard/section-header, ui/card, ui/button |
| `/app/employee/tasks` | projectsApi.getInternalProjects, tasksApi.list, tasksApi.update, tasksApi.create | dashboard/section-header, ui/button, ui/dialog, ui/input |
| `/app/leave` | leaveApi.getLeaveTypes, leaveApi.getMyBalances, leaveApi.getMyRequests, leaveApi.createRequest | dashboard/section-header, dashboard/stat-card, ui/button, ui/badge |
| `/app/notifications` | — | phase7/notifications-center |
| `/app/profile` | peopleApi.getMyOrganization, peopleApi.updateMyProfile | dashboard/section-header, ui/card, ui/badge, ui/button |
| `/app/projects` | — | phase3/project-list-view |
| `/app/projects/[projectId]` | — | phase3/project-detail-view |
| `/app/projects/[projectId]/board` | — | phase4/project-board-view |
| `/app/projects/[projectId]/calendar` | — | phase4/project-calendar-view |
| `/app/projects/[projectId]/files` | — | phase4/project-files-view |
| `/app/projects/[projectId]/tasks/[taskId]` | — | phase4/task-detail-view |
| `/app/team-leader` | teamLeaderDashboardApi.get | dashboard/figma-widgets |
| `/app/team-leader/approvals` | leaveApi.getDirectory, projectsApi.getInternalProjects, tasksApi.list, leaveApi.reviewRequest, tasksApi.reviewProposal, tasksApi.update | dashboard/section-header, ui/empty-state, ui/state-banner, ui/table |
| `/app/team-leader/attendance` | — | — |
| `/app/team-leader/calendar` | — | tasks/task-module-header, ui/month-calendar |
| `/app/team-leader/clients` | clientsApi.getClientCompanies, clientsApi.createClientCompany | dashboard/section-header, ui/button, ui/dialog, ui/input |
| `/app/team-leader/documents` | — | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/team-leader/kanban` | — | tasks/cross-project-tasks |
| `/app/team-leader/projects` | clientsApi.getClientCompanies | dashboard/section-header, ui/empty-state, ui/select, dashboard/figma-widgets |
| `/app/team-leader/projects/completed` | projectsApi.getInternalProjects | dashboard/section-header, ui/card, ui/button, ui/empty-state |
| `/app/team-leader/reports` | — | dashboard/section-header, ui/card, ui/button |
| `/app/team-leader/tasks` | — | tasks/cross-project-tasks |
| `/app/team-leader/teams` | organizationApi.getTeams | dashboard/section-header, ui/card, ui/badge, ui/empty-state |
| `/auth/forgot-password` | — | ui/button |
| `/auth/login` | — | — |
| `/auth/reset-password` | — | — |
| `/auth/resolve` | — | ui/card, ui/button |
| `/auth/sign-up` | — | ui/button |
| `/auth/update-password` | — | ui/button |

## Bảng dữ liệu (69)

`account_approval_events` · `attendance_adjustments` · `attendance_photo_upload_sessions` · `attendance_records` · `attendance_settings` · `automation_executions` · `automation_rules` · `chat_conversations` · `chat_members` · `chat_messages` · `client_companies` · `client_memberships` · `company_documents` · `company_holiday_sync_runs` · `company_work_calendar_events` · `company_work_calendar_settings` · `contracts` · `departments` · `employee_compensation_history` · `employee_compensation_settings` · `employee_monthly_payroll_reviews` · `employee_profiles` · `file_upload_sessions` · `finance_audit_events` · `invoice_payments` · `invoices` · `leave_balance_adjustments` · `leave_balances` · `leave_requests` · `leave_types` · `notification_preferences` · `notifications` · `payroll_runs` · `payslips` · `permissions` · `profiles` · `project_expenses` · `project_files` · `project_memberships` · `project_service_items` · `project_services` · `project_workflow_item_dependencies` · `project_workflow_stage_dependencies` · `project_workflow_stage_items` · `project_workflow_stages` · `project_workflow_task_links` · `project_workflows` · `projects` · `role_permissions` · `roles` · `service_categories` · `service_delivery_items` · `service_department_assignments` · `service_team_assignments` · `services` · `support_ticket_messages` · `support_tickets` · `system_settings` · `task_comments` · `tasks` · `teams` · `user_role_assignments` · `workflow_approval_requests` · `workflow_audit_events` · `workflow_template_item_dependencies` · `workflow_template_stage_dependencies` · `workflow_template_stage_items` · `workflow_template_stages` · `workflow_templates`

Migration: 67 · lệnh bật RLS: 88 · `create policy` trong migration: 6 (phần lớn truy cập đi qua API NestJS với service key + kiểm tra quyền ở service).
