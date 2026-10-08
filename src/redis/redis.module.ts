// D:\Sec\safe_path_nodejs\src\redis\redis.module.ts

import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service.js';
import { VehicleStateService } from './vehicle-state.service.js';

@Global()
@Module({
  providers: [
    RedisService,
    VehicleStateService,
  ],
  exports: [
    RedisService,
    VehicleStateService,
  ],
})
export class RedisModule {}