// D:\Sec\safe_path_nodejs\src\redis\redis.service.ts

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';

interface RedisClient {
  on(
    event: 'error',
    listener: (error: Error) => void,
  ): this;

  on(
    event: 'connect' | 'ready',
    listener: () => void,
  ): this;

  ping(): Promise<string>;

  set(
    key: string,
    value: string,
  ): Promise<'OK'>;

  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
  ): Promise<'OK'>;

  get(
    key: string,
  ): Promise<string | null>;

  del(
    key: string,
  ): Promise<number>;

  exists(
    key: string,
  ): Promise<number>;

  quit(): Promise<string>;
}

interface RedisConstructor {
  new (
    url: string,
    options?: {
      maxRetriesPerRequest?: number;
      enableReadyCheck?: boolean;
    },
  ): RedisClient;
}

const require = createRequire(import.meta.url);

const Redis = require(
  'ioredis',
) as RedisConstructor;

@Injectable()
export class RedisService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger =
    new Logger(RedisService.name);

  private readonly client: RedisClient;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const redisUrl =
      this.configService.get<string>(
        'REDIS_URL',
      ) ??
      'redis://127.0.0.1:6379';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    this.client.on(
      'error',
      (error: Error) => {
        this.logger.error(
          `Redis error: ${error.message}`,
        );
      },
    );

    this.client.on(
      'connect',
      () => {
        this.logger.log(
          'Redis connection established.',
        );
      },
    );

    this.client.on(
      'ready',
      () => {
        this.logger.log(
          'Redis is ready.',
        );
      },
    );
  }

  async onModuleInit(): Promise<void> {
    const result =
      await this.client.ping();

    if (result !== 'PONG') {
      throw new Error(
        `Redis ping failed. Received: ${result}`,
      );
    }

    this.logger.log(
      'Redis connected: PONG',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  getClient(): RedisClient {
    return this.client;
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK'> {
    if (ttlSeconds !== undefined) {
      return this.client.set(
        key,
        value,
        'EX',
        ttlSeconds,
      );
    }

    return this.client.set(
      key,
      value,
    );
  }

  async get(
    key: string,
  ): Promise<string | null> {
    return this.client.get(key);
  }

  async delete(
    key: string,
  ): Promise<number> {
    return this.client.del(key);
  }

  async exists(
    key: string,
  ): Promise<number> {
    return this.client.exists(key);
  }
}