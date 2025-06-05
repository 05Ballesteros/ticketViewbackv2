export async function populateTickets(tickets: any[]): Promise<any[]> {
    try {
        const populatedTickets = await Promise.all(
            tickets.map(async (ticket) => {
                return await ticket.populate([
                    { path: 'Asignado_a Reasignado_a Cliente Creado_por', select: 'Nombre' },
                    { path: 'Area', select: 'Area' },
                    { path: 'Estado', select: 'Estado' },
                    { path: 'Medio', select: 'Medio' },
                    { path: 'Subcategoria' },
                ]);
            })
        );
        return populatedTickets;
    } catch (error) {
        throw new Error(`Error al hacer populate: ${error.message}`);
    }
}
