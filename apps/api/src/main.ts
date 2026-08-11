import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Set global prefix to /api/v1
  app.setGlobalPrefix('api/v1');

  // Enable CORS matching WEB_URL origin
  app.enableCors({
    origin: configService.webUrl,
    credentials: true,
  });

  const port = configService.port;
  await app.listen(port);
  logger.log(`PGS Hub API started on port ${port}`);
}
void bootstrap();
