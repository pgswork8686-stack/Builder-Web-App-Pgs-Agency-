-- ============================================================
-- Migration: Add Business Codes to Additional Entities & Companion Codes
-- Timestamp: 20260819110000_add_additional_business_codes_and_companions.sql
-- Description:
--   1. Adds business codes to entities:
--      - automation_rules.automation_rule_code (TDH_01...)
--      - chat_conversations.conversation_code (HT_01...)
--      - leave_types.leave_type_code (LNP_01...)
--   2. Adds companion codes to referring tables:
--      - automation_executions.rule_code
--      - chat_members.conversation_code
--      - chat_messages.conversation_code
--      - leave_requests.leave_type_code
--      - leave_balances.leave_type_code
--   3. Sets up sequences, format checks, auto-generation triggers, immutability,
--      companion sync triggers with `SET search_path = ''`, and backfills existing rows.
-- ============================================================

-- ============================================================
-- 1. ADD BUSINESS CODE COLUMNS TO ENTITY TABLES
-- ============================================================

-- automation_rules
ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS automation_rule_code TEXT;

-- chat_conversations
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS conversation_code TEXT;

-- leave_types
ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS leave_type_code TEXT;

-- ============================================================
-- 2. ADD COMPANION BUSINESS CODE COLUMNS TO REFERRING TABLES
-- ============================================================

-- automation_executions
ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS rule_code TEXT;

-- chat_members
ALTER TABLE public.chat_members
  ADD COLUMN IF NOT EXISTS conversation_code TEXT;

-- chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS conversation_code TEXT;

-- leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_type_code TEXT;

-- leave_balances
ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS leave_type_code TEXT;

-- ============================================================
-- 3. SEQUENCES FOR NEW BUSINESS CODES
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.automation_rules_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.chat_conversations_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.leave_types_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- ============================================================
-- 4. DETERMINISTIC BACKFILL FOR ENTITY TABLES
-- ============================================================

-- Backfill automation_rules (TDH_01, TDH_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(automation_rule_code, '^TDH_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.automation_rules
  WHERE automation_rule_code ~ '^TDH_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.automation_rules
    WHERE automation_rule_code IS NULL OR automation_rule_code !~ '^TDH_[0-9]{2,}$'
  )
  UPDATE public.automation_rules ar
  SET automation_rule_code = public.format_business_code('TDH', n.rn)
  FROM numbered n
  WHERE ar.id = n.id;

  PERFORM setval(
    'public.automation_rules_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(automation_rule_code, '^TDH_', ''), '')::bigint), 0) FROM public.automation_rules),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill chat_conversations (HT_01, HT_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(conversation_code, '^HT_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.chat_conversations
  WHERE conversation_code ~ '^HT_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.chat_conversations
    WHERE conversation_code IS NULL OR conversation_code !~ '^HT_[0-9]{2,}$'
  )
  UPDATE public.chat_conversations cc
  SET conversation_code = public.format_business_code('HT', n.rn)
  FROM numbered n
  WHERE cc.id = n.id;

  PERFORM setval(
    'public.chat_conversations_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(conversation_code, '^HT_', ''), '')::bigint), 0) FROM public.chat_conversations),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill leave_types (LNP_01, LNP_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(leave_type_code, '^LNP_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.leave_types
  WHERE leave_type_code ~ '^LNP_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.leave_types
    WHERE leave_type_code IS NULL OR leave_type_code !~ '^LNP_[0-9]{2,}$'
  )
  UPDATE public.leave_types lt
  SET leave_type_code = public.format_business_code('LNP', n.rn)
  FROM numbered n
  WHERE lt.id = n.id;

  PERFORM setval(
    'public.leave_types_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(leave_type_code, '^LNP_', ''), '')::bigint), 0) FROM public.leave_types),
      1
    ) + 1,
    false
  );
END $$;

-- ============================================================
-- 5. CONSTRAINTS & UNIQUE INDEXES
-- ============================================================

ALTER TABLE public.automation_rules
  ADD CONSTRAINT check_automation_rule_code_format CHECK (automation_rule_code IS NULL OR automation_rule_code ~ '^TDH_[0-9]{2,}$');
CREATE UNIQUE INDEX IF NOT EXISTS automation_rules_code_uidx ON public.automation_rules(automation_rule_code) WHERE automation_rule_code IS NOT NULL;

ALTER TABLE public.chat_conversations
  ADD CONSTRAINT check_conversation_code_format CHECK (conversation_code IS NULL OR conversation_code ~ '^HT_[0-9]{2,}$');
CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_code_uidx ON public.chat_conversations(conversation_code) WHERE conversation_code IS NOT NULL;

ALTER TABLE public.leave_types
  ADD CONSTRAINT check_leave_type_code_format CHECK (leave_type_code IS NULL OR leave_type_code ~ '^LNP_[0-9]{2,}$');
CREATE UNIQUE INDEX IF NOT EXISTS leave_types_code_uidx ON public.leave_types(leave_type_code) WHERE leave_type_code IS NOT NULL;

-- ============================================================
-- 6. AUTO-GENERATION TRIGGERS FOR ENTITY BUSINESS CODES
-- ============================================================

-- automation_rules
CREATE OR REPLACE FUNCTION public.trigger_set_automation_rule_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.automation_rule_code IS NULL OR pg_catalog.btrim(NEW.automation_rule_code) = '' THEN
    NEW.automation_rule_code := public.format_business_code('TDH', pg_catalog.nextval('public.automation_rules_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_automation_rule_code ON public.automation_rules;
CREATE TRIGGER trg_set_automation_rule_code
  BEFORE INSERT ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_automation_rule_code();

-- chat_conversations
CREATE OR REPLACE FUNCTION public.trigger_set_chat_conversation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.conversation_code IS NULL OR pg_catalog.btrim(NEW.conversation_code) = '' THEN
    NEW.conversation_code := public.format_business_code('HT', pg_catalog.nextval('public.chat_conversations_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_chat_conversation_code ON public.chat_conversations;
CREATE TRIGGER trg_set_chat_conversation_code
  BEFORE INSERT ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_chat_conversation_code();

-- leave_types
CREATE OR REPLACE FUNCTION public.trigger_set_leave_type_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.leave_type_code IS NULL OR pg_catalog.btrim(NEW.leave_type_code) = '' THEN
    NEW.leave_type_code := public.format_business_code('LNP', pg_catalog.nextval('public.leave_types_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_leave_type_code ON public.leave_types;
CREATE TRIGGER trg_set_leave_type_code
  BEFORE INSERT ON public.leave_types
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_leave_type_code();

-- ============================================================
-- 7. IMMUTABILITY TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_immutable_automation_rule_code ON public.automation_rules;
CREATE TRIGGER trg_immutable_automation_rule_code
  BEFORE UPDATE OF automation_rule_code ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update();

DROP TRIGGER IF EXISTS trg_immutable_chat_conversation_code ON public.chat_conversations;
CREATE TRIGGER trg_immutable_chat_conversation_code
  BEFORE UPDATE OF conversation_code ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update();

DROP TRIGGER IF EXISTS trg_immutable_leave_type_code ON public.leave_types;
CREATE TRIGGER trg_immutable_leave_type_code
  BEFORE UPDATE OF leave_type_code ON public.leave_types
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update();

-- ============================================================
-- 8. COMPANION SYNC TRIGGERS (BEFORE INSERT OR UPDATE)
-- ============================================================

-- A. automation_executions
CREATE OR REPLACE FUNCTION public.trigger_sync_companion_codes_automation_executions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.rule_id IS NOT NULL THEN
    SELECT ar.automation_rule_code INTO NEW.rule_code
    FROM public.automation_rules ar
    WHERE ar.id = NEW.rule_id;
  ELSE
    NEW.rule_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_automation_executions ON public.automation_executions;
CREATE TRIGGER trg_sync_companion_codes_automation_executions
  BEFORE INSERT OR UPDATE OF rule_id ON public.automation_executions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_companion_codes_automation_executions();

-- B. chat_members
CREATE OR REPLACE FUNCTION public.trigger_sync_companion_codes_chat_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    SELECT cc.conversation_code INTO NEW.conversation_code
    FROM public.chat_conversations cc
    WHERE cc.id = NEW.conversation_id;
  ELSE
    NEW.conversation_code := NULL;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT p.account_code INTO NEW.user_code
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  ELSE
    NEW.user_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_chat_members ON public.chat_members;
CREATE TRIGGER trg_sync_companion_codes_chat_members
  BEFORE INSERT OR UPDATE OF conversation_id, user_id ON public.chat_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_companion_codes_chat_members();

-- C. chat_messages
CREATE OR REPLACE FUNCTION public.trigger_sync_companion_codes_chat_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    SELECT cc.conversation_code INTO NEW.conversation_code
    FROM public.chat_conversations cc
    WHERE cc.id = NEW.conversation_id;
  ELSE
    NEW.conversation_code := NULL;
  END IF;

  IF NEW.sender_user_id IS NOT NULL THEN
    SELECT p.account_code INTO NEW.sender_user_code
    FROM public.profiles p
    WHERE p.id = NEW.sender_user_id;
  ELSE
    NEW.sender_user_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_chat_messages ON public.chat_messages;
CREATE TRIGGER trg_sync_companion_codes_chat_messages
  BEFORE INSERT OR UPDATE OF conversation_id, sender_user_id ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_companion_codes_chat_messages();

-- D. leave_requests (Extend existing sync to include leave_type_code)
CREATE OR REPLACE FUNCTION public.trigger_sync_companion_codes_leave_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT p.account_code INTO NEW.user_code
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  ELSE
    NEW.user_code := NULL;
  END IF;

  IF NEW.leave_type_id IS NOT NULL THEN
    SELECT lt.leave_type_code INTO NEW.leave_type_code
    FROM public.leave_types lt
    WHERE lt.id = NEW.leave_type_id;
  ELSE
    NEW.leave_type_code := NULL;
  END IF;

  IF NEW.reviewer_user_id IS NOT NULL THEN
    SELECT p.account_code INTO NEW.reviewer_user_code
    FROM public.profiles p
    WHERE p.id = NEW.reviewer_user_id;
  ELSE
    NEW.reviewer_user_code := NULL;
  END IF;

  IF NEW.cancelled_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.cancelled_by_code
    FROM public.profiles p
    WHERE p.id = NEW.cancelled_by;
  ELSE
    NEW.cancelled_by_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_leave_requests ON public.leave_requests;
CREATE TRIGGER trg_sync_companion_codes_leave_requests
  BEFORE INSERT OR UPDATE OF user_id, leave_type_id, reviewer_user_id, cancelled_by ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_companion_codes_leave_requests();

-- E. leave_balances
CREATE OR REPLACE FUNCTION public.trigger_sync_companion_codes_leave_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT p.account_code INTO NEW.user_code
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  ELSE
    NEW.user_code := NULL;
  END IF;

  IF NEW.leave_type_id IS NOT NULL THEN
    SELECT lt.leave_type_code INTO NEW.leave_type_code
    FROM public.leave_types lt
    WHERE lt.id = NEW.leave_type_id;
  ELSE
    NEW.leave_type_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_leave_balances ON public.leave_balances;
CREATE TRIGGER trg_sync_companion_codes_leave_balances
  BEFORE INSERT OR UPDATE OF user_id, leave_type_id ON public.leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_companion_codes_leave_balances();

-- ============================================================
-- 9. BACKFILL COMPANION CODES ON EXISTING ROWS
-- ============================================================

-- automation_executions
UPDATE public.automation_executions ae
SET rule_code = ar.automation_rule_code
FROM public.automation_rules ar
WHERE ae.rule_id = ar.id
  AND ae.rule_code IS NULL;

-- chat_members
UPDATE public.chat_members cm
SET conversation_code = cc.conversation_code
FROM public.chat_conversations cc
WHERE cm.conversation_id = cc.id
  AND cm.conversation_code IS NULL;

-- chat_messages
UPDATE public.chat_messages msg
SET conversation_code = cc.conversation_code
FROM public.chat_conversations cc
WHERE msg.conversation_id = cc.id
  AND msg.conversation_code IS NULL;

-- leave_requests
UPDATE public.leave_requests lr
SET leave_type_code = lt.leave_type_code
FROM public.leave_types lt
WHERE lr.leave_type_id = lt.id
  AND lr.leave_type_code IS NULL;

-- leave_balances
UPDATE public.leave_balances lb
SET leave_type_code = lt.leave_type_code
FROM public.leave_types lt
WHERE lb.leave_type_id = lt.id
  AND lb.leave_type_code IS NULL;

-- ============================================================
-- 10. SELECTIVE INDEXES FOR NEW COMPANION CODES
-- ============================================================

CREATE INDEX IF NOT EXISTS automation_executions_rule_code_idx ON public.automation_executions(rule_code);
CREATE INDEX IF NOT EXISTS chat_members_conversation_code_idx ON public.chat_members(conversation_code);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_code_idx ON public.chat_messages(conversation_code);
CREATE INDEX IF NOT EXISTS leave_requests_leave_type_code_idx ON public.leave_requests(leave_type_code);
CREATE INDEX IF NOT EXISTS leave_balances_leave_type_code_idx ON public.leave_balances(leave_type_code);
