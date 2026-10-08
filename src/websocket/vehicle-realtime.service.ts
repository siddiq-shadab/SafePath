// D:\Sec\safe_path_nodejs\src\websocket\vehicle-realtime.service.ts

import { Injectable } from '@nestjs/common';

export interface VehicleRealtimePayload {
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

type VehicleListener = (
  payload: VehicleRealtimePayload,
) => void;

@Injectable()
export class VehicleRealtimeService {
  private readonly listeners =
    new Set<VehicleListener>();

  /**
   * Latest realtime state for every vehicle that has
   * published telemetry during the lifetime of this
   * backend process.
   *
   * PostgreSQL remains the permanent source of history.
   * Redis remains the live-state store.
   */
  private readonly latestVehicles =
    new Map<string, VehicleRealtimePayload>();

  subscribe(
    listener: VehicleListener,
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(
    payload: VehicleRealtimePayload,
  ): void {
    /**
     * Always keep the latest state in memory.
     *
     * This allows the Socket.IO gateway to provide a
     * fleet snapshot to newly connected display clients.
     */
    this.latestVehicles.set(
      payload.vehicleId,
      payload,
    );

    for (const listener of this.listeners) {
      listener(payload);
    }
  }

  /**
   * Returns the latest realtime state known by this
   * backend process.
   */
  getSnapshot(): VehicleRealtimePayload[] {
    return Array.from(
      this.latestVehicles.values(),
    );
  }

  /**
   * Returns the latest state for one vehicle.
   */
  getVehicle(
    vehicleId: string,
  ): VehicleRealtimePayload | undefined {
    return this.latestVehicles.get(
      vehicleId,
    );
  }

  /**
   * Remove a vehicle from the in-memory realtime
   * snapshot.
   */
  removeVehicle(
    vehicleId: string,
  ): void {
    this.latestVehicles.delete(
      vehicleId,
    );
  }

  /**
   * Clear all in-memory realtime state.
   *
   * PostgreSQL and Redis are not affected.
   */
  clear(): void {
    this.latestVehicles.clear();
  }
}