import {
  CalendarQuerySchema,
  CommentPaginationSchema,
  CreateCommentSchema,
  MoveTaskSchema,
  UpdateCommentSchema,
} from './workspace.dto';

describe('Phase 4 workspace DTO validation', () => {
  it('accepts a valid calendar range at the 93 day boundary', () => {
    expect(
      CalendarQuerySchema.safeParse({ from: '2026-08-01', to: '2026-11-01' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['invalid date', { from: '2026-02-30', to: '2026-03-01' }],
    ['reversed range', { from: '2026-08-12', to: '2026-08-11' }],
    ['range too large', { from: '2026-01-01', to: '2026-05-01' }],
  ])('rejects %s for calendar queries', (_label, value) => {
    expect(CalendarQuerySchema.safeParse(value).success).toBe(false);
  });

  it('rejects permissive pagination and page sizes above 100', () => {
    expect(
      CommentPaginationSchema.safeParse({ page: '1', pageSize: '20abc' })
        .success,
    ).toBe(false);
    expect(
      CommentPaginationSchema.safeParse({ page: '1', pageSize: '101' }).success,
    ).toBe(false);
  });

  it('rejects empty and oversized comments', () => {
    expect(CreateCommentSchema.safeParse({ content: '   ' }).success).toBe(
      false,
    );
    expect(
      CreateCommentSchema.safeParse({ content: 'x'.repeat(10001) }).success,
    ).toBe(false);
    expect(UpdateCommentSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid board statuses and duplicate neighbors', () => {
    expect(MoveTaskSchema.safeParse({ status: 'cancelled' }).success).toBe(
      false,
    );
    expect(
      MoveTaskSchema.safeParse({
        status: 'done',
        beforeTaskId: '11111111-1111-4111-8111-111111111111',
        afterTaskId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
  });
});
