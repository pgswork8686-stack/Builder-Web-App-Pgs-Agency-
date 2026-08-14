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
           OR (status IN ('issued', 'partially_paid') AND due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
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

-- Keep explicit overdue transitions aligned with the same Vietnam business date.
CREATE OR REPLACE FUNCTION public.phase6_validate_invoice_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status <> 'draft' AND (
    OLD.invoice_number IS DISTINCT FROM NEW.invoice_number
    OR OLD.client_company_id IS DISTINCT FROM NEW.client_company_id
    OR OLD.project_id IS DISTINCT FROM NEW.project_id
    OR OLD.contract_id IS DISTINCT FROM NEW.contract_id
    OR OLD.issue_date IS DISTINCT FROM NEW.issue_date
    OR OLD.due_date IS DISTINCT FROM NEW.due_date
    OR OLD.amount IS DISTINCT FROM NEW.amount
    OR OLD.currency_code IS DISTINCT FROM NEW.currency_code
  ) THEN
    RAISE EXCEPTION 'INVOICE_IMMUTABLE_AFTER_ISSUE' USING ERRCODE = 'P6012';
  END IF;

  IF NEW.paid_amount < OLD.paid_amount THEN
    RAISE EXCEPTION 'INVOICE_PAID_AMOUNT_CANNOT_DECREASE' USING ERRCODE = 'P6013';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('issued', 'cancelled'))
    OR (OLD.status = 'issued' AND NEW.status IN ('partially_paid', 'paid', 'overdue', 'cancelled'))
    OR (OLD.status = 'overdue' AND NEW.status IN ('partially_paid', 'paid', 'cancelled'))
    OR (OLD.status = 'partially_paid' AND NEW.status = 'paid')
  ) THEN
    RAISE EXCEPTION 'INVOICE_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P6014';
  END IF;

  IF NEW.status = 'overdue'
     AND NEW.due_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'INVOICE_NOT_DUE' USING ERRCODE = 'P6015';
  END IF;

  IF NEW.status IN ('draft', 'issued', 'overdue', 'cancelled')
     AND NEW.paid_amount <> 0 THEN
    RAISE EXCEPTION 'INVOICE_PAYMENT_STATE_INVALID' USING ERRCODE = 'P6016';
  ELSIF NEW.status = 'partially_paid'
        AND NOT (NEW.paid_amount > 0 AND NEW.paid_amount < NEW.amount) THEN
    RAISE EXCEPTION 'INVOICE_PAYMENT_STATE_INVALID' USING ERRCODE = 'P6016';
  ELSIF NEW.status = 'paid' AND NEW.paid_amount <> NEW.amount THEN
    RAISE EXCEPTION 'INVOICE_PAYMENT_STATE_INVALID' USING ERRCODE = 'P6016';
  END IF;

  IF NEW.status = 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, NOW());
    NEW.cancelled_at := NULL;
  ELSIF NEW.status = 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, NOW());
    NEW.paid_at := NULL;
  ELSE
    NEW.paid_at := NULL;
    NEW.cancelled_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.phase6_validate_invoice_state()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase6_validate_invoice_state()
  TO service_role;

REVOKE ALL ON FUNCTION public.phase6_finance_summary()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase6_finance_summary()
  TO service_role;
