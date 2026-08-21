# PGS HUB — Production Release Migration Manifest

## Historical Baseline Declared in This Repository

The following 43 migrations are declared by repository history as the database baseline (up to `20260819150700`). This release assessment did not contact a production database, so it does not independently verify that assertion.

1. `20260810170000_phase1_auth.sql`
2. `20260810180000_phase1_auth_fix_round1.sql`
3. `20260811090000_phase1_auth_final_security_fix.sql`
4. `20260811100000_phase1_final_rls_lockdown.sql`
5. `20260811110000_phase2_organization_people_clients.sql`
6. `20260811120000_phase2_fix_round1.sql`
7. `20260811143000_phase3_projects_services_tasks.sql`
8. `20260811170000_phase4_project_workspace.sql`
9. `20260811180000_phase4_fix_round1.sql`
10. `20260812100000_phase4_fix_round2.sql`
11. `20260812120000_phase5_attendance_leave.sql`
12. `20260812130000_phase5_fix_round1.sql`
13. `20260812140000_phase5_fix_round2.sql`
14. `20260812150000_phase5_fix_round3.sql`
15. `20260812160000_phase5_fix_round4_fk_indexes.sql`
16. `20260812170000_phase6_finance.sql`
17. `20260812180000_phase5_security_fix_round5.sql`
18. `20260812190000_phase6_finance_fix_round1.sql`
19. `20260812200000_phase7_notifications_chat_automation.sql`
20. `20260813070000_phase8_lockdown_security_definer_helpers.sql`
21. `20260813071000_phase8_fk_index_hardening.sql`
22. `20260818100000_fix_phase3_completion_trigger.sql`
23. `20260818160000_add_business_codes.sql`
24. `20260818161000_add_admin_readable_views.sql`
25. `20260818170000_harden_business_code_security.sql`
26. `20260818171000_fix_admin_view_service_role_privileges.sql`
27. `20260819032116_service_catalog_delivery_foundation.sql`
28. `20260819034520_add_pgs_departments_and_department_head.sql`
29. `20260819034609_harden_department_head_validator.sql`
30. `20260819100000_add_readable_companion_fk_codes.sql`
31. `20260819102206_company_work_calendar_foundation.sql`
32. `20260819102242_company_work_calendar_api_helpers.sql`
33. `20260819110000_add_additional_business_codes_and_companions.sql`
34. `20260819120000_clean_verification_test_data.sql`
35. `20260819140000_reconcile_service_catalog_business_codes.sql`
36. `20260819150000_service_responsibility_tables.sql`
37. `20260819150100_service_responsibility_triggers_and_seed.sql`
38. `20260819150200_service_responsibility_admin_view.sql`
39. `20260819150300_service_delivery_item_name_uniqueness.sql`
40. `20260819150400_seed_delivery_items_dv01_dv09.sql`
41. `20260819150500_seed_delivery_items_dv10_dv19.sql`
42. `20260819150600_seed_delivery_items_dv20_dv26.sql`
43. `20260819150700_harden_service_responsibility_functions.sql`

---

## Explicitly Excluded (Legacy / Unsafe / Do Not Apply)

- ❌ `20260819130000_phase10_all_missing_modules.sql`: Replaced with hardened, modular migrations below. NEVER apply this monolithic file.

---

## Release Candidate Migrations (To Apply in Staging & Production upon Approval)

### Group A: Workflow Engine V1

44. `20260820120000_workflow_engine_v1_foundation.sql`
45. `20260820123000_workflow_engine_v1_hardening.sql`
46. `20260820124000_workflow_engine_v1_runtime_hardening.sql`
47. `20260820125000_workflow_engine_v1_p2_closure.sql`

### Group B: Hardened Modular Phase 10 Replacements

48. `20260820130000_project_expenses_v1.sql` — Project expense requests & reimbursements (`CP_01...`)
49. `20260820131000_payroll_v1.sql` — Payroll runs (`BL_01...`) and payslips (`PL_01...`)
50. `20260820132000_company_documents_v1.sql` — Document management (`TL_01...`)
51. `20260820133000_support_v1.sql` — Support tickets (`YC_01...`) & ticket messages
52. `20260820134000_system_settings_v1.sql` — Persistent system configuration

### Group C: Performance Hardening

53. `20260820135000_release_db_performance_hardening.sql` — Drop duplicate indexes and verify FK indexing

### Group D: Security Hardening

54. `20260821050134_harden_security_definer_functions.sql` — Revokes browser execution of existing public `SECURITY DEFINER` functions and closes default function execution for the migration owner

### Group E: Payroll Compensation Inputs

55. `20260821071141_employee_compensation_settings.sql` — Backend-only employee salary and allowance inputs for payroll calculations; RLS enabled, browser roles revoked, and positive/non-negative amount constraints enforced

### Group F: Auth Profile Lookup Grant

56. `20260821081657_grant_authenticated_profile_lookup.sql` — Grants authenticated browser-scoped clients read access to `public.profiles`; row visibility remains constrained by the own-profile RLS policy

### Group G: Storage Buckets

57. `20260821082144_create_company_documents_storage_bucket.sql` — Registers the private `company-documents` Storage bucket used by the Company Documents upload/download API

### Group H: Payroll Run Integrity Hardening

58. `20260821082316_harden_payroll_run_integrity.sql` — Enforces database-level uniqueness on `payroll_runs(period_month)` to prevent duplicate runs for the same period, and introduces transactional atomic state machine functions (`approve_payroll_run`, `mark_payroll_run_paid`) to guarantee consistency between payroll runs and payslip payment statuses without partial failure leaks.
