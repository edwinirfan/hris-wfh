import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import type { EmployeeDeletedPayload, EmployeeEventPayload, EmployeeStatusChangedPayload } from '@app/common';
import { Events, handleWithAck } from '@app/common';
import { AuthService } from './auth.service';

/** Consumer event dari employee-service (RabbitMQ) */
@Controller()
export class EmployeeEventsController {
  private readonly logger = new Logger(EmployeeEventsController.name);

  constructor(private readonly auth: AuthService) {}

  @EventPattern(Events.EMPLOYEE_UPDATED, Transport.RMQ)
  onUpdated(@Payload() payload: EmployeeEventPayload, @Ctx() context: RmqContext) {
    return handleWithAck(context, this.logger, () => this.auth.syncEmployee(payload));
  }

  @EventPattern(Events.EMPLOYEE_STATUS_CHANGED, Transport.RMQ)
  onStatusChanged(@Payload() payload: EmployeeStatusChangedPayload, @Ctx() context: RmqContext) {
    return handleWithAck(context, this.logger, () => this.auth.syncStatus(payload.id, payload.isActive));
  }

  @EventPattern(Events.EMPLOYEE_DELETED, Transport.RMQ)
  onDeleted(@Payload() payload: EmployeeDeletedPayload, @Ctx() context: RmqContext) {
    return handleWithAck(context, this.logger, () => this.auth.removeByEmployee(payload.id));
  }
}
