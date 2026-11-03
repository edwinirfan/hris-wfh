import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import type { EmployeeDeletedPayload, EmployeeEventPayload, EmployeeStatusChangedPayload } from '@app/common';
import { Events, handleWithAck } from '@app/common';
import { EmployeeRefsService } from './employee-refs.service';

/** Menjaga replika employee_refs tetap sinkron dengan employee-service */
@Controller()
export class EmployeeEventsController {
  private readonly logger = new Logger(EmployeeEventsController.name);

  constructor(private readonly refs: EmployeeRefsService) {}

  @EventPattern(Events.EMPLOYEE_CREATED, Transport.RMQ)
  onCreated(@Payload() payload: EmployeeEventPayload, @Ctx() context: RmqContext) {
    return handleWithAck(context, this.logger, () => this.refs.upsert(payload));
  }

  @EventPattern(Events.EMPLOYEE_UPDATED, Transport.RMQ)
  onUpdated(@Payload() payload: EmployeeEventPayload, @Ctx() context: RmqContext) {
    return handleWithAck(context, this.logger, () => this.refs.upsert(payload));
  }

  @EventPattern(Events.EMPLOYEE_STATUS_CHANGED, Transport.RMQ)
  onStatusChanged(@Payload() payload: EmployeeStatusChangedPayload, @Ctx() context: RmqContext) {
    return handleWithAck(context, this.logger, () => this.refs.setActive(payload.id, payload.isActive));
  }

  @EventPattern(Events.EMPLOYEE_DELETED, Transport.RMQ)
  onDeleted(@Payload() payload: EmployeeDeletedPayload, @Ctx() context: RmqContext) {
    return handleWithAck(context, this.logger, () => this.refs.remove(payload.id));
  }
}
