import { WorkflowSlaService } from './workflow-sla.service';
import { WorkflowValidationService } from './workflow-validation.service';

const settings = {
  workday_start_time: '08:00',
  workday_end_time: '17:00',
  timezone: 'Asia/Ho_Chi_Minh',
};

describe('Workflow validation and work-calendar SLA', () => {
  const validation = new WorkflowValidationService();
  const calendar = {
    resolveDay: jest.fn((date: string) => {
      const explicit: Record<string, boolean> = {
        '2026-08-22': false,
        '2026-08-29': true,
        '2026-09-05': false,
      };
      const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
      const isWorkingDay = explicit[date] ?? (weekday !== 0 && weekday !== 6);
      return Promise.resolve({
        date,
        isWorkingDay,
        reason: isWorkingDay ? 'working_day' : 'non_working_day',
        title: isWorkingDay ? 'Working day' : 'Day off',
        sourceType: explicit[date] === undefined ? 'default' : 'override',
        eventType: null,
      });
    }),
  };
  const supabase = { getSystemClient: jest.fn() };
  const sla = new WorkflowSlaService(calendar as never, supabase as never);

  describe('DAG validation', () => {
    it('detects a direct Stage cycle', () => {
      expect(
        validation.detectStageCycles([
          { predecessorStageId: 'A', successorStageId: 'A' },
        ]),
      ).toBe(true);
    });

    it('detects an indirect Stage cycle', () => {
      expect(
        validation.detectStageCycles([
          { predecessorStageId: 'A', successorStageId: 'B' },
          { predecessorStageId: 'B', successorStageId: 'C' },
          { predecessorStageId: 'C', successorStageId: 'A' },
        ]),
      ).toBe(true);
    });

    it('accepts a valid Stage DAG', () => {
      expect(
        validation.detectStageCycles([
          { predecessorStageId: 'A', successorStageId: 'B' },
          { predecessorStageId: 'A', successorStageId: 'C' },
          { predecessorStageId: 'B', successorStageId: 'D' },
        ]),
      ).toBe(false);
    });

    it('detects a direct Item cycle', () => {
      expect(
        validation.detectItemCycles([
          { predecessorStageItemId: 'A', successorStageItemId: 'A' },
        ]),
      ).toBe(true);
    });

    it('detects an indirect Item cycle', () => {
      expect(
        validation.detectItemCycles([
          { predecessorStageItemId: 'A', successorStageItemId: 'B' },
          { predecessorStageItemId: 'B', successorStageItemId: 'C' },
          { predecessorStageItemId: 'C', successorStageItemId: 'A' },
        ]),
      ).toBe(true);
    });

    it('accepts a valid Item DAG', () => {
      expect(
        validation.detectItemCycles([
          { predecessorStageItemId: 'A', successorStageItemId: 'B' },
          { predecessorStageItemId: 'B', successorStageItemId: 'C' },
        ]),
      ).toBe(false);
    });
  });

  describe('exact SLA timestamps', () => {
    it('returns an explicit unconfigured result when hours are missing', async () => {
      await expect(
        sla.calculateDueAt(new Date('2026-08-24T01:00:00.000Z'), 2, {
          workday_start_time: null,
          workday_end_time: null,
          timezone: 'Asia/Ho_Chi_Minh',
        }),
      ).resolves.toEqual({
        configured: false,
        dueAt: null,
        reason: 'WORK_HOURS_NOT_CONFIGURED',
      });
    });

    it('returns a stable error when SLA settings cannot be loaded', async () => {
      const settingsQuery: Record<string, jest.Mock> = {};
      settingsQuery.select = jest.fn(() => settingsQuery);
      settingsQuery.limit = jest.fn(() => settingsQuery);
      settingsQuery.maybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'sensitive attendance_settings query detail' },
      });
      const failingSla = new WorkflowSlaService(
        calendar as never,
        {
          getSystemClient: () => ({
            from: jest.fn(() => settingsQuery),
          }),
        } as never,
      );

      await expect(
        failingSla.calculateDueAt(new Date('2026-08-24T01:00:00.000Z'), 2),
      ).rejects.toMatchObject({
        response: {
          code: 'WORKFLOW_SLA_SETTINGS_LOOKUP_FAILED',
          message: 'Unable to load workflow SLA settings.',
        },
      });
    });

    it('normalizes a start before 08:00 to 08:00 local', async () => {
      const result = await sla.calculateDueAt(
        new Date('2026-08-24T00:00:00.000Z'),
        2,
        settings,
      );
      expect(result.dueAt).toBe('2026-08-24T03:00:00.000Z');
    });

    it('keeps the exact local time when starting inside the workday', async () => {
      const result = await sla.calculateDueAt(
        new Date('2026-08-24T02:30:00.000Z'),
        2,
        settings,
      );
      expect(result.dueAt).toBe('2026-08-24T04:30:00.000Z');
    });

    it('moves a start at 17:00 to the next working day', async () => {
      const result = await sla.calculateDueAt(
        new Date('2026-08-24T10:00:00.000Z'),
        2,
        settings,
      );
      expect(result.dueAt).toBe('2026-08-25T03:00:00.000Z');
    });

    it('consumes Friday 16:00-17:00 then resumes Monday at 08:00', async () => {
      const result = await sla.calculateDueAt(
        new Date('2026-08-21T09:00:00.000Z'),
        2,
        settings,
      );
      expect(result.dueAt).toBe('2026-08-24T02:00:00.000Z');
    });

    it('respects the 22/08/2026 OFF override', async () => {
      const result = await sla.calculateDueAt(
        new Date('2026-08-22T01:00:00.000Z'),
        1,
        settings,
      );
      expect(result.dueAt).toBe('2026-08-24T02:00:00.000Z');
    });

    it('respects the 29/08/2026 WORK override', async () => {
      const result = await sla.calculateDueAt(
        new Date('2026-08-28T09:00:00.000Z'),
        2,
        settings,
      );
      expect(result.dueAt).toBe('2026-08-29T02:00:00.000Z');
    });

    it('respects the 05/09/2026 OFF override and Sunday', async () => {
      const result = await sla.calculateDueAt(
        new Date('2026-09-04T09:00:00.000Z'),
        2,
        settings,
      );
      expect(result.dueAt).toBe('2026-09-07T02:00:00.000Z');
    });

    it('moves a Sunday start to Monday 08:00 local', async () => {
      const result = await sla.calculateDueAt(
        new Date('2026-08-23T03:00:00.000Z'),
        1,
        settings,
      );
      expect(result.dueAt).toBe('2026-08-24T02:00:00.000Z');
    });
  });
});
