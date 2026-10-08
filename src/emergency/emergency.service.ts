// D:\Sec\safe_path_nodejs\src\emergency\emergency.service.ts

import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  EmergencyGateway,
} from './emergency.gateway.js';

export interface EmergencySosDto {
  vehicleId: string;

  vehicleType: string;

  latitude: number;

  longitude: number;

  speed: number;

  heading: number;

  accuracy: number | null;

  lastOnline: string;

  currentOnline: boolean;
}

export interface EmergencySosPayload {
  vehicleId: string;

  vehicleType: string;

  latitude: number;

  longitude: number;

  speed: number;

  heading: number;

  accuracy: number | null;

  lastOnline: string;

  currentOnline: boolean;

  reportedAt: string;
}

@Injectable()
export class EmergencyService {
  constructor(
    private readonly emergencyGateway: EmergencyGateway,
  ) {}

  async createSos(
    body: EmergencySosDto,
  ): Promise<{
    success: true;
    message: string;
    emergency: EmergencySosPayload;
  }> {
    this.validateSos(body);

    const emergency: EmergencySosPayload = {
      vehicleId:
        body.vehicleId.trim(),

      vehicleType:
        this.normalizeVehicleType(
          body.vehicleType,
        ),

      latitude:
        body.latitude,

      longitude:
        body.longitude,

      speed:
        body.speed,

      heading:
        body.heading,

      accuracy:
        body.accuracy === null ||
        body.accuracy === undefined
          ? null
          : body.accuracy,

      lastOnline:
        body.lastOnline,

      currentOnline:
        body.currentOnline,

      reportedAt:
        new Date().toISOString(),
    };

    console.log(
      `[Emergency] SOS received from vehicle ${emergency.vehicleId}`,
    );

    this.emergencyGateway.broadcastSos(
      emergency,
    );

    return {
      success: true,

      message:
        'Emergency SOS received successfully.',

      emergency,
    };
  }

  private normalizeVehicleType(
    value: string,
  ): string {
    const normalized =
      value
        .trim()
        .toUpperCase()
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ');

    switch (normalized) {
      case 'CAR':
        return 'CAR';

      case 'VIP':
        return 'VIP';

      case 'POLICE':
        return 'POLICE';

      case 'FIRE ENGINE':
        return 'FIRE_ENGINE';

      case 'AMBULANCE':
        return 'AMBULANCE';

      default:
        return normalized.replace(
          /\s+/g,
          '_',
        );
    }
  }

  private validateSos(
    body: EmergencySosDto,
  ): void {
    if (
      !body ||
      typeof body !== 'object'
    ) {
      throw new BadRequestException(
        'Emergency SOS payload is required.',
      );
    }

    if (
      typeof body.vehicleId !== 'string' ||
      body.vehicleId.trim() === ''
    ) {
      throw new BadRequestException(
        'vehicleId is required.',
      );
    }

    if (
      typeof body.vehicleType !== 'string' ||
      body.vehicleType.trim() === ''
    ) {
      throw new BadRequestException(
        'vehicleType is required.',
      );
    }

    const vehicleType =
      this.normalizeVehicleType(
        body.vehicleType,
      );

    const supportedVehicleTypes = [
      'CAR',
      'VIP',
      'POLICE',
      'FIRE_ENGINE',
      'AMBULANCE',
    ];

    if (
      !supportedVehicleTypes.includes(
        vehicleType,
      )
    ) {
      throw new BadRequestException(
        `Unsupported vehicleType: ${body.vehicleType}`,
      );
    }

    if (
      !Number.isFinite(
        body.latitude,
      ) ||
      body.latitude < -90 ||
      body.latitude > 90
    ) {
      throw new BadRequestException(
        'Invalid latitude.',
      );
    }

    if (
      !Number.isFinite(
        body.longitude,
      ) ||
      body.longitude < -180 ||
      body.longitude > 180
    ) {
      throw new BadRequestException(
        'Invalid longitude.',
      );
    }

    if (
      !Number.isFinite(
        body.speed,
      ) ||
      body.speed < 0
    ) {
      throw new BadRequestException(
        'Invalid speed.',
      );
    }

    if (
      !Number.isFinite(
        body.heading,
      ) ||
      body.heading < 0 ||
      body.heading >= 360
    ) {
      throw new BadRequestException(
        'Invalid heading.',
      );
    }

    if (
      body.accuracy !== null &&
      body.accuracy !== undefined &&
      (
        !Number.isFinite(
          body.accuracy,
        ) ||
        body.accuracy < 0
      )
    ) {
      throw new BadRequestException(
        'Invalid accuracy.',
      );
    }

    if (
      typeof body.lastOnline !==
      'string' ||
      body.lastOnline.trim() === ''
    ) {
      throw new BadRequestException(
        'lastOnline is required.',
      );
    }

    const lastOnline =
      new Date(
        body.lastOnline,
      );

    if (
      Number.isNaN(
        lastOnline.getTime(),
      )
    ) {
      throw new BadRequestException(
        'lastOnline must be a valid ISO date.',
      );
    }

    if (
      typeof body.currentOnline !==
      'boolean'
    ) {
      throw new BadRequestException(
        'currentOnline must be boolean.',
      );
    }
  }
}