import { INestApplicationContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Server, ServerOptions, Socket } from 'socket.io';
import type { AttendanceRecordedPayload, JwtPayload } from '@app/common';
import { Role } from '@app/common';
import { extractBearer } from '../common/guards';

export const HR_ROOM = 'hr';
export const employeeRoom = (employeeId: string) => `employee:${employeeId}`;

export type AttendanceRealtimeEvent = Pick<AttendanceRecordedPayload, 'attendanceId' | 'employeeId'>;

/** CORS socket.io diambil dari konfigurasi runtime (decorator dievaluasi sebelum ConfigModule siap) */
export class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, { ...options, cors: { origin: this.origins, credentials: true } }) as Server;
  }
}

@WebSocketGateway({ namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Namespace;

  constructor(private readonly jwt: JwtService) {}

  /** Autentikasi saat handshake: ADMIN_HR masuk room "hr", setiap user masuk room miliknya sendiri */
  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as { token?: string } | undefined;
    const token = auth?.token ?? extractBearer(client.handshake.headers.authorization);
    try {
      if (!token) throw new Error('missing token');
      const user = await this.jwt.verifyAsync<JwtPayload>(token);
      if (user.mcp) throw new Error('password change required');
      (client.data as { user?: JwtPayload }).user = user;
      await client.join(employeeRoom(user.employeeId));
      if (user.role === Role.ADMIN_HR) await client.join(HR_ROOM);
    } catch {
      client.emit('unauthorized', { message: 'Token tidak valid' });
      client.disconnect(true);
    }
  }

  broadcastAttendance(event: AttendanceRealtimeEvent): void {
    this.server.to(HR_ROOM).to(employeeRoom(event.employeeId)).emit('attendance:recorded', event);
    this.logger.debug(`attendance:recorded → ${event.attendanceId}`);
  }
}
