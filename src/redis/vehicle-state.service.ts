// D:\Sec\safe_path_nodejs\src\redis\vehicle-state.service.ts

import { Injectable } from '@nestjs/common';

import { RedisService } from './redis.service.js';

export interface LiveVehicleState {
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

@Injectable()
export class VehicleStateService {
  private readonly keyPrefix =
    'safepath:vehicle:';

  constructor(
    private readonly redisService: RedisService,
  ) {}

  private getKey(
    vehicleId: string,
  ): string {
    return `${this.keyPrefix}${vehicleId}:state`;
  }

  async setVehicleState(
    state: LiveVehicleState,
  ): Promise<void> {
    const key = this.getKey(
      state.vehicleId,
    );

    await this.redisService.set(
      key,
      JSON.stringify(state),
    );
  }

  async getVehicleState(
    vehicleId: string,
  ): Promise<LiveVehicleState | null> {
    const key = this.getKey(
      vehicleId,
    );

    const value =
      await this.redisService.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(
      value,
    ) as LiveVehicleState;
  }

  async deleteVehicleState(
    vehicleId: string,
  ): Promise<void> {
    await this.redisService.delete(
      this.getKey(vehicleId),
    );
  }
}