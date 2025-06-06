export async function populateCorreos(tickets: any[]): Promise<any[]> {
  try {
    const populatedTickets = await Promise.all(
      tickets.map(async (ticket) => {
        return await ticket.populate([
          { path: 'Asignado_a', select: 'Nombre Correo Coordinacion Area _id' },
          {
            path: 'Cliente',
            select: 'Nombre Correo Telefono Ubicacion _id',
            populate: [
              { path: 'Dependencia', select: 'Dependencia _id' },
              { path: 'Direccion_General', select: 'Direccion_General _id' },
              { path: 'direccion_area', select: 'direccion_area _id' },
            ],
          },
        ]);
      }),
    );
    return populatedTickets;
  } catch (error) {
    throw new Error(`Error al hacer populate: ${error.message}`);
  }
}
