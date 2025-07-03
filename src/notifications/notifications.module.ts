import { Module } from '@nestjs/common';
import { NotificationGateway } from './notification/notification.gateway';
import { TicketsModule } from 'src/tickets/tickets.module';

@Module({
  imports: [TicketsModule],
  providers: [NotificationGateway],
  exports: [NotificationGateway],
})
export class NotificationsModule {}
