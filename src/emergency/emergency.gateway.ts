// D:\Sec\safe_path_nodejs\src\emergency\emergency.gateway.ts

import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import {
  Server,
  Socket,
} from 'socket.io';

import type {
  EmergencySosPayload,
} from './emergency.service.js';

@WebSocketGateway({
  namespace: '/emergency',

  cors: {
    origin: '*',
  },
})
export class EmergencyGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(
    socket: Socket,
  ): void {
    console.log(
      `[Emergency Socket] client connected: ${socket.id}`,
    );

    socket.emit(
      'emergency:connection:ready',
      {
        connected: true,

        namespace:
          '/emergency',

        message:
          'Emergency Socket.IO connection established.',

        timestamp:
          new Date().toISOString(),
      },
    );
  }

  handleDisconnect(
    socket: Socket,
  ): void {
    console.log(
      `[Emergency Socket] client disconnected: ${socket.id}`,
    );
  }

  broadcastSos(
    emergency: EmergencySosPayload,
  ): void {
    if (!this.server) {
      console.error(
        '[Emergency Socket] server is not initialized.',
      );

      return;
    }

    console.log(
      `[Emergency Socket] broadcasting SOS for ${emergency.vehicleId}`,
    );

    this.server.emit(
      'emergency:sos',
      emergency,
    );
  }
}