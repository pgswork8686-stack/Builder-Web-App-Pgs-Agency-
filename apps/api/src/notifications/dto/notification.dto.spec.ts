import {
  CreateNotificationEventSchema,
  NotificationPreferencesUpdateSchema,
} from './notification.dto';

describe('notification DTO validation', () => {
  it('accepts only known notification preference booleans', () => {
    expect(
      NotificationPreferencesUpdateSchema.safeParse({
        inAppEnabled: false,
        emailEnabled: true,
      }).success,
    ).toBe(true);
    expect(
      NotificationPreferencesUpdateSchema.safeParse({ preferences: {} }).success,
    ).toBe(false);
    expect(
      NotificationPreferencesUpdateSchema.safeParse({ inAppEnabled: 'true' })
        .success,
    ).toBe(false);
  });

  it('rejects non-canonical and external action URLs', () => {
    const base = {
      recipientUserId: '11111111-1111-4111-8111-111111111111',
      type: 'task.assigned',
      title: 'Task',
      message: 'A task was assigned.',
    };

    expect(
      CreateNotificationEventSchema.safeParse({
        ...base,
        actionUrl: '/app/projects/abc',
      }).success,
    ).toBe(true);
    expect(
      CreateNotificationEventSchema.safeParse({
        ...base,
        actionUrl: 'https://example.com',
      }).success,
    ).toBe(false);
    expect(
      CreateNotificationEventSchema.safeParse({
        ...base,
        actionUrl: '/app/../admin',
      }).success,
    ).toBe(false);
  });
});
