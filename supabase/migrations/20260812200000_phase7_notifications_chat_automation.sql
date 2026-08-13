-- ==========================================================================
-- Phase 7: Notifications, Chat, and Business Automation
-- Additive Git migration. Browser business access remains denied; Nest owns
-- all business reads/writes through service_role.
-- ==========================================================================

CREATE TYPE public.chat_conversation_type AS ENUM ('direct', 'project');
CREATE TYPE public.automation_rule_status AS ENUM ('running', 'success', 'failed', 'skipped');

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_valid CHECK (length(btrim(type)) BETWEEN 2 AND 80),
  CONSTRAINT notifications_title_valid CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  CONSTRAINT notifications_message_valid CHECK (length(btrim(message)) BETWEEN 1 AND 1200),
  CONSTRAINT notifications_entity_type_valid CHECK (entity_type IS NULL OR length(btrim(entity_type)) BETWEEN 2 AND 80),
  CONSTRAINT notifications_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT notifications_action_url_internal CHECK (
    action_url IS NULL
    OR action_url ~ '^/app/[A-Za-z0-9/_?=&.#-]*$'
  )
);

CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  preferences JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_preferences_object CHECK (jsonb_typeof(preferences) = 'object')
);

CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.chat_conversation_type NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  direct_user_low UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  direct_user_high UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_conversations_shape CHECK (
    (
      type = 'direct'
      AND project_id IS NULL
      AND direct_user_low IS NOT NULL
      AND direct_user_high IS NOT NULL
      AND direct_user_low <> direct_user_high
    )
    OR
    (
      type = 'project'
      AND project_id IS NOT NULL
      AND direct_user_low IS NULL
      AND direct_user_high IS NULL
    )
  ),
  CONSTRAINT chat_conversations_direct_unique UNIQUE (direct_user_low, direct_user_high),
  CONSTRAINT chat_conversations_project_unique UNIQUE (project_id)
);

CREATE TABLE public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member',
  read_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_members_unique UNIQUE (conversation_id, user_id),
  CONSTRAINT chat_members_role_valid CHECK (member_role IN ('member', 'project_member', 'client_contact', 'admin'))
);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_messages_content_valid CHECK (length(btrim(content)) BETWEEN 1 AND 4000),
  CONSTRAINT chat_messages_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::JSONB,
  action_type TEXT NOT NULL DEFAULT 'create_notification',
  action_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT automation_rules_name_valid CHECK (length(btrim(name)) BETWEEN 2 AND 160),
  CONSTRAINT automation_rules_trigger_valid CHECK (
    trigger_type IN (
      'task.created',
      'task.assigned',
      'task.updated',
      'task.due_soon',
      'project.updated',
      'leave.submitted',
      'leave.approved',
      'leave.rejected',
      'attendance.adjustment_requested',
      'contract.status_changed',
      'invoice.issued',
      'invoice.overdue',
      'invoice.payment_recorded',
      'chat.message'
    )
  ),
  CONSTRAINT automation_rules_action_valid CHECK (
    action_type IN ('create_notification')
  ),
  CONSTRAINT automation_rules_conditions_object CHECK (jsonb_typeof(conditions) = 'object'),
  CONSTRAINT automation_rules_action_config_object CHECK (jsonb_typeof(action_config) = 'object')
);

CREATE TABLE public.automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE RESTRICT,
  event_key TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status public.automation_rule_status NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT automation_executions_rule_event_unique UNIQUE (rule_id, event_key),
  CONSTRAINT automation_executions_event_key_valid CHECK (length(btrim(event_key)) BETWEEN 8 AND 240),
  CONSTRAINT automation_executions_trigger_valid CHECK (
    trigger_type IN (
      'task.created',
      'task.assigned',
      'task.updated',
      'task.due_soon',
      'project.updated',
      'leave.submitted',
      'leave.approved',
      'leave.rejected',
      'attendance.adjustment_requested',
      'contract.status_changed',
      'invoice.issued',
      'invoice.overdue',
      'invoice.payment_recorded',
      'chat.message'
    )
  ),
  CONSTRAINT automation_executions_action_valid CHECK (
    action_type IN ('create_notification')
  ),
  CONSTRAINT automation_executions_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT automation_executions_result_object CHECK (jsonb_typeof(result) = 'object')
);

