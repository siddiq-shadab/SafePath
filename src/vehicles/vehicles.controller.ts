// D:\Sec\safe_path_nodejs\src\vehicles\vehicles.controller.ts


import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';

import { VehicleTelemetryDto } from './dto/vehicle-telemetry.dto.js';
import { VehiclesService } from './vehicles.service.js';

@Controller('api/vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
  ) {}

  // =========================================================
  // RECEIVE VEHICLE TELEMETRY
  // =========================================================

  @Post('telemetry')
  async receiveTelemetry(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    telemetry: VehicleTelemetryDto,
  ) {
    return this.vehiclesService.updateTelemetry(
      telemetry,
    );
  }

  // =========================================================
  // GET ALL VEHICLES
  //
  // Used by:
  // - vehicles.html
  // - livemap.html
  // - Overview.html
  //
  // No vehicle search is required.
  // =========================================================

  @Get()
  async getAllVehicles() {
    return this.vehiclesService.getAllVehicles();
  }

  // =========================================================
  // GET VEHICLE HISTORY
  //
  // Example:
  //
  // GET /api/vehicles/TS02ER8769/history
  //
  // Optional:
  //
  // ?from=2026-10-05T00:00:00Z
  // &to=2026-10-05T23:59:59Z
  // &limit=5000
  // =========================================================

  @Get(':vehicleId/history')
  async getVehicleHistory(
    @Param('vehicleId') vehicleId: string,

    @Query('from') from?: string,

    @Query('to') to?: string,

    @Query('limit') limit?: string,
  ) {
    return this.vehiclesService.getVehicleHistory(
      vehicleId,
      from,
      to,
      limit
        ? Number(limit)
        : undefined,
    );
  }

  // =========================================================
  // GET CURRENT LIVE VEHICLE STATE
  // =========================================================

  @Get(':vehicleId/live')
  async getLiveVehicle(
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.vehiclesService.getLiveVehicleState(
      vehicleId,
    );
  }

  // =========================================================
  // GET ONE VEHICLE
  // =========================================================

  @Get(':vehicleId')
  async getVehicle(
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.vehiclesService.getVehicle(
      vehicleId,
    );
  }
}