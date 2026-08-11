import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { AppRole } from '../src/auth/auth.types';
import { SupabaseService } from '../src/supabase/supabase.service';
import { CommentsService } from '../src/workspace/comments.service';
import { FilesService } from '../src/workspace/files.service';
import { WorkspaceRealtimeGateway } from '../src/workspace/workspace-realtime.gateway';
import { WorkspaceService } from '../src/workspace/workspace.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '33333333-3333-4333-8333-333333333333';
const FILE_ID = '44444444-4444-4444-8444-444444444444';

describe('Phase 4 workspace API (e2e)', () => {
  let app: INestApplication;
  let currentRole: AppRole = 'admin';

  const workspaceService = {
    getBoard: jest.fn().mockImplementation((_projectId, _query, user) => {
      if (user.role === 'client') {
        throw new ForbiddenException({ code: 'PROJECT_ACCESS_DENIED' });
      }
      return {
        todo: [],
        inProgress: [],
        review: [],
        done: [],
        total: 0,
      };
    }),
    getCalendar: jest.fn().mockResolvedValue([]),
    moveTask: jest
      .fn()
      .mockImplementation((_projectId, _taskId, _dto, user) => {
        if (user.role === 'employee') {
          throw new ForbiddenException({ code: 'KANBAN_MOVE_DENIED' });
        }
        return { id: TASK_ID };
      }),
  };
  const commentsService = {
    list: jest.fn().mockImplementation((_projectId, _taskId, _query, user) => {
      if (user.role === 'client') {
        throw new ForbiddenException({ code: 'COMMENT_ACCESS_DENIED' });
      }
      return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    }),
    create: jest.fn().mockResolvedValue({ id: COMMENT_ID }),
    update: jest.fn().mockResolvedValue({ id: COMMENT_ID }),
    remove: jest.fn().mockResolvedValue({ success: true }),
  };
  const filesService = {
    list: jest.fn().mockImplementation((_projectId, _query, user) => {
      if (user.role === 'client') {
        throw new ForbiddenException({ code: 'FILE_ACCESS_DENIED' });
      }
      return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    }),
    createUploadRequest: jest.fn().mockImplementation((_projectId, dto) => {
      if (dto.mimeType === 'application/x-msdownload') {
        throw new BadRequestException({ code: 'FILE_TYPE_NOT_ALLOWED' });
      }
      if (dto.sizeBytes > 25 * 1024 * 1024) {
        throw new BadRequestException({ code: 'FILE_TOO_LARGE' });
      }
      return { uploadSessionId: FILE_ID };
    }),
    finalize: jest.fn().mockResolvedValue({ id: FILE_ID }),
    download: jest.fn().mockResolvedValue({
      signedUrl: 'https://storage.example/download',
      expiresIn: 120,
    }),
    remove: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeAll(async () => {
    const authClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: FILE_ID, email: 'phase4@example.com' } },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation(() => {
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn(() => chain);
        chain.maybeSingle = jest.fn().mockImplementation(() =>
          Promise.resolve({
            data: {
              id: FILE_ID,
              role: currentRole,
              account_status: 'active',
            },
            error: null,
          }),
        );
        return chain;
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getSystemClient: () => authClient,
        createUserClient: () => authClient,
      })
      .overrideProvider(WorkspaceRealtimeGateway)
      .useValue({ emitProjectEvent: jest.fn() })
      .overrideProvider(WorkspaceService)
      .useValue(workspaceService)
      .overrideProvider(CommentsService)
      .useValue(commentsService)
      .overrideProvider(FilesService)
      .useValue(filesService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    currentRole = 'admin';
    jest.clearAllMocks();
  });

  afterAll(async () => app.close());

  const authorized = () => ({ Authorization: 'Bearer phase-4-token' });

  it('serves board, calendar, comments and files under one project scope', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/board`)
      .set(authorized())
      .expect(200);
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${PROJECT_ID}/calendar?from=2026-08-01&to=2026-08-31`,
      )
      .set(authorized())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}/comments`)
      .set(authorized())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/files`)
      .set(authorized())
      .expect(200);
  });

  it.each([
    'calendar?from=2026-08-12&to=2026-08-11',
    'calendar?from=2026-02-30&to=2026-03-01',
    'calendar?from=2026-01-01&to=2026-05-01',
  ])('rejects invalid calendar query %s', async (path) => {
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/${path}`)
      .set(authorized())
      .expect(400);
  });

  it('rejects permissive pagination, empty comments and oversized comments', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}/comments?pageSize=20abc`,
      )
      .set(authorized())
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}/comments`)
      .set(authorized())
      .send({ content: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}/comments`)
      .set(authorized())
      .send({ content: 'x'.repeat(10001) })
      .expect(400);
  });

  it('rejects invalid MIME and oversized upload metadata with safe codes', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/files/upload-request`)
      .set(authorized())
      .send({
        fileName: 'payload.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 100,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('FILE_TYPE_NOT_ALLOWED'));
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/files/upload-request`)
      .set(authorized())
      .send({
        fileName: 'large.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 25 * 1024 * 1024 + 1,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('FILE_TOO_LARGE'));
  });

  it('denies clients from every internal Phase 4 surface', async () => {
    currentRole = 'client';
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/board`)
      .set(authorized())
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}/comments`)
      .set(authorized())
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/files`)
      .set(authorized())
      .expect(403);
  });

  it('denies normal member drag reorder while allowing manager/admin route', async () => {
    currentRole = 'employee';
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}/move`)
      .set(authorized())
      .send({ status: 'done' })
      .expect(403);
    currentRole = 'admin';
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}/move`)
      .set(authorized())
      .send({ status: 'done' })
      .expect(201);
  });
});
