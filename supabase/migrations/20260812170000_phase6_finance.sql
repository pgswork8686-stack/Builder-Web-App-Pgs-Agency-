-- Migration: Phase 6 - Finance, Contracts, Invoices, and Payments
-- Timestamp: 20260812170000_phase6_finance.sql

-- ==========================================================================
-- 1. Typed business states
-- ==========================================================================

CREATE TYPE public.contract_status AS ENUM (
  'draft',
  'active',
  'completed',
  'cancelled'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled'
);

-- ==========================================================================
-- 2. Finance tables
-- ==========================================================================

CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL,
  client_company_id UUID NOT NULL REFERENCES public.client_companies(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  contract_value NUMERIC(15,2) NOT NULL,
  currency_code TEXT NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contracts_number_length CHECK (length(btrim(contract_number)) BETWEEN 2 AND 80),
  CONSTRAINT contracts_title_length CHECK (length(btrim(title)) BETWEEN 2 AND 240),
  CONSTRAINT contracts_dates_valid CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT contracts_value_positive CHECK (contract_value > 0),
  CONSTRAINT contracts_currency_format CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT contracts_notes_length CHECK (notes IS NULL OR length(notes) <= 10000),
  CONSTRAINT contracts_terminal_timestamps CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND completed_at IS NULL)
    OR (status IN ('draft', 'active') AND completed_at IS NULL AND cancelled_at IS NULL)
  )
);

CREATE UNIQUE INDEX contracts_number_ci_uidx
  ON public.contracts (lower(contract_number));

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  client_company_id UUID NOT NULL REFERENCES public.client_companies(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE RESTRICT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoices_number_length CHECK (length(btrim(invoice_number)) BETWEEN 2 AND 80),
  CONSTRAINT invoices_dates_valid CHECK (due_date >= issue_date),
  CONSTRAINT invoices_amount_positive CHECK (amount > 0),
  CONSTRAINT invoices_paid_amount_valid CHECK (paid_amount >= 0 AND paid_amount <= amount),
  CONSTRAINT invoices_currency_format CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT invoices_notes_length CHECK (notes IS NULL OR length(notes) <= 10000)
);

CREATE UNIQUE INDEX invoices_number_ci_uidx
  ON public.invoices (lower(invoice_number));

CREATE TABLE public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(15,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  payment_reference TEXT,
  payment_method TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoice_payments_amount_positive CHECK (amount > 0),
  CONSTRAINT invoice_payments_reference_length CHECK (
    payment_reference IS NULL OR length(payment_reference) <= 160
  ),
  CONSTRAINT invoice_payments_method_length CHECK (
    payment_method IS NULL OR length(payment_method) <= 120
  ),
  CONSTRAINT invoice_payments_notes_length CHECK (notes IS NULL OR length(notes) <= 5000)
);

CREATE UNIQUE INDEX invoice_payments_reference_ci_uidx
  ON public.invoice_payments (invoice_id, lower(payment_reference))
  WHERE payment_reference IS NOT NULL;

CREATE TABLE public.finance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_data JSONB,
  new_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_audit_entity_type CHECK (
    entity_type IN ('contract', 'invoice', 'payment')
  ),
  CONSTRAINT finance_audit_action_length CHECK (length(action) BETWEEN 2 AND 80)
);

-- ==========================================================================
-- 3. Indexes for authorization, pagination, joins, and foreign keys
-- ==========================================================================

CREATE INDEX contracts_client_created_idx
  ON public.contracts (client_company_id, created_at DESC, id DESC);
CREATE INDEX contracts_project_idx ON public.contracts (project_id);
CREATE INDEX contracts_status_created_idx
  ON public.contracts (status, created_at DESC, id DESC);
CREATE INDEX contracts_created_by_idx ON public.contracts (created_by);
CREATE INDEX contracts_updated_by_idx ON public.contracts (updated_by);
CREATE INDEX contracts_client_visible_idx
  ON public.contracts (client_company_id, created_at DESC, id DESC)
  WHERE client_visible = TRUE;

CREATE INDEX invoices_client_created_idx
  ON public.invoices (client_company_id, created_at DESC, id DESC);
