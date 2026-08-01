import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { createOpenApiConfig } from './openapi.config';
import { OpenApiModule } from './openapi.module';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(OpenApiModule, { logger: false });

  try {
    const document = SwaggerModule.createDocument(app, createOpenApiConfig());
    const content = `${JSON.stringify(document, null, 2)}\n`;
    const outputDirectory = resolve(process.cwd(), 'openapi');
    const outputPath = resolve(outputDirectory, 'openapi.json');

    if (process.argv.includes('--check')) {
      let current: string | undefined;
      try {
        current = await readFile(outputPath, 'utf8');
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }

      if (current !== content) {
        throw new Error(
          'openapi/openapi.json is out of date. Run npm run openapi:generate.',
        );
      }
      return;
    }

    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, content);
  } finally {
    await app.close();
  }
}

void generateOpenApi();
