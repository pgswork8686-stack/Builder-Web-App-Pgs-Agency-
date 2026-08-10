import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;

  const mockSupabaseClient = {
    auth: {
      admin: {
        getUserById: jest.fn(),
      },
    },
    from: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getPendingUsers', () => {
    it('should return paginated pending users', async () => {
      const mockProfiles = [
        {
          id: 'u1',
          account_status: 'pending',
          role: null,
          full_name: 'User 1',
        },
      ];

      const rangeMock = jest.fn().mockResolvedValue({
        data: mockProfiles,
        count: 1,
        error: null,
      });
      const orderMock = jest.fn().mockReturnValue({ range: rangeMock });
      const eqMock = jest.fn().mockReturnValue({ order: orderMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'u1@example.com' } },
      });

      const result = await service.getPendingUsers(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe('u1@example.com');
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('approveUser', () => {
    it('should throw BadRequestException if role is admin', async () => {
      await expect(
        service.approveUser('admin-1', 'u1', 'admin' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if target user profile not found', async () => {
      const maybeSingleMock = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const eqMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      await expect(
        service.approveUser('admin-1', 'u1', 'employee'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if target user status is not pending', async () => {
      const maybeSingleMock = jest.fn().mockResolvedValue({
        data: { id: 'u1', account_status: 'active' },
        error: null,
      });
      const eqMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      await expect(
        service.approveUser('admin-1', 'u1', 'employee'),
      ).rejects.toThrow(ConflictException);
    });

    it('should approve pending user and write event', async () => {
      const maybeSingleMock = jest.fn().mockResolvedValue({
        data: { id: 'u1', account_status: 'pending', role: null },
        error: null,
      });
      const eqFetchMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: maybeSingleMock });

      const singleUpdateMock = jest.fn().mockResolvedValue({
        data: {
          id: 'u1',
          role: 'employee',
          account_status: 'active',
          full_name: 'Test',
          avatar_url: null,
        },
        error: null,
      });
      const selectUpdateMock = jest
        .fn()
        .mockReturnValue({ single: singleUpdateMock });
      const eqUpdateMock = jest
        .fn()
        .mockReturnValue({ select: selectUpdateMock });
      const updateMock = jest.fn().mockReturnValue({ eq: eqUpdateMock });
      const insertEventMock = jest.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({ eq: eqFetchMock }),
            update: updateMock,
          };
        }
        if (table === 'account_approval_events') {
          return {
            insert: insertEventMock,
          };
        }
        return {};
      });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'u1@test.com' } },
      });

      const result = await service.approveUser('admin-1', 'u1', 'employee');

      expect(result.user.role).toBe('employee');
      expect(result.user.account_status).toBe('active');
      expect(insertEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          target_user_id: 'u1',
          actor_id: 'admin-1',
          action: 'approve',
          new_role: 'employee',
          new_status: 'active',
        }),
      );
    });
  });

  describe('rejectUser', () => {
    it('should reject pending user and write event', async () => {
      const maybeSingleMock = jest.fn().mockResolvedValue({
        data: { id: 'u1', account_status: 'pending', role: null },
        error: null,
      });
      const eqFetchMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: maybeSingleMock });

      const singleUpdateMock = jest.fn().mockResolvedValue({
        data: {
          id: 'u1',
          role: null,
          account_status: 'rejected',
          full_name: 'Test',
          avatar_url: null,
        },
        error: null,
      });
      const selectUpdateMock = jest
        .fn()
        .mockReturnValue({ single: singleUpdateMock });
      const eqUpdateMock = jest
        .fn()
        .mockReturnValue({ select: selectUpdateMock });
      const updateMock = jest.fn().mockReturnValue({ eq: eqUpdateMock });
      const insertEventMock = jest.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({ eq: eqFetchMock }),
            update: updateMock,
          };
        }
        if (table === 'account_approval_events') {
          return {
            insert: insertEventMock,
          };
        }
        return {};
      });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'u1@test.com' } },
      });

      const result = await service.rejectUser(
        'admin-1',
        'u1',
        'Invalid application',
      );

      expect(result.user.role).toBeNull();
      expect(result.user.account_status).toBe('rejected');
      expect(insertEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          target_user_id: 'u1',
          actor_id: 'admin-1',
          action: 'reject',
          new_role: null,
          new_status: 'rejected',
          notes: 'Invalid application',
        }),
      );
    });
  });
});
