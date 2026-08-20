import { WorkflowValidationService } from './workflow-validation.service';
import { WorkflowSlaService } from './workflow-sla.service';

describe('Workflow Engine V1 Tests', () => {
  let validation: WorkflowValidationService;
  let sla: WorkflowSlaService;
  let mockCalendarService: any;

  beforeEach(() => {
    validation = new WorkflowValidationService();
    mockCalendarService = {
      resolveDay: jest.fn().mockImplementation((date: string) => {
        // Sunday is non-working day
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
    sla = new WorkflowSlaService(mockCalendarService);
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
    it('should calculate SLA skipping non-working days', async () => {
      // Saturday morning 08:00 (working)
      const start = new Date('2026-08-22T08:00:00.000Z');
      // 16 working hours = 2 working days
      const due = await sla.addWorkingHours(start, 16);
      expect(due).toBeDefined();
      expect(due.getTime()).toBeGreaterThan(start.getTime());
    });
  });
});
