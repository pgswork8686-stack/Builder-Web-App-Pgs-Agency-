import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { SupabaseService } from '../supabase/supabase.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockSupabaseService: any;

  beforeEach(async () => {
    mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockResolvedValue({ data: [{ id: '1' }], error: null }),
          }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', () => {
    const result = controller.getHealth();
    expect(result).toMatchObject({
      status: 'ok',
      service: 'pgs-hub-api',
    });
    expect(result.timestamp).toBeDefined();
  });

  it('should return live status with uptime', () => {
    const result = controller.getLive();
    expect(result).toMatchObject({
      status: 'ok',
    });
    expect(result.uptime).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  it('should return ready status when database is connected', async () => {
    const result = await controller.getReady();
    expect(result).toMatchObject({
      status: 'ready',
      database: 'connected',
    });
    expect(typeof result.latencyMs).toBe('number');
    expect(result.timestamp).toBeDefined();
  });
});
