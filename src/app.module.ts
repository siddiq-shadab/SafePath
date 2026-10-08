// D:\Sec\safe_path_nodejs\src\app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { WebsocketModule } from './websocket/websocket.module.js';
import { EmergencyModule } from './emergency/emergency.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ============================================================
    // SafePath Display
    //
    // The complete display folder is served from the root URL.
    //
    // Local:
    //   http://localhost:3000/
    //
    // Example:
    //   http://localhost:3000/pages/Overview.html
    //   http://localhost:3000/pages/alerts.html
    //   http://localhost:3000/pages/livemap.html
    //
    // Railway:
    //   https://YOUR-RAILWAY-DOMAIN/
    //   https://YOUR-RAILWAY-DOMAIN/pages/Overview.html
    // ============================================================

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'display'),
      serveRoot: '/',
    }),

    // ============================================================
    // Asset directory
    // ============================================================

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'asset'),
      serveRoot: '/asset',
    }),

    // ============================================================
    // Backend modules
    // ============================================================

    DatabaseModule,

    RedisModule,

    WebsocketModule,

    VehiclesModule,

    EmergencyModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}