// D:\Sec\safe_path_nodejs\src\websocket\vehicle.gateway.ts

import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

import { VehicleStateService } from '../redis/vehicle-state.service.js';

import {
  VehicleRealtimePayload,
  VehicleRealtimeService,
} from './vehicle-realtime.service.js';

@WebSocketGateway({
  namespace: '/vehicles',
  cors: {
    origin: '*',
  },
})
export class VehicleGateway
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger =
    new Logger(VehicleGateway.name);

  @WebSocketServer()
  private server!: Server;

  private unsubscribe?: () => void;

  constructor(
    private readonly realtimeService: VehicleRealtimeService,
    private readonly vehicleStateService: VehicleStateService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe =
      this.realtimeService.subscribe(
        (payload) => {
          this.broadcastVehicleTelemetry(
            payload,
          );
        },
      );

    this.logger.log(
      'Vehicle Socket.IO gateway initialized.',
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  /**
   * A display client connects to:
   *
   * http://localhost:3000/vehicles
   *
   * The client immediately receives:
   *
   * 1. connection:ready
   * 2. fleet:snapshot
   *
   * After that, every incoming vehicle telemetry
   * update is broadcast using fleet:telemetry.
   */
  handleConnection(
    socket: Socket,
  ): void {
    this.logger.log(
      `Socket connected: ${socket.id}`,
    );

    socket.emit(
      'connection:ready',
      {
        connected: true,
        namespace: '/vehicles',
        socketId: socket.id,
      },
    );

    /**
     * Send all vehicle states currently known by the
     * realtime service.
     *
     * This allows a newly opened Live Map to immediately
     * render the fleet without waiting for the next
     * telemetry packet.
     */
    const fleet =
      this.realtimeService.getSnapshot();

    socket.emit(
      'fleet:snapshot',
      {
        vehicles: fleet,
        count: fleet.length,
      },
    );

    this.logger.log(
      `Fleet snapshot sent to ${socket.id}: ${fleet.length} vehicle(s)`,
    );
  }

  handleDisconnect(
    socket: Socket,
  ): void {
    this.logger.log(
      `Socket disconnected: ${socket.id}`,
    );
  }

  /**
   * Vehicle-specific subscription.
   *
   * This remains available for events.html where only
   * one selected vehicle needs to be followed.
   */
  @SubscribeMessage('vehicle:subscribe')
  async handleVehicleSubscribe(
    @MessageBody()
    vehicleId: string,

    @ConnectedSocket()
    socket: Socket,
  ): Promise<void> {
    if (
      typeof vehicleId !== 'string' ||
      vehicleId.trim().length === 0
    ) {
      socket.emit(
        'vehicle:error',
        {
          message:
            'A valid vehicleId is required.',
        },
      );

      return;
    }

    const normalizedVehicleId =
      vehicleId.trim();

    const room =
      this.getVehicleRoom(
        normalizedVehicleId,
      );

    socket.join(room);

    socket.emit(
      'vehicle:subscribed',
      {
        vehicleId:
          normalizedVehicleId,
      },
    );

    this.logger.log(
      `Socket ${socket.id} subscribed to ${normalizedVehicleId}`,
    );

    /*
     * Immediately send the latest Redis state.
     *
     * This means events.html does not have to wait
     * for another telemetry POST before showing the
     * current vehicle.
     */
    try {
      const currentState =
        await this.vehicleStateService.getVehicleState(
          normalizedVehicleId,
        );

      if (currentState) {
        socket.emit(
          'vehicle:telemetry',
          currentState,
        );

        this.logger.log(
          `Initial telemetry sent to ${socket.id}: ${normalizedVehicleId}`,
        );
      } else {
        this.logger.log(
          `No Redis telemetry found for ${normalizedVehicleId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to load Redis state for ${normalizedVehicleId}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      socket.emit(
        'vehicle:error',
        {
          message:
            'Unable to load current vehicle telemetry.',
        },
      );
    }
  }

  /**
   * Vehicle-specific unsubscribe.
   */
  @SubscribeMessage('vehicle:unsubscribe')
  handleVehicleUnsubscribe(
    @MessageBody()
    vehicleId: string,

    @ConnectedSocket()
    socket: Socket,
  ): void {
    if (
      typeof vehicleId !== 'string' ||
      vehicleId.trim().length === 0
    ) {
      socket.emit(
        'vehicle:error',
        {
          message:
            'A valid vehicleId is required.',
        },
      );

      return;
    }

    const normalizedVehicleId =
      vehicleId.trim();

    const room =
      this.getVehicleRoom(
        normalizedVehicleId,
      );

    socket.leave(room);

    socket.emit(
      'vehicle:unsubscribed',
      {
        vehicleId:
          normalizedVehicleId,
      },
    );

    this.logger.log(
      `Socket ${socket.id} unsubscribed from ${normalizedVehicleId}`,
    );
  }

  /**
   * Broadcast telemetry to:
   *
   * 1. The vehicle-specific room.
   *    Used by events.html.
   *
   * 2. The complete /vehicles namespace.
   *    Used by livemap.html and other fleet displays.
   */
  private broadcastVehicleTelemetry(
    payload: VehicleRealtimePayload,
  ): void {
    if (!this.server) {
      this.logger.warn(
        'Socket.IO server is not initialized.',
      );

      return;
    }

    /**
     * ---------------------------------------------------
     * Vehicle-specific broadcast
     * ---------------------------------------------------
     */
    const room =
      this.getVehicleRoom(
        payload.vehicleId,
      );

    this.server
      .to(room)
      .emit(
        'vehicle:telemetry',
        payload,
      );

    /**
     * ---------------------------------------------------
     * Fleet-wide broadcast
     * ---------------------------------------------------
     *
     * Every connected display client receives the
     * telemetry update.
     *
     * livemap.html can therefore maintain all vehicle
     * markers without subscribing to individual vehicles.
     */
    this.server.emit(
      'fleet:telemetry',
      payload,
    );

    this.logger.debug(
      `Telemetry broadcast: ${payload.vehicleId}`,
    );
  }

  private getVehicleRoom(
    vehicleId: string,
  ): string {
    return `vehicle:${vehicleId}`;
  }
}