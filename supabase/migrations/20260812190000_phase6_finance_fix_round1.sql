-- ==========================================================================
-- Phase 6 Finance Fix Round 1
-- Correct phase6_finance_summary to include overdue partially_paid invoices
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.phase6_finance_summary()
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH contract_totals AS (
    SELECT
      currency_code,
      COUNT(*) FILTER (WHERE status = 'active')::INTEGER AS active_contracts,
      COALESCE(
        SUM(contract_value) FILTER (WHERE status IN ('active', 'completed')),
        0
      ) AS contracted_value
    FROM public.contracts
    GROUP BY currency_code
  ),
  invoice_totals AS (
    SELECT
      currency_code,
      COUNT(*) FILTER (
        WHERE status = 'overdue'
           OR (status IN ('issued', 'partially_paid') AND due_date < CURRENT_DATE)
      )::INTEGER AS overdue_invoices,
      COALESCE(
        SUM(amount) FILTER (WHERE status NOT IN ('draft', 'cancelled')),
        0
      ) AS invoiced_amount,
      COALESCE(
        SUM(paid_amount) FILTER (WHERE status NOT IN ('draft', 'cancelled')),
        0
      ) AS received_amount,
      COALESCE(
        SUM(amount - paid_amount) FILTER (
          WHERE status IN ('issued', 'partially_paid', 'overdue')
        ),
        0
      ) AS outstanding_amount
    FROM public.invoices
    GROUP BY currency_code
  )
  SELECT jsonb_build_object(
    'contracts', COALESCE(
      (SELECT jsonb_agg(to_jsonb(contract_totals) ORDER BY currency_code)
       FROM contract_totals),
      '[]'::JSONB
    ),
    'invoices', COALESCE(
      (SELECT jsonb_agg(to_jsonb(invoice_totals) ORDER BY currency_code)
       FROM invoice_totals),
      '[]'::JSONB
    ),
    'generated_at', NOW()
  );
$$;

REVOKE ALL ON FUNCTION public.phase6_finance_summary()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase6_finance_summary()
  TO service_role;
