import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ConfigService } from './../src/config/config.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'pgs-hub-api',
      });
  });

  it('should run under test environment (APP_ENV=test)', () => {
    const configService = app.get(ConfigService);
    expect(configService.appEnv).toBe('test');
    expect(process.env.APP_ENV).toBe('test');
  });

  afterEach(async () => {
    await app.close();
  });
});
