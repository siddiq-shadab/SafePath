// D:\Sec\safe_path_nodejs\src\websocket\websocket.module.ts

import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module.js';

import { VehicleRealtimeService } from './vehicle-realtime.service.js';
import { VehicleGateway } from './vehicle.gateway.js';

@Module({
  imports: [
    RedisModule,
  ],
  providers: [
    VehicleRealtimeService,
    VehicleGateway,
  ],
  exports: [
    VehicleRealtimeService,
  ],
})
export class WebsocketModule {}