CREATE INDEX notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, created_at DESC, id DESC);
CREATE INDEX notifications_recipient_unread_idx
  ON public.notifications (recipient_user_id, created_at DESC, id DESC)
  WHERE read_at IS NULL;
CREATE INDEX notifications_entity_idx
  ON public.notifications (entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;
CREATE INDEX notifications_created_by_idx
  ON public.notifications (created_by);
CREATE INDEX notifications_created_idx
  ON public.notifications (created_at DESC, id DESC);
CREATE INDEX notification_preferences_updated_by_idx
  ON public.notification_preferences (updated_by);

CREATE INDEX chat_conversations_project_idx
  ON public.chat_conversations (project_id)
  WHERE type = 'project';
CREATE INDEX chat_conversations_direct_high_idx
  ON public.chat_conversations (direct_user_high)
  WHERE type = 'direct';
CREATE INDEX chat_conversations_created_by_idx
  ON public.chat_conversations (created_by);
CREATE INDEX chat_conversations_last_message_idx
  ON public.chat_conversations (last_message_at DESC NULLS LAST, updated_at DESC, id DESC);
CREATE INDEX chat_members_user_idx
  ON public.chat_members (user_id, updated_at DESC, id DESC);
CREATE INDEX chat_members_conversation_idx
  ON public.chat_members (conversation_id);
CREATE INDEX chat_messages_conversation_cursor_idx
  ON public.chat_messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX chat_messages_sender_idx
  ON public.chat_messages (sender_user_id);

CREATE INDEX automation_rules_trigger_enabled_idx
  ON public.automation_rules (trigger_type, is_enabled);
CREATE INDEX automation_rules_created_by_idx
  ON public.automation_rules (created_by);
CREATE INDEX automation_rules_updated_by_idx
  ON public.automation_rules (updated_by);
CREATE INDEX automation_rules_created_idx
  ON public.automation_rules (created_at DESC, id DESC);
CREATE INDEX automation_executions_rule_idx
  ON public.automation_executions (rule_id, created_at DESC);
CREATE INDEX automation_executions_trigger_idx
  ON public.automation_executions (trigger_type, created_at DESC);
CREATE INDEX automation_executions_status_idx
  ON public.automation_executions (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.phase7_touch_updated_at()
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

CREATE OR REPLACE FUNCTION public.phase7_validate_notification_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.recipient_user_id IS DISTINCT FROM NEW.recipient_user_id
     OR OLD.type IS DISTINCT FROM NEW.type
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.message IS DISTINCT FROM NEW.message
     OR OLD.entity_type IS DISTINCT FROM NEW.entity_type
     OR OLD.entity_id IS DISTINCT FROM NEW.entity_id
     OR OLD.action_url IS DISTINCT FROM NEW.action_url
     OR OLD.metadata IS DISTINCT FROM NEW.metadata
     OR OLD.created_by IS DISTINCT FROM NEW.created_by
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'NOTIFICATION_CONTENT_IMMUTABLE' USING ERRCODE = 'P7001';
  END IF;

  IF OLD.read_at IS NOT NULL AND NEW.read_at IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_READ_STATE_CANNOT_RESET' USING ERRCODE = 'P7002';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_prevent_chat_message_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'CHAT_MESSAGE_IMMUTABLE' USING ERRCODE = 'P7010';
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_validate_chat_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  UPDATE public.chat_members
  SET updated_at = NEW.created_at
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_prevent_automation_execution_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'AUTOMATION_EXECUTION_IMMUTABLE' USING ERRCODE = 'P7020';
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_create_direct_conversation(
  p_actor_user_id UUID,
  p_peer_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role public.app_role;
  v_actor_status public.account_status;
  v_peer_role public.app_role;
  v_peer_status public.account_status;
  v_low UUID;
  v_high UUID;
  v_conversation_id UUID;
BEGIN
  IF p_actor_user_id IS NULL OR p_peer_user_id IS NULL OR p_actor_user_id = p_peer_user_id THEN
    RAISE EXCEPTION 'DIRECT_CHAT_INVALID_PARTICIPANTS' USING ERRCODE = 'P7030';
  END IF;

  SELECT role, account_status
  INTO v_actor_role, v_actor_status
  FROM public.profiles
  WHERE id = p_actor_user_id;

  SELECT role, account_status
  INTO v_peer_role, v_peer_status
  FROM public.profiles
  WHERE id = p_peer_user_id;

  IF v_actor_status IS DISTINCT FROM 'active'
     OR v_peer_status IS DISTINCT FROM 'active'
     OR v_actor_role IS NULL
     OR v_peer_role IS NULL
     OR v_actor_role = 'client'
     OR v_peer_role = 'client' THEN
    RAISE EXCEPTION 'DIRECT_CHAT_INTERNAL_ACTIVE_USERS_REQUIRED'
      USING ERRCODE = 'P7031';
  END IF;

  IF p_actor_user_id::TEXT < p_peer_user_id::TEXT THEN
    v_low := p_actor_user_id;
    v_high := p_peer_user_id;
  ELSE
    v_low := p_peer_user_id;
    v_high := p_actor_user_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('phase7_direct:' || v_low::TEXT || ':' || v_high::TEXT, 0));

  WITH inserted AS (
    INSERT INTO public.chat_conversations (
      type,
      direct_user_low,
      direct_user_high,
      created_by
    )
    VALUES ('direct', v_low, v_high, p_actor_user_id)
    ON CONFLICT (direct_user_low, direct_user_high) DO NOTHING
    RETURNING id
  )
  SELECT id INTO v_conversation_id FROM inserted
  UNION ALL
  SELECT id FROM public.chat_conversations
  WHERE type = 'direct'
    AND direct_user_low = v_low
    AND direct_user_high = v_high
  LIMIT 1;

  INSERT INTO public.chat_members (conversation_id, user_id, member_role)
  VALUES
    (v_conversation_id, p_actor_user_id, 'member'),
    (v_conversation_id, p_peer_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_get_or_create_project_conversation(
  p_project_id UUID,
  p_actor_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role public.app_role;
  v_actor_status public.account_status;
  v_client_company_id UUID;
  v_project_name TEXT;
  v_conversation_id UUID;
BEGIN
  SELECT role, account_status
  INTO v_actor_role, v_actor_status
  FROM public.profiles
  WHERE id = p_actor_user_id;

  IF v_actor_status IS DISTINCT FROM 'active' OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'PROJECT_CHAT_ACTIVE_USER_REQUIRED' USING ERRCODE = 'P7040';
  END IF;

  SELECT client_company_id, name
  INTO v_client_company_id, v_project_name
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P7041';
  END IF;

  IF v_actor_role = 'client' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.client_memberships cm
      WHERE cm.user_id = p_actor_user_id
        AND cm.client_company_id = v_client_company_id
    ) THEN
      RAISE EXCEPTION 'PROJECT_CHAT_ACCESS_DENIED' USING ERRCODE = 'P7042';
    END IF;
  ELSIF v_actor_role <> 'admin' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_memberships pm
      WHERE pm.user_id = p_actor_user_id
        AND pm.project_id = p_project_id
        AND pm.project_role <> 'client_contact'
    ) THEN
      RAISE EXCEPTION 'PROJECT_CHAT_ACCESS_DENIED' USING ERRCODE = 'P7042';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('phase7_project:' || p_project_id::TEXT, 0));

  WITH inserted AS (
    INSERT INTO public.chat_conversations (
      type,
      project_id,
      title,
      created_by
    )
    VALUES ('project', p_project_id, v_project_name, p_actor_user_id)
    ON CONFLICT (project_id) DO NOTHING
    RETURNING id
  )
  SELECT id INTO v_conversation_id FROM inserted
  UNION ALL
  SELECT id FROM public.chat_conversations
  WHERE type = 'project'
    AND project_id = p_project_id
  LIMIT 1;

  INSERT INTO public.chat_members (conversation_id, user_id, member_role)
  SELECT v_conversation_id,
         pm.user_id,
         CASE WHEN profile.role = 'client' THEN 'client_contact' ELSE 'project_member' END
  FROM public.project_memberships pm
  JOIN public.profiles profile ON profile.id = pm.user_id
  WHERE pm.project_id = p_project_id
    AND profile.account_status = 'active'
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.chat_members (conversation_id, user_id, member_role)
  SELECT v_conversation_id,
         cm.user_id,
         'client_contact'
  FROM public.client_memberships cm
  JOIN public.profiles profile ON profile.id = cm.user_id
  WHERE cm.client_company_id = v_client_company_id
    AND profile.role = 'client'
    AND profile.account_status = 'active'
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.chat_members (conversation_id, user_id, member_role)
  VALUES (
    v_conversation_id,
    p_actor_user_id,
    CASE
      WHEN v_actor_role = 'admin' THEN 'admin'
      WHEN v_actor_role = 'client' THEN 'client_contact'
      ELSE 'project_member'
    END
  )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_mark_conversation_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS public.chat_members
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member public.chat_members;
BEGIN
  UPDATE public.chat_members
  SET read_at = NOW(),
      last_seen_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id
  RETURNING * INTO v_member;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAT_MEMBER_NOT_FOUND' USING ERRCODE = 'P7050';
  END IF;

  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_chat_unread_count(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(DISTINCT member.conversation_id)::INTEGER
  FROM public.chat_members member
  JOIN public.chat_messages message
    ON message.conversation_id = member.conversation_id
  WHERE member.user_id = p_user_id
    AND message.sender_user_id IS DISTINCT FROM p_user_id
    AND message.created_at > COALESCE(member.read_at, '-infinity'::TIMESTAMPTZ);
$$;

CREATE OR REPLACE FUNCTION public.phase7_create_automation_notification_once(
  p_rule_id UUID,
  p_event_key TEXT,
  p_trigger_type TEXT,
  p_payload JSONB,
  p_recipient_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.automation_executions;
  v_notification_id UUID;
  v_execution_id UUID;
BEGIN
  SELECT *
  INTO v_existing
  FROM public.automation_executions
  WHERE rule_id = p_rule_id
    AND event_key = p_event_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'executed', false,
      'execution_id', v_existing.id,
      'notification_id', v_existing.result ->> 'notification_id'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notification_preferences np
    WHERE np.user_id = p_recipient_user_id
      AND np.in_app_enabled = FALSE
  ) THEN
    INSERT INTO public.automation_executions (
      rule_id,
      event_key,
      trigger_type,
      action_type,
      status,
      payload,
      result
    )
    VALUES (
      p_rule_id,
      p_event_key,
      p_trigger_type,
      'create_notification',
      'skipped',
      COALESCE(p_payload, '{}'::JSONB),
      jsonb_build_object('reason', 'notification_preference_disabled')
    )
    RETURNING id INTO v_execution_id;

    RETURN jsonb_build_object(
      'executed', true,
      'execution_id', v_execution_id,
      'notification_id', NULL
    );
  END IF;

  INSERT INTO public.notifications (
    recipient_user_id,
    type,
    title,
    message,
    entity_type,
    entity_id,
    action_url,
    metadata,
    created_by
  )
  VALUES (
    p_recipient_user_id,
    p_type,
    p_title,
    p_message,
    p_entity_type,
    p_entity_id,
    p_action_url,
    COALESCE(p_metadata, '{}'::JSONB),
    NULL
  )
  RETURNING id INTO v_notification_id;

  INSERT INTO public.automation_executions (
    rule_id,
    event_key,
    trigger_type,
    action_type,
    status,
    payload,
    result
  )
  VALUES (
    p_rule_id,
    p_event_key,
    p_trigger_type,
    'create_notification',
    'success',
    COALESCE(p_payload, '{}'::JSONB),
    jsonb_build_object('notification_id', v_notification_id)
  )
  RETURNING id INTO v_execution_id;

  RETURN jsonb_build_object(
    'executed', true,
    'execution_id', v_execution_id,
    'notification_id', v_notification_id
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT *
    INTO v_existing
    FROM public.automation_executions
    WHERE rule_id = p_rule_id
      AND event_key = p_event_key;

    RETURN jsonb_build_object(
      'executed', false,
      'execution_id', v_existing.id,
      'notification_id', v_existing.result ->> 'notification_id'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_record_automation_failure_once(
  p_rule_id UUID,
  p_event_key TEXT,
  p_trigger_type TEXT,
  p_payload JSONB,
  p_error_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_execution_id UUID;
BEGIN
  INSERT INTO public.automation_executions (
    rule_id,
    event_key,
    trigger_type,
    action_type,
    status,
    payload,
    result,
    error_message
  )
  VALUES (
    p_rule_id,
    p_event_key,
    p_trigger_type,
    'create_notification',
    'failed',
    COALESCE(p_payload, '{}'::JSONB),
    '{}'::JSONB,
    left(COALESCE(p_error_message, 'automation failure'), 1000)
  )
  ON CONFLICT (rule_id, event_key) DO NOTHING
  RETURNING id INTO v_execution_id;

  RETURN jsonb_build_object(
    'executed', v_execution_id IS NOT NULL,
    'execution_id', v_execution_id
  );
END;
$$;

CREATE TRIGGER trigger_phase7_touch_notification_preferences
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();

CREATE TRIGGER trigger_phase7_touch_chat_conversations
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();

CREATE TRIGGER trigger_phase7_touch_chat_members
  BEFORE UPDATE ON public.chat_members
  FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();

CREATE TRIGGER trigger_phase7_touch_automation_rules
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();

CREATE TRIGGER trigger_phase7_validate_notification_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.phase7_validate_notification_update();

CREATE TRIGGER trigger_phase7_prevent_chat_message_update
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.phase7_prevent_chat_message_mutation();

CREATE TRIGGER trigger_phase7_prevent_chat_message_delete
  BEFORE DELETE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.phase7_prevent_chat_message_mutation();

CREATE TRIGGER trigger_phase7_chat_message_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.phase7_validate_chat_message_insert();

CREATE TRIGGER trigger_phase7_prevent_automation_execution_delete
  BEFORE DELETE ON public.automation_executions
  FOR EACH ROW EXECUTE FUNCTION public.phase7_prevent_automation_execution_delete();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.notifications,
  public.notification_preferences,
  public.chat_conversations,
  public.chat_members,
  public.chat_messages,
  public.automation_rules,
  public.automation_executions
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.notifications,
  public.notification_preferences,
  public.chat_conversations,
  public.chat_members,
  public.chat_messages,
  public.automation_rules,
  public.automation_executions
TO service_role;

REVOKE ALL ON FUNCTION public.phase7_touch_updated_at()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_validate_notification_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_prevent_chat_message_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_validate_chat_message_insert()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_prevent_automation_execution_delete()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_create_direct_conversation(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_get_or_create_project_conversation(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_mark_conversation_read(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_chat_unread_count(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_create_automation_notification_once(
  UUID, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase7_record_automation_failure_once(UUID, TEXT, TEXT, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase7_touch_updated_at()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_validate_notification_update()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_prevent_chat_message_mutation()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_validate_chat_message_insert()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_prevent_automation_execution_delete()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_create_direct_conversation(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_get_or_create_project_conversation(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_mark_conversation_read(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_chat_unread_count(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_create_automation_notification_once(
  UUID, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase7_record_automation_failure_once(UUID, TEXT, TEXT, JSONB, TEXT)
  TO service_role;
