/**
 * REAL-SERVICE AUTHORIZATION TESTS: DocumentsService
 */
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const DOC_ID = 'doc11111-1111-4111-8111-111111111111';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: USER_ID,
    email: 'user@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Test User',
    avatarUrl: null,
    approvedAt: null,
    ...overrides,
  };
}

function mockQueryChain(response: { data: any; error: any; count?: number }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({
      data: response.data ?? [],
      error: response.error,
      count: response.count ?? 0,
    }),
    maybeSingle: jest.fn().mockResolvedValue(response),
    single: jest.fn().mockResolvedValue(response),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then: (resolve: (value: any) => any, reject?: (err: any) => any) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return chain;
}

describe('DocumentsService — Real Authorization Logic', () => {
  let service: DocumentsService;
  let fromMock: jest.Mock;
  let storageMock: { from: jest.Mock };

  beforeEach(async () => {
    fromMock = jest.fn();
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
      }),
    };

    const mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        from: fromMock,
        storage: storageMock,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('Document Upload & Access Level Scoping', () => {
    it('throws ForbiddenException when client tries to upload company document', async () => {
      const clientUser = makeUser({ role: 'client' });
      await expect(
        service.createUploadSession(
          {
            title: 'Unauthorized Doc',
            category: 'general',
            fileName: 'test.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            version: '1.0',
            accessLevel: 'public_company',
          },
          clientUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when employee tries to download management_only document', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: DOC_ID,
            title: 'Confidential Strategy',
            access_level: 'management_only',
            storage_bucket: 'company-documents',
            storage_path: 'general/confidential.pdf',
            file_name: 'confidential.pdf',
            delete_status: 'active',
          },
          error: null,
        }),
      );

      await expect(
        service.getDownloadUrl(DOC_ID, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows employee to download internal_only or public_company document', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: DOC_ID,
            title: 'Employee Handbook',
            access_level: 'internal_only',
            storage_bucket: 'company-documents',
            storage_path: 'general/handbook.pdf',
            file_name: 'handbook.pdf',
            delete_status: 'active',
          },
          error: null,
        }),
      );

      const result = await service.getDownloadUrl(DOC_ID, employeeUser);
      expect(result.downloadUrl).toBeDefined();
    });
  });
});
