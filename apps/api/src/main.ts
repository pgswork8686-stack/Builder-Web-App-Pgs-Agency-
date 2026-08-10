import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix to /api/v1
  app.setGlobalPrefix('api/v1');

  // Enable CORS for frontend
  app.enableCors();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`PGS Hub API is running on: http://localhost:${port}/api/v1`);
}
void bootstrap();
