import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations',
);

describe('Phase 7 migration security contract', () => {
  const migrationPath = resolve(
    migrationsDirectory,
    '20260812200000_phase7_notifications_chat_automation.sql',
  );
  const migration = readFileSync(migrationPath, 'utf8');

  it('exists and creates the required Phase 7 tables', () => {
    expect(existsSync(migrationPath)).toBe(true);
    for (const table of [
      'notifications',
      'notification_preferences',
      'chat_conversations',
      'chat_members',
      'chat_messages',
      'automation_rules',
      'automation_executions',
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
    }
  });

  it('keeps browser roles off Phase 7 business tables', () => {
    for (const table of [
      'notifications',
      'notification_preferences',
      'chat_conversations',
      'chat_members',
      'chat_messages',
      'automation_rules',
      'automation_executions',
    ]) {
      expect(migration).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      );
    }

    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).not.toMatch(/CREATE POLICY/i);
  });

  it('locks down Phase 7 functions with security invoker and explicit grants', () => {
    for (const fn of [
      'phase7_touch_updated_at',
      'phase7_validate_notification_update',
      'phase7_prevent_chat_message_mutation',
      'phase7_validate_chat_message_insert',
      'phase7_create_direct_conversation',
      'phase7_get_or_create_project_conversation',
      'phase7_mark_conversation_read',
      'phase7_chat_unread_count',
      'phase7_create_automation_notification_once',
      'phase7_record_automation_failure_once',
    ]) {
      expect(migration).toContain(`public.${fn}`);
      expect(migration).toContain('SECURITY INVOKER');
      expect(migration).toContain('SET search_path = public, pg_temp');
    }

    expect(migration).not.toMatch(/SECURITY DEFINER/i);
    expect(migration).not.toContain('\nAS $\n');
    expect(migration).not.toContain('\n$;');
  });

  it('enforces chat integrity, membership read state and direct conversation concurrency', () => {
    expect(migration).toContain(
      'CONSTRAINT chat_conversations_direct_unique UNIQUE (direct_user_low, direct_user_high)',
    );
    expect(migration).toContain(
      'CONSTRAINT chat_conversations_project_unique UNIQUE (project_id)',
    );
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('CHAT_MESSAGE_IMMUTABLE');
    expect(migration).toContain('phase7_chat_unread_count');
    expect(migration).toContain('chat_messages_conversation_cursor_idx');
  });

  it('keeps automation controlled and idempotent', () => {
    expect(migration).toContain(
      'CONSTRAINT automation_executions_rule_event_unique UNIQUE (rule_id, event_key)',
    );
    expect(migration).toContain("action_type IN ('create_notification')");
    expect(migration).toContain('phase7_create_automation_notification_once');
    expect(migration).not.toMatch(/\bwebhook\b/i);
    expect(migration).not.toMatch(/\bshell command\b/i);
    expect(migration).not.toMatch(/\bJavaScript\b/);
    expect(migration).not.toMatch(/\bSQL\b/);
  });

  it('restricts notification deep links to internal app routes', () => {
    expect(migration).toContain('notifications_action_url_internal');
    expect(migration).toContain('^/app/');
  });
});
