export async function populateTickets(tickets: any[]): Promise<any[]> {
  try {

    const populatedTickets = await Promise.all(
      tickets.map(async (ticket) => {
        return await ticket.populate([
          {
            path: 'Asignado_a Reasignado_a Creado_por Resuelto_por',
            populate: [{ path: 'Dependencia' }, { path: 'Direccion_General' }, { path: 'Area' }],
          },
          { path: 'Area', select: 'Area' },
          { path: 'Estado', select: 'Estado' },
          { path: 'Medio', select: 'Medio' },
          { path: 'Subcategoria', populate: [{ path: "Equipo" }] },
          {
            path: 'Cliente',
            populate: [
              { path: 'Dependencia' },
              { path: 'Direccion_General' },
              { path: 'direccion_area' },
            ],
          },
          {
            path: 'Historia_ticket',
            select: 'Titulo Mensaje Fecha',
            options: { sort: { Fecha: -1 } },
            populate: {
              path: 'Nombre',
              select: 'Nombre -_id',
            },
          },
        ]);
      }),
    );

    const ticketsOrdenados = populatedTickets.map((ticket) => {
      if (Array.isArray(ticket.Historia_ticket)) {
        ticket.Historia_ticket = ticket.Historia_ticket.filter((item) => item?.Fecha).sort(
          (a, b) => {
            const fechaA = new Date(a.Fecha).getTime();
            const fechaB = new Date(b.Fecha).getTime();
            return fechaB - fechaA;
          },
        );
      } else {
        ticket.Historia_ticket = [];
      }

      return ticket;
    });

    return ticketsOrdenados;
  } catch (error) {
    throw new Error(`Error al hacer populate: ${error}`);
  }
}