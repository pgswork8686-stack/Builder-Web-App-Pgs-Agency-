/**
 * REAL-SERVICE AUTHORIZATION TESTS: WorkspaceAccessService + FilesService
 *
 * Strategy: Mock ONLY the Supabase transport layer.
 * WorkspaceAccessService and FilesService themselves are instantiated directly.
 * Tests drive real authorization logic: requireProjectAccess, download, remove.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceRealtimeGateway } from './workspace-realtime.gateway';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FILE_A = 'file1111-1111-4111-8111-111111111111';
const FILE_B = 'file2222-2222-4222-8222-222222222222';

const EMPLOYEE_A_PROFILE = '33333333-3333-4333-8333-333333333333';
const EMPLOYEE_B_PROFILE = '44444444-4444-4444-8444-444444444444';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: EMPLOYEE_A_PROFILE,
    email: 'employee@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Employee A',
    avatarUrl: null,
    approvedAt: null,
    ...overrides,
  };
}

function mockQueryChain(response: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    maybeSingle: jest.fn().mockResolvedValue(response),
    single: jest.fn().mockResolvedValue(response),
    delete: jest.fn().mockReturnThis(),
  };
}

describe('WorkspaceAccessService + FilesService — Real Authorization Logic (Supabase Transport Mocked)', () => {
  let accessService: WorkspaceAccessService;
  let fromMock: jest.Mock;
  let storageMock: { from: jest.Mock };
  let rpcMock: jest.Mock;
  let realtimeMock: { emitProjectEvent: jest.Mock };

  beforeEach(async () => {
    fromMock = jest.fn();
    rpcMock = jest.fn().mockResolvedValue({ data: null, error: null });
    storageMock = {
      from: jest.fn().mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example/signed' },
          error: null,
        }),
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://upload.example/signed', token: 't-1' },
          error: null,
        }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
    realtimeMock = { emitProjectEvent: jest.fn() };

    const mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        from: fromMock,
        storage: storageMock,
        rpc: rpcMock,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        WorkspaceAccessService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: WorkspaceRealtimeGateway, useValue: realtimeMock },
      ],
    }).compile();

    accessService = module.get<WorkspaceAccessService>(WorkspaceAccessService);
    // FilesService requires WorkspaceRealtimeGateway injected
    // Use accessService directly for WorkspaceAccessService tests
  });

  // =========================================================================
  // WorkspaceAccessService.requireProjectAccess — REAL authorization
  // =========================================================================
  describe('WorkspaceAccessService.requireProjectAccess — REAL authorization', () => {
    it('throws ForbiddenException immediately for client role (no DB query)', async () => {
      const clientUser = makeUser({ role: 'client' });

      await expect(
        accessService.requireProjectAccess(
          PROJECT_A,
          clientUser,
          'FILE_ACCESS_DENIED',
        ),
      ).rejects.toThrow(ForbiddenException);

      // The client check is synchronous before any DB call
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when project does not exist', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      // projects query → not found
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      await expect(
        accessService.requireProjectAccess(
          PROJECT_B,
          employeeUser,
          'FILE_ACCESS_DENIED',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(fromMock.mock.calls[0][0]).toBe('projects');
    });

    it('returns admin access object without membership query for admin role', async () => {
      const adminUser = makeUser({ role: 'admin' });

      // projects query → exists
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );

      const result = await accessService.requireProjectAccess(
        PROJECT_A,
        adminUser,
        'FILE_ACCESS_DENIED',
      );
      expect(result.isAdmin).toBe(true);
      expect(result.isManager).toBe(true);
      // Admin bypasses membership check → only 1 DB call (projects table)
      expect(fromMock).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when employee has no project membership', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      // projects → exists
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_B }, error: null }),
      );
      // project_memberships → no membership row
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      let caughtError: any;
      try {
        await accessService.requireProjectAccess(
          PROJECT_B,
          employeeUser,
          'FILE_ACCESS_DENIED',
        );
      } catch (e) {
        caughtError = e;
      }
      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FILE_ACCESS_DENIED');
      expect(fromMock.mock.calls[1][0]).toBe('project_memberships');
    });

    it('returns employee access object when employee IS a member', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );

      const result = await accessService.requireProjectAccess(
        PROJECT_A,
        employeeUser,
        'FILE_ACCESS_DENIED',
      );
      expect(result.isAdmin).toBe(false);
      expect(result.projectRole).toBe('developer');
    });
  });

  // =========================================================================
  // WorkspaceAccessService.requireTask — Project/Task mismatch check
  // =========================================================================
  describe('WorkspaceAccessService.requireTask — projectId/taskId mismatch', () => {
    it('throws ForbiddenException when task does not belong to the given projectId', async () => {
      const TASK_X = 'taskxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx';
      const taskRow = {
        id: TASK_X,
        project_id: PROJECT_B, // belongs to PROJECT_B, not PROJECT_A
        title: 'Foreign Task',
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: taskRow, error: null }),
      );

      let caughtError: any;
      try {
        await accessService.requireTask(
          PROJECT_A,
          TASK_X,
          'FILE_ACCESS_DENIED',
        );
      } catch (e) {
        caughtError = e;
      }
      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FILE_ACCESS_DENIED');
    });

    it('throws NotFoundException when task does not exist', async () => {
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      await expect(
        accessService.requireTask(
          PROJECT_A,
          'non-existent-task-id',
          'FILE_ACCESS_DENIED',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns task when it belongs to the correct project', async () => {
      const TASK_A = 'taskaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const taskRow = {
        id: TASK_A,
        project_id: PROJECT_A,
        title: 'Valid Task',
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: taskRow, error: null }),
      );

      const result = await accessService.requireTask(
        PROJECT_A,
        TASK_A,
        'FILE_ACCESS_DENIED',
      );
      expect(result.id).toBe(TASK_A);
      expect(result.project_id).toBe(PROJECT_A);
    });
  });

  // =========================================================================
  // FilesService.download — File/Project mismatch (IDOR)
  // Testing via FilesService instantiated with real WorkspaceAccessService
  // =========================================================================
  describe('FilesService.download — projectId/fileId mismatch (IDOR)', () => {
    let filesSvc: FilesService;
    let innerFromMock: jest.Mock;

    beforeEach(async () => {
      innerFromMock = jest.fn();
      const innerRpcMock = jest
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const innerStorageMock = {
        from: jest.fn().mockReturnValue({
          createSignedUrl: jest.fn().mockResolvedValue({
            data: { signedUrl: 'https://storage/file' },
            error: null,
          }),
          remove: jest.fn().mockResolvedValue({ data: null, error: null }),
          list: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
      const innerRealtimeMock = { emitProjectEvent: jest.fn() };

      const mockSupabaseService = {
        getSystemClient: jest.fn().mockReturnValue({
          from: innerFromMock,
          storage: innerStorageMock,
          rpc: innerRpcMock,
        }),
      };

      const innerModule: TestingModule = await Test.createTestingModule({
        providers: [
          FilesService,
          WorkspaceAccessService,
          { provide: SupabaseService, useValue: mockSupabaseService },
          { provide: WorkspaceRealtimeGateway, useValue: innerRealtimeMock },
        ],
      }).compile();

      filesSvc = innerModule.get<FilesService>(FilesService);
    });

    it('throws ForbiddenException when file belongs to PROJECT_B but called with PROJECT_A (mismatch)', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      // requireFileAccess (projects check then membership):
      innerFromMock
        // projects → found
        .mockReturnValueOnce(
          mockQueryChain({ data: { id: PROJECT_A }, error: null }),
        )
        // project_memberships → employee is member
        .mockReturnValueOnce(
          mockQueryChain({ data: { project_role: 'developer' }, error: null }),
        )
        // getFile (project_files) → file belongs to PROJECT_B
        .mockReturnValueOnce(
          mockQueryChain({
            data: {
              id: FILE_B,
              project_id: PROJECT_B, // <-- mismatch
              task_id: null,
              delete_status: 'active',
              original_name: 'test.pdf',
              storage_path: 'projects/projB/2026/01/test.pdf',
            },
            error: null,
          }),
        );

      let caughtError: any;
      try {
        await filesSvc.download(PROJECT_A, FILE_B, employeeUser);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FILE_ACCESS_DENIED');
    });

    it('returns signed URL when file belongs to correct project and user has access', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      innerFromMock
        .mockReturnValueOnce(
          mockQueryChain({ data: { id: PROJECT_A }, error: null }),
        )
        .mockReturnValueOnce(
          mockQueryChain({ data: { project_role: 'developer' }, error: null }),
        )
        .mockReturnValueOnce(
          mockQueryChain({
            data: {
              id: FILE_A,
              project_id: PROJECT_A, // correct project
              task_id: null,
              delete_status: 'active',
              original_name: 'report.pdf',
              storage_path: 'projects/projA/2026/01/report.pdf',
            },
            error: null,
          }),
        );

      const result = await filesSvc.download(PROJECT_A, FILE_A, employeeUser);
      expect(result.signedUrl).toBeDefined();
    });

    it('throws ForbiddenException when client tries to download from internal project files', async () => {
      const clientUser = makeUser({ role: 'client' });

      // WorkspaceAccessService.requireProjectAccess throws immediately for client
      await expect(
        filesSvc.download(PROJECT_A, FILE_A, clientUser),
      ).rejects.toThrow(ForbiddenException);

      expect(innerFromMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // FilesService.remove — Authorization checks (viewer, non-owner, mismatch)
  // =========================================================================
  describe('FilesService.remove — authorization checks', () => {
    let filesSvc: FilesService;
    let innerFromMock: jest.Mock;
    let innerRpcMock: jest.Mock;

    beforeEach(async () => {
      innerFromMock = jest.fn();
      innerRpcMock = jest.fn().mockResolvedValue({
        data: [
          { storage_path: 'projects/projA/2026/01/file.pdf', task_id: null },
        ],
        error: null,
      });
      const innerStorageMock = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({ data: null, error: null }),
          list: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };

      const mockSupabaseService = {
        getSystemClient: jest.fn().mockReturnValue({
          from: innerFromMock,
          storage: innerStorageMock,
          rpc: innerRpcMock,
        }),
      };

      const innerModule: TestingModule = await Test.createTestingModule({
        providers: [
          FilesService,
          WorkspaceAccessService,
          { provide: SupabaseService, useValue: mockSupabaseService },
          {
            provide: WorkspaceRealtimeGateway,
            useValue: { emitProjectEvent: jest.fn() },
          },
        ],
      }).compile();

      filesSvc = innerModule.get<FilesService>(FilesService);
    });

    it('throws ForbiddenException when non-owner, non-manager employee tries to delete foreign file', async () => {
      const employeeUser = makeUser({
        role: 'employee',
        profileId: EMPLOYEE_A_PROFILE,
      });

      innerFromMock
        // projects → found
        .mockReturnValueOnce(
          mockQueryChain({ data: { id: PROJECT_A }, error: null }),
        )
        // project_memberships → employee is member (not manager)
        .mockReturnValueOnce(
          mockQueryChain({ data: { project_role: 'developer' }, error: null }),
        )
        // project_files → file uploaded by EMPLOYEE_B
        .mockReturnValueOnce(
          mockQueryChain({
            data: {
              id: FILE_A,
              project_id: PROJECT_A,
              task_id: null,
              delete_status: 'active',
              uploaded_by: EMPLOYEE_B_PROFILE, // different uploader
              original_name: 'doc.pdf',
              storage_path: 'projects/projA/file.pdf',
              uploader: null,
              task: null,
            },
            error: null,
          }),
        );

      let caughtError: any;
      try {
        await filesSvc.remove(PROJECT_A, FILE_A, employeeUser);
      } catch (e) {
        caughtError = e;
      }
      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FILE_ACCESS_DENIED');
    });

    it('throws ForbiddenException when file belongs to different project (projectId/fileId mismatch)', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      innerFromMock
        .mockReturnValueOnce(
          mockQueryChain({ data: { id: PROJECT_A }, error: null }),
        )
        .mockReturnValueOnce(
          mockQueryChain({ data: { project_role: 'developer' }, error: null }),
        )
        .mockReturnValueOnce(
          mockQueryChain({
            data: {
              id: FILE_B,
              project_id: PROJECT_B, // file is from PROJECT_B, not PROJECT_A
              task_id: null,
              delete_status: 'active',
              uploaded_by: EMPLOYEE_A_PROFILE,
              original_name: 'doc.pdf',
              storage_path: 'projects/projB/file.pdf',
              uploader: null,
              task: null,
            },
            error: null,
          }),
        );

      await expect(
        filesSvc.remove(PROJECT_A, FILE_B, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows project manager to delete any file in their project', async () => {
      const managerUser = makeUser({ role: 'team_leader' });

      innerFromMock
        .mockReturnValueOnce(
          mockQueryChain({ data: { id: PROJECT_A }, error: null }),
        )
        // project_manager role → isManager = true
        .mockReturnValueOnce(
          mockQueryChain({
            data: { project_role: 'project_manager' },
            error: null,
          }),
        )
        .mockReturnValueOnce(
          mockQueryChain({
            data: {
              id: FILE_A,
              project_id: PROJECT_A,
              task_id: null,
              delete_status: 'active',
              uploaded_by: EMPLOYEE_B_PROFILE, // different uploader — manager can still delete
              original_name: 'report.pdf',
              storage_path: 'projects/projA/report.pdf',
              uploader: null,
              task: null,
            },
            error: null,
          }),
        );

      // rpc calls succeed
      innerRpcMock
        .mockResolvedValueOnce({
          data: [{ storage_path: 'projects/projA/report.pdf', task_id: null }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await filesSvc.remove(PROJECT_A, FILE_A, managerUser);
      expect(result.success).toBe(true);
    });
  });
});
