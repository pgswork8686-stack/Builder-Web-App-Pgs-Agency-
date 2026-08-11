import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: { id: 'c1' }, error: null }),
      })),
      rpc: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: SupabaseService,
          useValue: {
            getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMembership', () => {
    it('should throw BadRequestException if member user role is not client', async () => {
      // Mock company exists
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: { id: 'c1' }, error: null }),
      }));

      // Mock RPC returns USER_NOT_A_CLIENT error
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'USER_NOT_A_CLIENT', code: 'P0003' },
      });

      await expect(
        service.createMembership(
          'c1',
          {
            userId: 'user-emp-1',
            isPrimary: true,
          },
          'admin-u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create membership successfully via RPC', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: { id: 'c1' }, error: null }),
      }));

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: { id: 'm1', is_primary: true },
        error: null,
      });

      const res = await service.createMembership(
        'c1',
        { userId: 'u1', isPrimary: true },
        'admin-u1',
      );

      expect(res).toEqual({ id: 'm1', is_primary: true });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'create_client_membership_atomic',
        {
          p_company_id: 'c1',
          p_user_id: 'u1',
          p_title: null,
          p_is_primary: true,
          p_created_by: 'admin-u1',
        },
      );
    });
  });
});
