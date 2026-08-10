import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { EmbeddedUnderscoreNamingStrategy } from './embedded-underscore-naming.strategy';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  entities: [join(__dirname, 'entities', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  namingStrategy: new EmbeddedUnderscoreNamingStrategy(),
});
