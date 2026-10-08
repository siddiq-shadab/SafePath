// D:\Sec\safe_path_nodejs\src\database\database.service.ts

import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const host =
      this.configService.get<string>('POSTGRES_HOST') ?? '127.0.0.1';

    const port =
      this.configService.get<number>('POSTGRES_PORT') ?? 5432;

    const user =
      this.configService.get<string>('POSTGRES_USER');

    const password =
      this.configService.get<string>('POSTGRES_PASSWORD');

    const database =
      this.configService.get<string>('POSTGRES_DB');

    if (!user) {
      throw new Error('POSTGRES_USER is not configured.');
    }

    if (!password) {
      throw new Error('POSTGRES_PASSWORD is not configured.');
    }

    if (!database) {
      throw new Error('POSTGRES_DB is not configured.');
    }

    console.log(
      `PostgreSQL configuration: ${user}@${host}:${port}/${database}`,
    );

    this.pool = new Pool({
      host,
      port,
      user,
      password,
      database,

      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (error) => {
      console.error(
        'Unexpected PostgreSQL pool error:',
        error,
      );
    });
  }

  /**
   * Verify PostgreSQL when NestJS starts.
   */
  async onModuleInit(): Promise<void> {
    const client = await this.pool.connect();

    try {
      const result = await client.query<{
        current_user: string;
        current_database: string;
        server_version: string;
      }>(`
        SELECT
          current_user,
          current_database(),
          version() AS server_version
      `);

      const row = result.rows[0];

      console.log(
        `PostgreSQL connected: ${row.current_user}@${row.current_database}`,
      );

      console.log(
        `PostgreSQL server: ${row.server_version}`,
      );
    } finally {
      client.release();
    }
  }

  /**
   * Gracefully close the PostgreSQL pool.
   */
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Execute a parameterized PostgreSQL query.
   */
  async query<
    T extends QueryResultRow = QueryResultRow,
  >(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  /**
   * Acquire a PostgreSQL client.
   *
   * Useful for transactions or multiple queries
   * that must use the same connection.
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}