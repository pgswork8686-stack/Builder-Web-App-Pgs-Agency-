import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations',
);

describe('Phase 6 Migration Security Contract', () => {
  const m17Path = resolve(
    migrationsDirectory,
    '20260812170000_phase6_finance.sql',
  );

  it('verifies recovered Phase 6 finance migration exists and matches exact checksum and length', () => {
    expect(existsSync(m17Path)).toBe(true);

    const fileBytes = readFileSync(m17Path);

    // Verify exact normalized length
    expect(fileBytes.length).toBe(26536);

    // Verify exact MD5 checksum
    const md5 = createHash('md5').update(fileBytes).digest('hex');
    expect(md5).toBe('c29a286571822143291f332d92e9e9cb');
  });

  it('verifies RLS policies, triggers, and function privileges are set securely', () => {
    const migration = readFileSync(m17Path, 'utf8');

    // Verify RLS is enabled on all finance tables
    expect(migration).toContain(
      'ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;',
    );
    expect(migration).toContain(
      'ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;',
    );
    expect(migration).toContain(
      'ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;',
    );
    expect(migration).toContain(
      'ALTER TABLE public.finance_audit_events ENABLE ROW LEVEL SECURITY;',
    );

    // Verify CRUD access is revoked from public, anon, and authenticated
    expect(migration).toContain(
      'REVOKE ALL ON public.contracts FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON public.invoices FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON public.invoice_payments FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON public.finance_audit_events FROM PUBLIC, anon, authenticated;',
    );

    // Verify service_role gets privileges
    expect(migration).toContain(
      'GRANT ALL ON public.contracts TO service_role;',
    );
    expect(migration).toContain(
      'GRANT ALL ON public.invoices TO service_role;',
    );
    expect(migration).toContain(
      'GRANT ALL ON public.invoice_payments TO service_role;',
    );
    expect(migration).toContain(
      'GRANT ALL ON public.finance_audit_events TO service_role;',
    );

    // Verify atomic transition/summary function execute permission is locked down
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.phase6_transition_contract(UUID, public.contract_status, UUID)\n  FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.phase6_transition_invoice(UUID, public.invoice_status, UUID)\n  FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.phase6_record_invoice_payment(\n  UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID\n) FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.phase6_finance_summary()\n  FROM PUBLIC, anon, authenticated;',
    );

    // Verify execute permission is granted strictly to service_role
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.phase6_transition_contract(UUID, public.contract_status, UUID)\n  TO service_role;',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.phase6_transition_invoice(UUID, public.invoice_status, UUID)\n  TO service_role;',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.phase6_record_invoice_payment(\n  UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID\n) TO service_role;',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.phase6_finance_summary() TO service_role;',
    );
  });
});
