// D:\Sec\safe_path_nodejs\src\vehicles\vehicles.service.ts

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { VehicleStateService } from '../redis/vehicle-state.service.js';
import { VehicleTelemetryDto } from './dto/vehicle-telemetry.dto.js';
import { VehicleRealtimeService } from '../websocket/vehicle-realtime.service.js';

export interface VehicleTelemetryResponse {
  vehicleId: string;
  vehicleType: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number | null;
  lastOnline: string | null;
  currentOnline: boolean;
}

export interface VehicleHistoryResponse {
  vehicleId: string;
  vehicleType: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number | null;
  recordedAt: string;
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly databaseService: DatabaseService,

    private readonly vehicleStateService:
      VehicleStateService,

    private readonly vehicleRealtimeService:
      VehicleRealtimeService,
  ) {}

  // =========================================================
  // UPDATE VEHICLE TELEMETRY
  // =========================================================

  async updateTelemetry(
    telemetry: VehicleTelemetryDto,
  ): Promise<VehicleTelemetryResponse> {
    const result =
      await this.databaseService.query<{
        vehicle_id: string;
        vehicle_type: string;
        latitude: number;
        longitude: number;
        speed: number;
        heading: number;
        accuracy: number | null;
        last_online: Date | null;
        current_online: boolean;
      }>(
        `
        INSERT INTO vehicles (
          vehicle_id,
          vehicle_type,
          latitude,
          longitude,
          speed,
          heading,
          accuracy,
          current_location,
          last_online,
          current_online,
          updated_at
        )
        VALUES (
          $1,
          $2::vehicle_type,
          $3,
          $4,
          $5,
          $6,
          $7,
          ST_SetSRID(
            ST_MakePoint($4, $3),
            4326
          ),
          $8::timestamptz,
          $9,
          NOW()
        )
        ON CONFLICT (vehicle_id)
        DO UPDATE SET
          vehicle_type = EXCLUDED.vehicle_type,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          speed = EXCLUDED.speed,
          heading = EXCLUDED.heading,
          accuracy = EXCLUDED.accuracy,
          current_location = EXCLUDED.current_location,
          last_online = EXCLUDED.last_online,
          current_online = EXCLUDED.current_online,
          updated_at = NOW()
        RETURNING
          vehicle_id,
          vehicle_type::text AS vehicle_type,
          latitude,
          longitude,
          speed,
          heading,
          accuracy,
          last_online,
          current_online
        `,
        [
          telemetry.vehicleId,
          telemetry.vehicleType,
          telemetry.latitude,
          telemetry.longitude,
          telemetry.speed,
          telemetry.heading,
          telemetry.accuracy ?? null,
          telemetry.lastOnline,
          telemetry.currentOnline,
        ],
      );

    const vehicle = result.rows[0];

    if (!vehicle) {
      throw new NotFoundException(
        'Vehicle telemetry could not be stored.',
      );
    }

    // ---------------------------------------------------------
    // Permanent location history
    // ---------------------------------------------------------

    await this.databaseService.query(
      `
      INSERT INTO vehicle_locations (
        vehicle_id,
        latitude,
        longitude,
        position,
        speed,
        heading,
        accuracy,
        recorded_at
      )
      SELECT
        id,
        $2,
        $3,
        ST_SetSRID(
          ST_MakePoint($3, $2),
          4326
        ),
        $4,
        $5,
        $6,
        $7::timestamptz
      FROM vehicles
      WHERE vehicle_id = $1
      `,
      [
        telemetry.vehicleId,
        telemetry.latitude,
        telemetry.longitude,
        telemetry.speed,
        telemetry.heading,
        telemetry.accuracy ?? null,
        telemetry.lastOnline,
      ],
    );

    const response: VehicleTelemetryResponse = {
      vehicleId:
        vehicle.vehicle_id,

      vehicleType:
        vehicle.vehicle_type,

      latitude:
        Number(vehicle.latitude),

      longitude:
        Number(vehicle.longitude),

      speed:
        Number(vehicle.speed),

      heading:
        Number(vehicle.heading),

      accuracy:
        vehicle.accuracy === null
          ? null
          : Number(vehicle.accuracy),

      lastOnline:
        vehicle.last_online
          ? vehicle.last_online.toISOString()
          : null,

      currentOnline:
        vehicle.current_online,
    };

    // ---------------------------------------------------------
    // Redis
    // ---------------------------------------------------------

    await this.vehicleStateService.setVehicleState(
      response,
    );

    // ---------------------------------------------------------
    // Socket.IO realtime event
    // ---------------------------------------------------------

    this.vehicleRealtimeService.publish(
      response,
    );

    return response;
  }

  // =========================================================
  // GET ONE VEHICLE
  // =========================================================

  async getVehicle(
    vehicleId: string,
  ): Promise<VehicleTelemetryResponse> {
    const result =
      await this.databaseService.query<{
        vehicle_id: string;
        vehicle_type: string;
        latitude: number;
        longitude: number;
        speed: number;
        heading: number;
        accuracy: number | null;
        last_online: Date | null;
        current_online: boolean;
      }>(
        `
        SELECT
          vehicle_id,
          vehicle_type::text AS vehicle_type,
          latitude,
          longitude,
          speed,
          heading,
          accuracy,
          last_online,
          current_online
        FROM vehicles
        WHERE vehicle_id = $1
        `,
        [vehicleId],
      );

    const vehicle = result.rows[0];

    if (!vehicle) {
      throw new NotFoundException(
        `Vehicle '${vehicleId}' was not found.`,
      );
    }

    return {
      vehicleId:
        vehicle.vehicle_id,

      vehicleType:
        vehicle.vehicle_type,

      latitude:
        Number(vehicle.latitude),

      longitude:
        Number(vehicle.longitude),

      speed:
        Number(vehicle.speed),

      heading:
        Number(vehicle.heading),

      accuracy:
        vehicle.accuracy === null
          ? null
          : Number(vehicle.accuracy),

      lastOnline:
        vehicle.last_online
          ? vehicle.last_online.toISOString()
          : null,

      currentOnline:
        vehicle.current_online,
    };
  }

  // =========================================================
  // GET CURRENT LIVE VEHICLE STATE
  // =========================================================

  async getLiveVehicleState(
    vehicleId: string,
  ): Promise<VehicleTelemetryResponse | null> {
    return this.vehicleStateService.getVehicleState(
      vehicleId,
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

  async getAllVehicles(): Promise<
    VehicleTelemetryResponse[]
  > {
    const result =
      await this.databaseService.query<{
        vehicle_id: string;
        vehicle_type: string;
        latitude: number;
        longitude: number;
        speed: number;
        heading: number;
        accuracy: number | null;
        last_online: Date | null;
        current_online: boolean;
      }>(
        `
        SELECT
          vehicle_id,
          vehicle_type::text AS vehicle_type,
          latitude,
          longitude,
          speed,
          heading,
          accuracy,
          last_online,
          current_online
        FROM vehicles
        ORDER BY
          current_online DESC,
          updated_at DESC,
          vehicle_id ASC
        `,
      );

    return result.rows.map(
      (vehicle): VehicleTelemetryResponse => ({
        vehicleId:
          vehicle.vehicle_id,

        vehicleType:
          vehicle.vehicle_type,

        latitude:
          Number(vehicle.latitude),

        longitude:
          Number(vehicle.longitude),

        speed:
          Number(vehicle.speed),

        heading:
          Number(vehicle.heading),

        accuracy:
          vehicle.accuracy === null
            ? null
            : Number(vehicle.accuracy),

        lastOnline:
          vehicle.last_online
            ? vehicle.last_online.toISOString()
            : null,

        currentOnline:
          vehicle.current_online,
      }),
    );
  }

  // =========================================================
  // GET VEHICLE HISTORY
  //
  // Permanent historical data comes from:
  // PostgreSQL + PostGIS
  //
  // Optional:
  // - from
  // - to
  // - limit
  // =========================================================

  async getVehicleHistory(
    vehicleId: string,
    from?: string,
    to?: string,
    limit = 5000,
  ): Promise<VehicleHistoryResponse[]> {
    const vehicleResult =
      await this.databaseService.query<{
        vehicle_id: string;
        vehicle_type: string;
      }>(
        `
        SELECT
          vehicle_id,
          vehicle_type::text AS vehicle_type
        FROM vehicles
        WHERE vehicle_id = $1
        `,
        [vehicleId],
      );

    const vehicle =
      vehicleResult.rows[0];

    if (!vehicle) {
      throw new NotFoundException(
        `Vehicle '${vehicleId}' was not found.`,
      );
    }

    const safeLimit = Math.min(
      Math.max(Number(limit) || 5000, 1),
      50000,
    );

    const parameters: unknown[] = [
      vehicleId,
    ];

    let parameterIndex = 2;

    let timeCondition = '';

    if (from) {
      timeCondition += `
        AND vl.recorded_at >= $${parameterIndex}::timestamptz
      `;

      parameters.push(from);
      parameterIndex += 1;
    }

    if (to) {
      timeCondition += `
        AND vl.recorded_at <= $${parameterIndex}::timestamptz
      `;

      parameters.push(to);
      parameterIndex += 1;
    }

    parameters.push(safeLimit);

    const limitParameterIndex =
      parameterIndex;

    const result =
      await this.databaseService.query<{
        vehicle_id: string;
        vehicle_type: string;
        latitude: number;
        longitude: number;
        speed: number;
        heading: number;
        accuracy: number | null;
        recorded_at: Date;
      }>(
        `
        SELECT
          v.vehicle_id,
          v.vehicle_type::text AS vehicle_type,
          vl.latitude,
          vl.longitude,
          vl.speed,
          vl.heading,
          vl.accuracy,
          vl.recorded_at
        FROM vehicle_locations vl
        INNER JOIN vehicles v
          ON v.id = vl.vehicle_id
        WHERE v.vehicle_id = $1
        ${timeCondition}
        ORDER BY
          vl.recorded_at ASC
        LIMIT $${limitParameterIndex}
        `,
        parameters,
      );

    return result.rows.map(
      (row): VehicleHistoryResponse => ({
        vehicleId:
          row.vehicle_id,

        vehicleType:
          row.vehicle_type,

        latitude:
          Number(row.latitude),

        longitude:
          Number(row.longitude),

        speed:
          Number(row.speed),

        heading:
          Number(row.heading),

        accuracy:
          row.accuracy === null
            ? null
            : Number(row.accuracy),

        recordedAt:
          row.recorded_at.toISOString(),
      }),
    );
  }
}