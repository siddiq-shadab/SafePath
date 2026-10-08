// D:\Sec\safe_path_nodejs\src\vehicles\vehicles.module.ts

import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module.js';
import { WebsocketModule } from '../websocket/websocket.module.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [
    RedisModule,
    WebsocketModule,
  ],

  controllers: [
    VehiclesController,
  ],

  providers: [
    VehiclesService,
  ],

  exports: [
    VehiclesService,
  ],
})
export class VehiclesModule {}