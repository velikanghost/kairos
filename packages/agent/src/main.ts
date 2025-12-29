import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe with detailed error logging
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        logger.error('Validation failed:', JSON.stringify(errors, null, 2));
        return new Error(`Validation failed: ${JSON.stringify(errors)}`);
      },
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 Agent backend is running on: http://localhost:${port}`);
  logger.log(`🔌 WebSocket server is ready for connections`);
  logger.log(`📊 Indexer GraphQL: ${process.env.INDEXER_GRAPHQL_URL || 'http://localhost:8080/v1/graphql'}`);
}

bootstrap();
