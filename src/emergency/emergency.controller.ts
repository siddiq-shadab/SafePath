// D:\Sec\safe_path_nodejs\src\emergency\emergency.controller.ts

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { EmergencyService } from './emergency.service.js';
import type { EmergencySosDto } from './emergency.service.js';

@Controller('api/emergency')
export class EmergencyController {
  constructor(
    private readonly emergencyService: EmergencyService,
  ) {}

  @Post('sos')
  @HttpCode(HttpStatus.OK)
  async createSos(
    @Body() body: EmergencySosDto,
  ) {
    return this.emergencyService.createSos(
      body,
    );
  }
}