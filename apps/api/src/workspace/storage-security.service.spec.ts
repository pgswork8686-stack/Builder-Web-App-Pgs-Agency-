/**
 * REAL-SERVICE STORAGE SECURITY TESTS
 *
 * Real FilesService + WorkspaceAccessService testing:
 * - Path traversal mitigation (filename sanitization, prevention of ../ directory escapes)
 * - Invalid MIME type rejection
 * - Oversize file rejection (> 25MB)
 * - Expired upload session rejection
 * - Foreign file / file-project mismatch access denial
 * - Unauthorized delete (viewer or non-owner non-manager)
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceRealtimeGateway } from './workspace-realtime.gateway';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FILE_A = 'file1111-1111-4111-8111-111111111111';
const SESSION_A = 'sess1111-1111-4111-8111-111111111111';

const USER_A_ID = '33333333-3333-4333-8333-333333333333';
const USER_B_ID = '44444444-4444-4444-8444-444444444444';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: USER_A_ID,
    email: 'user@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Test Employee',
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
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
}

describe('Storage Security — Real FilesService with Mocked Supabase', () => {
  let service: FilesService;
  let fromMock: jest.Mock;
  let storageMock: {
    from: jest.Mock;
  };
  let rpcMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    rpcMock = jest.fn().mockResolvedValue({ data: null, error: null });
    storageMock = {
      from: jest.fn().mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: {
            signedUrl: 'https://storage/signed-upload',
            token: 'token-1',
          },
          error: null,
        }),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage/signed-download' },
          error: null,
        }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };

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
        {
          provide: WorkspaceRealtimeGateway,
          useValue: { emitProjectEvent: jest.fn() },
        },
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  // =========================================================================
  // 1. Path Traversal Mitigation
  // =========================================================================
  describe('Path Traversal Mitigation in Upload Requests', () => {
    it('sanitizes ../ path traversal attempts in filename before generating storage path', async () => {
      const user = makeUser();

      // Project exists & user is member
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );
      // file_upload_sessions insert
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: SESSION_A }, error: null }),
      );

      const result = await service.createUploadRequest(
        PROJECT_A,
        {
          fileName: '../../../../etc/passwd.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        user,
      );

      // Verify the generated storage path does NOT contain any ../ traversal sequences
      expect(result.path).not.toContain('..');
      expect(result.path).toMatch(
        /^projects\/[a-f0-9-]+\/\d{4}\/\d{2}\/[a-f0-9-]+-etc-passwd\.pdf$/,
      );
    });

    it('sanitizes Windows-style backslash traversal ..\\..\\evil.docx', async () => {
      const user = makeUser();

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: SESSION_A }, error: null }),
      );

      const result = await service.createUploadRequest(
        PROJECT_A,
        {
          fileName: '..\\..\\windows\\system32\\cmd.docx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 2048,
        },
        user,
      );

      expect(result.path).not.toContain('..');
      expect(result.path).not.toContain('\\');
    });
  });

  // =========================================================================
  // 2. MIME Type Validation
  // =========================================================================
  describe('MIME Type Security Validation', () => {
    it('rejects unapproved MIME types like executable or html', async () => {
      const user = makeUser();

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );

      let caughtError: any;
      try {
        await service.createUploadRequest(
          PROJECT_A,
          {
            fileName: 'malicious.exe',
            mimeType: 'application/x-msdownload',
            sizeBytes: 1024,
          },
          user,
        );
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(BadRequestException);
      expect(caughtError.response?.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });

    it('rejects extension / MIME mismatch (e.g. .pdf extension with image/png MIME)', async () => {
      const user = makeUser();

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );

      let caughtError: any;
      try {
        await service.createUploadRequest(
          PROJECT_A,
          {
            fileName: 'fake.pdf',
            mimeType: 'image/png', // Mismatch: png mime expects .png
            sizeBytes: 1024,
          },
          user,
        );
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(BadRequestException);
      expect(caughtError.response?.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });
  });

  // =========================================================================
  // 3. Oversize File Rejection (> 25MB)
  // =========================================================================
  describe('File Size Limits', () => {
    it('rejects files larger than 25MB (26MB file)', async () => {
      const user = makeUser();

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );

      const OVERSIZE_BYTES = 26 * 1024 * 1024;

      let caughtError: any;
      try {
        await service.createUploadRequest(
          PROJECT_A,
          {
            fileName: 'large-video.pdf',
            mimeType: 'application/pdf',
            sizeBytes: OVERSIZE_BYTES,
          },
          user,
        );
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(BadRequestException);
      expect(caughtError.response?.code).toBe('FILE_TOO_LARGE');
    });
  });

  // =========================================================================
  // 4. Expired Upload Session
  // =========================================================================
  describe('Expired Upload Session Finalization', () => {
    it('throws ForbiddenException(FILE_UPLOAD_SESSION_EXPIRED) when upload session expired', async () => {
      const user = makeUser();
      const pastTime = new Date(Date.now() - 1000 * 60 * 30).toISOString(); // 30 mins ago

      // 1. requireFileAccess
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );
      // 2. getUploadSession: return expired session
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: SESSION_A,
            project_id: PROJECT_A,
            task_id: null,
            user_id: USER_A_ID,
            storage_path: 'projects/projA/file.pdf',
            completed_at: null,
            expires_at: pastTime,
          },
          error: null,
        }),
      );
      // delete expired session query
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      let caughtError: any;
      try {
        await service.finalize(PROJECT_A, { uploadSessionId: SESSION_A }, user);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FILE_UPLOAD_SESSION_EXPIRED');
    });
  });

  // =========================================================================
  // 5. File / Project Mismatch and Foreign Project File Access
  // =========================================================================
  describe('Foreign File / Project Mismatch (IDOR)', () => {
    it('throws ForbiddenException when attempting to download file from mismatched project', async () => {
      const user = makeUser();

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );
      // file belongs to PROJECT_B
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: FILE_A,
            project_id: PROJECT_B, // Mismatch with requested PROJECT_A
            delete_status: 'active',
            original_name: 'foreign.pdf',
            storage_path: 'projects/projB/foreign.pdf',
          },
          error: null,
        }),
      );

      let caughtError: any;
      try {
        await service.download(PROJECT_A, FILE_A, user);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FILE_ACCESS_DENIED');
    });
  });

  // =========================================================================
  // 6. Unauthorized Delete
  // =========================================================================
  describe('Unauthorized File Delete Prevention', () => {
    it('throws ForbiddenException when project viewer attempts to delete file', async () => {
      const viewerUser = makeUser();

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      // user is 'viewer'
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'viewer' }, error: null }),
      );

      let caughtError: any;
      try {
        await service.remove(PROJECT_A, FILE_A, viewerUser);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FILE_ACCESS_DENIED');
    });

    it('throws ForbiddenException when member deletes file uploaded by someone else', async () => {
      const memberUser = makeUser({ profileId: USER_A_ID });

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );
      // File uploaded by USER_B_ID
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: FILE_A,
            project_id: PROJECT_A,
            uploaded_by: USER_B_ID, // Not USER_A_ID
            delete_status: 'active',
            storage_path: 'projects/projA/file.pdf',
          },
          error: null,
        }),
      );

      let caughtError: any;
      try {
        await service.remove(PROJECT_A, FILE_A, memberUser);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FILE_ACCESS_DENIED');
    });
  });
});
