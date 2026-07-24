import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  entities: [
    join(__dirname, 'entities', '*.entity{.ts,.js}'),
    join(__dirname, '..', 'patients', 'entities', '*.entity{.ts,.js}'),
  ],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
});
