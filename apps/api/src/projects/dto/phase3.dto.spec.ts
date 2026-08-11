import {
  CreateProjectMembershipSchema,
  CreateProjectSchema,
  ProjectListQuerySchema,
  UpdateProjectSchema,
} from './project.dto';
import {
  CreateServiceSchema,
  UpdateServiceSchema,
} from '../../services/dto/service.dto';
import {
  CreateTaskSchema,
  TaskListQuerySchema,
  UpdateTaskSchema,
} from '../../tasks/dto/task.dto';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('Phase 3 DTO validation', () => {
  describe('projects', () => {
    it('normalizes an admin-provided project code and supplies defaults', () => {
      const parsed = CreateProjectSchema.parse({
        projectCode: '  pgs-2026-001 ',
        clientCompanyId: UUID,
        name: 'Website launch',
      });

      expect(parsed).toMatchObject({
        projectCode: 'PGS-2026-001',
        status: 'draft',
        priority: 'medium',
      });
    });

    it.each([
      ['invalid status', { status: 'archived' }],
      ['invalid priority', { priority: 'critical' }],
      ['invalid client UUID', { clientCompanyId: 'not-a-uuid' }],
      ['impossible calendar date', { startDate: '2026-02-31' }],
      [
        'invalid date range',
        { startDate: '2026-08-12', dueDate: '2026-08-11' },
      ],
    ])('rejects %s', (_label, override) => {
      expect(
        CreateProjectSchema.safeParse({
          projectCode: 'PGS-1',
          clientCompanyId: UUID,
          name: 'Project',
          ...override,
        }).success,
      ).toBe(false);
    });

    it('rejects an empty PATCH body', () => {
      expect(UpdateProjectSchema.safeParse({}).success).toBe(false);
    });

    it.each(['20abc', '0', '101'])(
      'rejects malformed pageSize=%s',
      (pageSize) => {
        expect(ProjectListQuerySchema.safeParse({ pageSize }).success).toBe(
          false,
        );
      },
    );

    it('accepts only declared project membership roles', () => {
      expect(
        CreateProjectMembershipSchema.safeParse({
          userId: UUID,
          projectRole: 'owner',
        }).success,
      ).toBe(false);
    });
  });

  describe('services', () => {
    it('normalizes service codes', () => {
      expect(
        CreateServiceSchema.parse({ code: ' seo ', name: 'SEO' }).code,
      ).toBe('SEO');
    });

    it('rejects an empty service PATCH body', () => {
      expect(UpdateServiceSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('tasks', () => {
    it('supplies deterministic task defaults', () => {
      expect(CreateTaskSchema.parse({ title: 'Do work' })).toMatchObject({
        status: 'todo',
        priority: 'medium',
        sortOrder: 0,
      });
    });

    it.each([
      ['invalid status', { status: 'blocked' }],
      ['invalid priority', { priority: 'critical' }],
      [
        'invalid date range',
        { startDate: '2026-08-12', dueDate: '2026-08-11' },
      ],
      ['impossible date', { dueDate: '2026-02-31' }],
    ])('rejects %s', (_label, override) => {
      expect(
        CreateTaskSchema.safeParse({ title: 'Task', ...override }).success,
      ).toBe(false);
    });

    it('rejects empty task PATCH and malformed list pagination', () => {
      expect(UpdateTaskSchema.safeParse({}).success).toBe(false);
      expect(TaskListQuerySchema.safeParse({ page: '2x' }).success).toBe(false);
    });
  });
});
