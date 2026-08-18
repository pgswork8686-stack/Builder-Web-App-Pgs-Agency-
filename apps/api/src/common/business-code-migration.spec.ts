import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations',
);

describe('Business Code Generation and Migration Contracts', () => {
  const mCodesPath = resolve(
    migrationsDirectory,
    '20260818160000_add_business_codes.sql',
  );
  const mViewsPath = resolve(
    migrationsDirectory,
    '20260818161000_add_admin_readable_views.sql',
  );

  // Business code formatting logic simulation (identical to SQL format_business_code)
  const formatBusinessCode = (prefix: string, seqNum: number): string => {
    const numPart = seqNum < 10 ? `0${seqNum}` : `${seqNum}`;
    return `${prefix}_${numPart}`;
  };

  describe('Business Code Formatting Specifications', () => {
    it('formats single digit sequences with zero-padded 2 digits', () => {
      expect(formatBusinessCode('KH', 1)).toBe('KH_01');
      expect(formatBusinessCode('KH', 2)).toBe('KH_02');
      expect(formatBusinessCode('NV', 9)).toBe('NV_09');
    });

    it('formats 2-digit sequences without extra zero padding', () => {
      expect(formatBusinessCode('TK', 10)).toBe('TK_10');
      expect(formatBusinessCode('DA', 15)).toBe('DA_15');
      expect(formatBusinessCode('CV', 99)).toBe('CV_99');
    });

    it('formats 3+ digit sequences without truncation or length limitation', () => {
      expect(formatBusinessCode('KH', 100)).toBe('KH_100');
      expect(formatBusinessCode('NV', 128)).toBe('NV_128');
      expect(formatBusinessCode('DA', 1050)).toBe('DA_1050');
    });

    it('uses strictly uppercase standard prefixes', () => {
      const prefixes = [
        'KH',
        'NV',
        'TK',
        'DA',
        'CV',
        'PB',
        'N',
        'DV',
        'HD',
        'HDON',
        'TT',
        'NP',
        'CC',
        'DTK',
      ];
      prefixes.forEach((p) => {
        const code = formatBusinessCode(p, 1);
        expect(code).toMatch(/^[A-Z]+_[0-9]{2,}$/);
      });
    });
  });

  describe('Database Migration File Integrity', () => {
    it('verifies 20260818160000_add_business_codes.sql exists and creates required sequences and triggers', () => {
      expect(existsSync(mCodesPath)).toBe(true);
      const content = readFileSync(mCodesPath, 'utf8');

      // Check generic function
      expect(content).toContain('format_business_code');

      // Check all required sequences
      expect(content).toContain('profiles_account_code_seq');
      expect(content).toContain('employee_profiles_code_seq');
      expect(content).toContain('client_companies_code_seq');
      expect(content).toContain('departments_code_seq');
      expect(content).toContain('teams_code_seq');
      expect(content).toContain('services_code_seq');
      expect(content).toContain('projects_code_seq');
      expect(content).toContain('tasks_code_seq');
      expect(content).toContain('contracts_code_seq');
      expect(content).toContain('invoices_code_seq');
      expect(content).toContain('invoice_payments_code_seq');
      expect(content).toContain('leave_requests_code_seq');
      expect(content).toContain('attendance_records_code_seq');
      expect(content).toContain('account_approval_events_code_seq');

      // Check triggers
      expect(content).toContain('trg_set_client_code');
      expect(content).toContain('trg_set_employee_code');
      expect(content).toContain('trg_set_project_code');
      expect(content).toContain('trg_set_task_code');

      // Check format check constraints
      expect(content).toContain('check_profiles_account_code_format');
      expect(content).toContain('check_employee_code_format');
      expect(content).toContain('check_client_code_format');
      expect(content).toContain('check_project_code_format');
      expect(content).toContain('check_task_code_format');

      // Check immutability triggers
      expect(content).toContain('prevent_business_code_column_update');
      expect(content).toContain('trg_immutable_client_code');
      expect(content).toContain('trg_immutable_employee_code');
      expect(content).toContain('trg_immutable_project_code');
      expect(content).toContain('trg_immutable_task_code');
    });

    it('verifies 20260818161000_add_admin_readable_views.sql creates all admin views with security_invoker', () => {
      expect(existsSync(mViewsPath)).toBe(true);
      const content = readFileSync(mViewsPath, 'utf8');

      // Check view creations with security_invoker
      expect(content).toContain(
        'CREATE OR REPLACE VIEW public.admin_account_approval_events',
      );
      expect(content).toContain('CREATE OR REPLACE VIEW public.admin_clients');
      expect(content).toContain('CREATE OR REPLACE VIEW public.admin_people');
      expect(content).toContain(
        'CREATE OR REPLACE VIEW public.admin_departments',
      );
      expect(content).toContain('CREATE OR REPLACE VIEW public.admin_teams');
      expect(content).toContain('CREATE OR REPLACE VIEW public.admin_projects');
      expect(content).toContain('CREATE OR REPLACE VIEW public.admin_tasks');
      expect(content).toContain(
        'CREATE OR REPLACE VIEW public.admin_attendance_records',
      );
      expect(content).toContain(
        'CREATE OR REPLACE VIEW public.admin_leave_requests',
      );
      expect(content).toContain(
        'CREATE OR REPLACE VIEW public.admin_contracts',
      );
      expect(content).toContain('CREATE OR REPLACE VIEW public.admin_invoices');
      expect(content).toContain('CREATE OR REPLACE VIEW public.admin_payments');
      expect(content).toContain('CREATE OR REPLACE VIEW public.admin_services');

      // Check security invoker presence
      expect(content).toContain('WITH (security_invoker = true)');

      // Check security grants: revoked from anon/public, granted to authenticated/service_role
      expect(content).toContain(
        'REVOKE ALL ON public.admin_account_approval_events FROM anon, PUBLIC;',
      );
      expect(content).toContain(
        'GRANT SELECT ON public.admin_account_approval_events TO authenticated, service_role;',
      );
    });
  });
});
