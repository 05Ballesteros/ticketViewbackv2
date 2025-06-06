// import { Model } from 'mongoose';
// import { TicketSchema } from 'src/schemas/ticket.schema';
// import { Counter, CounterSchema } from 'src/schemas/counter.schema';

// export const ticketMiddleware = (counterModel: Model<Counter>) => {
//   return async function (next: (err?: any) => void) {
//     if (!this.isNew) return next();

//     try {

//       this.Id = counter.seq;
//       next();
//     } catch (error) {
//       next(new Error('No se pudo aumentar el contador.'));
//     }
//   };
// };
