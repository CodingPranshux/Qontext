import pg from 'pg';
import { config } from './index.js';

let pool;

export function getPgPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.postgres.url,
      ssl: config.postgres.ssl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}
