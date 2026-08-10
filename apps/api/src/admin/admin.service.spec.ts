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
    rpc: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: SupabaseService,
          useValue: {
            getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getPendingUsers', () => {
    it('should return paginated pending users using canonical structure', async () => {
      const mockProfiles = [
        {
          id: 'u1',
          email: 'u1@example.com',
          account_status: 'pending',
          role: null,
          full_name: 'User 1',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
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

      const result = await service.getPendingUsers(1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].email).toBe('u1@example.com');
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
      });
    });
  });

  describe('approveUser', () => {
    it('should throw BadRequestException if role is admin', async () => {
      await expect(
        service.approveUser('admin-1', 'u1', 'admin' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call approve_pending_account RPC and return success', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { role: 'employee', status: 'active' },
        error: null,
      });

      const singleMock = jest.fn().mockResolvedValue({
        data: { id: 'u1', email: 'u1@test.com', full_name: 'Test' },
        error: null,
      });
      const eqMock = jest.fn().mockReturnValue({ single: singleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      const result = await service.approveUser('admin-1', 'u1', 'employee');

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('approve_pending_account', {
        p_admin_user_id: 'admin-1',
        p_target_user_id: 'u1',
        p_role: 'employee',
      });
      expect(result.user.role).toBe('employee');
      expect(result.user.account_status).toBe('active');
    });

    it('should map RPC code P0007 to NotFoundException', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { code: 'P0007', message: 'Target profile not found' },
      });

      await expect(
        service.approveUser('admin-1', 'u1', 'employee'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectUser', () => {
    it('should throw BadRequestException if reason is less than 3 chars', async () => {
      await expect(
        service.rejectUser('admin-1', 'u1', 'ab'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reason is missing', async () => {
      await expect(
        service.rejectUser('admin-1', 'u1', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call reject_pending_account RPC and return success', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { role: null, status: 'rejected' },
        error: null,
      });

      const singleMock = jest.fn().mockResolvedValue({
        data: { id: 'u1', email: 'u1@test.com', full_name: 'Test' },
        error: null,
      });
      const eqMock = jest.fn().mockReturnValue({ single: singleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      const result = await service.rejectUser('admin-1', 'u1', 'Invalid identity details provided');

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('reject_pending_account', {
        p_admin_user_id: 'admin-1',
        p_target_user_id: 'u1',
        p_reason: 'Invalid identity details provided',
      });
      expect(result.user.role).toBeNull();
      expect(result.user.account_status).toBe('rejected');
    });
  });
});
