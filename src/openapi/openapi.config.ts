import { DocumentBuilder } from '@nestjs/swagger';

export function createOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('FPC Backend API')
    .setDescription('FPC backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}
