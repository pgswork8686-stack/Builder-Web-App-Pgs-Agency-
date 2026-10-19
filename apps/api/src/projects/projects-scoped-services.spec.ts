import { ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

describe('ProjectsService scoped project-service reads', () => {
  const USER = '11111111-1111-4111-8111-111111111111';
  const PROJECT = '22222222-2222-4222-8222-222222222222';
  const DEPARTMENT = '33333333-3333-4333-8333-333333333333';

  it('returns services only after project-detail authorization succeeds', async () => {
    const service = new ProjectsService({} as never);
    const checkAccess = jest
      .spyOn(service, 'getInternalProjectById')
      .mockResolvedValue({} as never);
    const services = [{ id: 'project-service-1' }];
    const readServices = jest
      .spyOn(service, 'getProjectServices')
      .mockResolvedValue(services as never);

    await expect(
      service.getScopedProjectServices(USER, 'team_leader', DEPARTMENT, PROJECT),
    ).resolves.toEqual(services);
    expect(checkAccess).toHaveBeenCalledWith(
      USER,
      PROJECT,
      'team_leader',
      DEPARTMENT,
    );
    expect(readServices).toHaveBeenCalledWith(PROJECT);
  });

  it('does not query project services when project access is denied', async () => {
    const service = new ProjectsService({} as never);
    jest
      .spyOn(service, 'getInternalProjectById')
      .mockRejectedValue(new ForbiddenException('DEPARTMENT_SCOPE_DENIED'));
    const readServices = jest.spyOn(service, 'getProjectServices');

    await expect(
      service.getScopedProjectServices(USER, 'team_leader', DEPARTMENT, PROJECT),
    ).rejects.toThrow(ForbiddenException);
    expect(readServices).not.toHaveBeenCalled();
  });
});