CREATE INDEX invoices_project_idx ON public.invoices (project_id);
CREATE INDEX invoices_contract_idx ON public.invoices (contract_id);
CREATE INDEX invoices_status_due_idx
  ON public.invoices (status, due_date, id);
CREATE INDEX invoices_created_by_idx ON public.invoices (created_by);
CREATE INDEX invoices_updated_by_idx ON public.invoices (updated_by);
CREATE INDEX invoices_client_visible_idx
  ON public.invoices (client_company_id, issue_date DESC, id DESC)
  WHERE client_visible = TRUE;

CREATE INDEX invoice_payments_invoice_paid_idx
  ON public.invoice_payments (invoice_id, paid_at DESC, id DESC);
CREATE INDEX invoice_payments_recorded_by_idx
  ON public.invoice_payments (recorded_by);

CREATE INDEX finance_audit_entity_created_idx
  ON public.finance_audit_events (entity_type, entity_id, created_at DESC, id DESC);
CREATE INDEX finance_audit_actor_idx
  ON public.finance_audit_events (actor_user_id);

-- ==========================================================================
-- 4. Cross-table scope validation
-- ==========================================================================

CREATE FUNCTION public.phase6_validate_contract_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_client_id UUID;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT client_company_id
    INTO v_project_client_id
    FROM public.projects
    WHERE id = NEW.project_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FINANCE_PROJECT_NOT_FOUND' USING ERRCODE = 'P6001';
    END IF;

    IF v_project_client_id IS DISTINCT FROM NEW.client_company_id THEN
      RAISE EXCEPTION 'CONTRACT_PROJECT_CLIENT_MISMATCH' USING ERRCODE = 'P6002';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.phase6_validate_invoice_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_client_id UUID;
  v_contract public.contracts%ROWTYPE;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT client_company_id
    INTO v_project_client_id
    FROM public.projects
    WHERE id = NEW.project_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FINANCE_PROJECT_NOT_FOUND' USING ERRCODE = 'P6001';
    END IF;

    IF v_project_client_id IS DISTINCT FROM NEW.client_company_id THEN
      RAISE EXCEPTION 'INVOICE_PROJECT_CLIENT_MISMATCH' USING ERRCODE = 'P6003';
    END IF;
  END IF;

  IF NEW.contract_id IS NOT NULL THEN
    SELECT * INTO v_contract
    FROM public.contracts
    WHERE id = NEW.contract_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CONTRACT_NOT_FOUND' USING ERRCODE = 'P6004';
    END IF;

    IF v_contract.client_company_id IS DISTINCT FROM NEW.client_company_id THEN
      RAISE EXCEPTION 'INVOICE_CONTRACT_CLIENT_MISMATCH' USING ERRCODE = 'P6005';
    END IF;

    IF v_contract.project_id IS NOT NULL
       AND v_contract.project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'INVOICE_CONTRACT_PROJECT_MISMATCH' USING ERRCODE = 'P6006';
    END IF;

    IF v_contract.currency_code IS DISTINCT FROM NEW.currency_code THEN
      RAISE EXCEPTION 'INVOICE_CONTRACT_CURRENCY_MISMATCH' USING ERRCODE = 'P6007';
    END IF;

    IF v_contract.status = 'cancelled' THEN
      RAISE EXCEPTION 'INVOICE_CONTRACT_CANCELLED' USING ERRCODE = 'P6008';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================================================
-- 5. State machines and immutable financial history
-- ==========================================================================

CREATE FUNCTION public.phase6_validate_contract_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status <> 'draft' AND (
    OLD.contract_number IS DISTINCT FROM NEW.contract_number
    OR OLD.client_company_id IS DISTINCT FROM NEW.client_company_id
    OR OLD.project_id IS DISTINCT FROM NEW.project_id
    OR OLD.title IS DISTINCT FROM NEW.title
    OR OLD.start_date IS DISTINCT FROM NEW.start_date
    OR OLD.end_date IS DISTINCT FROM NEW.end_date
    OR OLD.contract_value IS DISTINCT FROM NEW.contract_value
    OR OLD.currency_code IS DISTINCT FROM NEW.currency_code
  ) THEN
    RAISE EXCEPTION 'CONTRACT_IMMUTABLE_AFTER_ACTIVATION' USING ERRCODE = 'P6010';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('active', 'cancelled'))
    OR (OLD.status = 'active' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'CONTRACT_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P6011';
  END IF;

  IF NEW.status = 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    NEW.cancelled_at := NULL;
  ELSIF NEW.status = 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, NOW());
    NEW.completed_at := NULL;
  ELSE
    NEW.completed_at := NULL;
    NEW.cancelled_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.phase6_validate_invoice_state()
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

  IF NEW.status = 'overdue' AND NEW.due_date >= CURRENT_DATE THEN
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

