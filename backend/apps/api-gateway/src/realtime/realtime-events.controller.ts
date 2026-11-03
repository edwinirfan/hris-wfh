import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import type { AttendanceRecordedPayload } from '@app/common';
import { Events, handleWithAck } from '@app/common';
import { SignedUrlService } from '../files/signed-url.service';
import { RealtimeGateway } from './realtime.gateway';

/** Jembatan RabbitMQ → Socket.IO: event dari attendance-service diteruskan ke dashboard HR */
@Controller()
export class RealtimeEventsController {
  private readonly logger = new Logger(RealtimeEventsController.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly signer: SignedUrlService,
  ) {}

  @EventPattern(Events.ATTENDANCE_RECORDED, Transport.RMQ)
  onAttendanceRecorded(@Payload() payload: AttendanceRecordedPayload, @Ctx() context: RmqContext) {
    return handleWithAck(context, this.logger, () => {
      this.gateway.broadcastAttendance(this.signer.decorate(payload));
      return Promise.resolve();
    });
  }
}
