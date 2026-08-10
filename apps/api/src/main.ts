import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
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
  console.log(`PGS Hub API is running on: http://localhost:${port}/api/v1`);
}
void bootstrap();