CREATE FUNCTION public.phase6_prevent_finance_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'FINANCE_HARD_DELETE_FORBIDDEN' USING ERRCODE = 'P6017';
END;
$$;

CREATE FUNCTION public.phase6_prevent_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'PAYMENT_IMMUTABLE' USING ERRCODE = 'P6018';
END;
$$;

CREATE FUNCTION public.phase6_prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'FINANCE_AUDIT_IMMUTABLE' USING ERRCODE = 'P6019';
END;
$$;

CREATE FUNCTION public.phase6_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ==========================================================================
-- 6. Transactional audit trail
-- ==========================================================================

CREATE FUNCTION public.phase6_audit_finance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_type TEXT := TG_ARGV[0];
  v_action TEXT;
  v_actor UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := CASE
      WHEN v_entity_type = 'payment' THEN 'payment_recorded'
      ELSE 'created'
    END;
    v_actor := COALESCE(
      (to_jsonb(NEW) ->> 'updated_by')::UUID,
      (to_jsonb(NEW) ->> 'created_by')::UUID,
      (to_jsonb(NEW) ->> 'recorded_by')::UUID
    );

    INSERT INTO public.finance_audit_events (
      entity_type, entity_id, action, actor_user_id, previous_data, new_data
    ) VALUES (
      v_entity_type, NEW.id, v_action, v_actor, NULL, to_jsonb(NEW)
    );
  ELSE
    v_action := CASE
      WHEN to_jsonb(OLD) ->> 'status' IS DISTINCT FROM to_jsonb(NEW) ->> 'status'
        THEN 'status_changed'
      ELSE 'updated'
    END;
    v_actor := (to_jsonb(NEW) ->> 'updated_by')::UUID;

    INSERT INTO public.finance_audit_events (
      entity_type, entity_id, action, actor_user_id, previous_data, new_data
    ) VALUES (
      v_entity_type, NEW.id, v_action, v_actor, to_jsonb(OLD), to_jsonb(NEW)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================================================
-- 7. Atomic business RPCs
-- ==========================================================================

CREATE FUNCTION public.phase6_transition_contract(
  p_contract_id UUID,
  p_status public.contract_status,
  p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT_NOT_FOUND' USING ERRCODE = 'P6004';
  END IF;

  IF v_contract.status = p_status THEN
    RAISE EXCEPTION 'CONTRACT_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P6011';
  END IF;

  UPDATE public.contracts
  SET status = p_status,
      updated_by = p_actor_user_id
  WHERE id = p_contract_id
  RETURNING to_jsonb(contracts.*) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.phase6_transition_invoice(
  p_invoice_id UUID,
  p_status public.invoice_status,
  p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P6020';
  END IF;

  IF v_invoice.status = p_status THEN
    RAISE EXCEPTION 'INVOICE_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P6014';
  END IF;

  UPDATE public.invoices
  SET status = p_status,
      updated_by = p_actor_user_id
  WHERE id = p_invoice_id
  RETURNING to_jsonb(invoices.*) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.phase6_record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_paid_at TIMESTAMPTZ,
  p_payment_reference TEXT,
  p_payment_method TEXT,
  p_notes TEXT,
  p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment public.invoice_payments%ROWTYPE;
  v_new_paid_amount NUMERIC(15,2);
  v_new_status public.invoice_status;
  v_updated_invoice JSONB;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_paid_at IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING ERRCODE = 'P6021';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P6020';
  END IF;

  IF v_invoice.status NOT IN ('issued', 'overdue', 'partially_paid') THEN
    RAISE EXCEPTION 'INVOICE_NOT_PAYABLE' USING ERRCODE = 'P6022';
  END IF;

  v_new_paid_amount := v_invoice.paid_amount + p_amount;
  IF v_new_paid_amount > v_invoice.amount THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_OUTSTANDING' USING ERRCODE = 'P6023';
  END IF;

  v_new_status := CASE
    WHEN v_new_paid_amount = v_invoice.amount THEN 'paid'::public.invoice_status
    ELSE 'partially_paid'::public.invoice_status
  END;

  INSERT INTO public.invoice_payments (
    invoice_id,
    amount,
    paid_at,
    payment_reference,
    payment_method,
    notes,
    recorded_by
  ) VALUES (
    p_invoice_id,
    p_amount,
    p_paid_at,
    NULLIF(btrim(p_payment_reference), ''),
    NULLIF(btrim(p_payment_method), ''),
    NULLIF(btrim(p_notes), ''),
    p_actor_user_id
  )
  RETURNING * INTO v_payment;

  UPDATE public.invoices
  SET paid_amount = v_new_paid_amount,
      status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'paid' THEN p_paid_at ELSE NULL END,
      updated_by = p_actor_user_id
  WHERE id = p_invoice_id
  RETURNING to_jsonb(invoices.*) INTO v_updated_invoice;

  RETURN jsonb_build_object(
    'invoice', v_updated_invoice,
    'payment', to_jsonb(v_payment)
  );
END;
$$;

CREATE FUNCTION public.phase6_finance_summary()
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
           OR (status = 'issued' AND due_date < CURRENT_DATE)
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

-- ==========================================================================
-- 8. Triggers
-- ==========================================================================

CREATE TRIGGER phase6_contract_scope_before_write
  BEFORE INSERT OR UPDATE OF client_company_id, project_id
  ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.phase6_validate_contract_scope();

CREATE TRIGGER phase6_contract_state_before_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.phase6_validate_contract_state();

CREATE TRIGGER phase6_contract_touch_before_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.phase6_touch_updated_at();

CREATE TRIGGER phase6_contract_audit_after_write
  AFTER INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.phase6_audit_finance_change('contract');

CREATE TRIGGER phase6_contract_no_delete
  BEFORE DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.phase6_prevent_finance_delete();

CREATE TRIGGER phase6_invoice_scope_before_write
  BEFORE INSERT OR UPDATE OF client_company_id, project_id, contract_id, currency_code
  ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.phase6_validate_invoice_scope();

CREATE TRIGGER phase6_invoice_state_before_update
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.phase6_validate_invoice_state();

CREATE TRIGGER phase6_invoice_touch_before_update
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.phase6_touch_updated_at();

CREATE TRIGGER phase6_invoice_audit_after_write
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.phase6_audit_finance_change('invoice');

CREATE TRIGGER phase6_invoice_no_delete
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.phase6_prevent_finance_delete();

CREATE TRIGGER phase6_payment_audit_after_insert
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.phase6_audit_finance_change('payment');

CREATE TRIGGER phase6_payment_immutable
  BEFORE UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.phase6_prevent_payment_mutation();

CREATE TRIGGER phase6_audit_immutable
  BEFORE UPDATE OR DELETE ON public.finance_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.phase6_prevent_audit_mutation();

-- ==========================================================================
-- 9. RLS and least privilege
-- ==========================================================================

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.contracts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.invoices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.invoice_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.finance_audit_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.contracts TO service_role;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.invoice_payments TO service_role;
GRANT ALL ON public.finance_audit_events TO service_role;

REVOKE ALL ON FUNCTION public.phase6_validate_contract_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_validate_invoice_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_validate_contract_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_validate_invoice_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_prevent_finance_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_prevent_payment_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_prevent_audit_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_audit_finance_change() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.phase6_transition_contract(UUID, public.contract_status, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_transition_invoice(UUID, public.invoice_status, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_record_invoice_payment(
  UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase6_finance_summary()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase6_transition_contract(UUID, public.contract_status, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase6_transition_invoice(UUID, public.invoice_status, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase6_record_invoice_payment(
  UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase6_finance_summary() TO service_role;
