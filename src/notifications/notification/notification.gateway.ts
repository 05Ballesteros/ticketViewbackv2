import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GetTicketsService } from 'src/tickets/services/gettickets.service';
import * as jwt from 'jsonwebtoken';
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationGateway implements OnGatewayConnection {
  constructor(private readonly ticketService: GetTicketsService) { }

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;

    try {
      const payload: any = jwt.verify(token, process.env.JWT_TOKEN as string);
      const userId = payload.userId;

      // 🔍 Buscar tickets relacionados
      const tickets = await this.ticketService.obtenerTicketsPorUsuario(userId);

      // 🏷️ Unir al usuario a los rooms por ticket
      if (tickets?.length) {
        tickets.forEach(ticket => {
          const roomName = `ticket:${ticket._id}`;
          client.join(roomName);
        });
        console.log(`Usuario ${userId} unido a ${tickets.length} rooms`);
      } else {
        console.warn(`⚠️ Usuario ${userId} no tiene tickets asignados`);
      }
    }
    catch (error) {
      console.error('Error en conexión WS:', error.message);
      client.disconnect();
    }
  }

  sendNotification(message: string) {
    this.server.emit('nueva-notificacion', { message });
  }
}
