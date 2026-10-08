// D:\Sec\safe_path_nodejs\src\emergency\emergency.module.ts

import { Module } from '@nestjs/common';

import {
  EmergencyController,
} from './emergency.controller.js';

import {
  EmergencyService,
} from './emergency.service.js';

import {
  EmergencyGateway,
} from './emergency.gateway.js';

@Module({
  controllers: [
    EmergencyController,
  ],

  providers: [
    EmergencyService,
    EmergencyGateway,
  ],

  exports: [
    EmergencyService,
    EmergencyGateway,
  ],
})
export class EmergencyModule {}