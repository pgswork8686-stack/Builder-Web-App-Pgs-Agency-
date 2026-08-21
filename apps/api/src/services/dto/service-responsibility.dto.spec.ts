import { UpdateServiceResponsibilitySchema } from './service-responsibility.dto';

describe('UpdateServiceResponsibilitySchema', () => {
  const ownerDepartmentId = '11111111-1111-4111-8111-111111111111';
  const ownerTeamId = '22222222-2222-4222-8222-222222222222';

  it('accepts owner department with optional team/collaborators', () => {
    const result = UpdateServiceResponsibilitySchema.safeParse({
      ownerDepartmentId,
      ownerTeamId,
      collaboratorDepartmentIds: [],
      collaboratorTeamIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed ids', () => {
    const result = UpdateServiceResponsibilitySchema.safeParse({
      ownerDepartmentId: 'PB_02',
    });
    expect(result.success).toBe(false);
  });
});
