import { WorkflowValidationService } from './workflow-validation.service';
import { WorkflowSlaService } from './workflow-sla.service';

describe('Workflow Engine V1 Tests', () => {
  let validation: WorkflowValidationService;
  let sla: WorkflowSlaService;
  let mockCalendarService: any;
  let mockSupabaseService: any;

  beforeEach(() => {
    validation = new WorkflowValidationService();
    mockCalendarService = {
      resolveDay: jest.fn().mockImplementation((date: string) => {
        console.log('[TEST CALENDAR CHECK]', date);
        if (date === '2026-08-22' || date === '2026-09-05') {
          return Promise.resolve({
            date,
            isWorkingDay: false,
            reason: 'alternate_saturday',
            title: 'Nghỉ T7 cách tuần',
            sourceType: 'rule',
            eventType: null,
          });
        }
        const d = new Date(date);
        const isSunday = d.getUTCDay() === 0;
        return Promise.resolve({
          date,
          isWorkingDay: !isSunday,
          reason: isSunday ? 'sunday' : 'weekday',
          title: isSunday ? 'Chủ nhật' : 'Ngày làm việc',
          sourceType: 'default',
          eventType: null,
        });
      }),
    };
    mockSupabaseService = {
      getSystemClient: jest.fn(),
    };
    sla = new WorkflowSlaService(mockCalendarService, mockSupabaseService);
  });

  describe('DAG Cycle Detection', () => {
    it('should detect direct cycle A -> A', () => {
      const hasCycle = validation.detectStageCycles([
        { predecessorStageId: 'stage-1', successorStageId: 'stage-1' },
      ]);
      expect(hasCycle).toBe(true);
    });

    it('should detect circular dependency A -> B -> C -> A', () => {
      const hasCycle = validation.detectStageCycles([
        { predecessorStageId: 'stage-1', successorStageId: 'stage-2' },
        { predecessorStageId: 'stage-2', successorStageId: 'stage-3' },
        { predecessorStageId: 'stage-3', successorStageId: 'stage-1' },
      ]);
      expect(hasCycle).toBe(true);
    });

    it('should pass valid acyclic workflow DAG A -> B -> C', () => {
      const hasCycle = validation.detectStageCycles([
        { predecessorStageId: 'stage-1', successorStageId: 'stage-2' },
        { predecessorStageId: 'stage-2', successorStageId: 'stage-3' },
      ]);
      expect(hasCycle).toBe(false);
    });
  });

  describe('Working Duration SLA', () => {
    it('should return unconfigured when work hours are not defined', async () => {
      const res = await sla.calculateDueAt(new Date(), 16, {
        workday_start_time: null,
        workday_end_time: null,
      });
      expect(res.configured).toBe(false);
      expect(res.dueAt).toBeNull();
      expect(res.reason).toBe('WORK_HOURS_NOT_CONFIGURED');
    });

    it('should correctly skip alternate Saturday 22/08 and Sunday 23/08', async () => {
      const start = new Date('2026-08-21T01:00:00.000Z');
      const settings = {
        workday_start_time: '08:00',
        workday_end_time: '17:00',
        timezone: 'Asia/Ho_Chi_Minh',
      };
      const res = await sla.calculateDueAt(start, 12, settings);
      console.log('[RESULT DUE AT]', res);
      expect(res.configured).toBe(true);
      expect(res.dueAt).toBeDefined();
      expect(res.dueAt).toContain('2026-08-24');
    });
  });
});
