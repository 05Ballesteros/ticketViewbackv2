import { obtenerFechaActual } from "./fechas";

export const historicoCreacion = async (user: any, asignado: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: "Ticket Creado",
            Mensaje: `El ticket ha sido creado por ${nombre} (${rol}).`,
            Fecha: obtenerFechaActual(),
        },
    ];
    if (asignado.Rol.Rol !== "Root" || asignado.Rol.Rol !== "Administrador") {
        Historia_ticket.push({
            Nombre: userId,
            Titulo: "Ticket Asignado",
            Mensaje: `El ticket ha sido asignado al usuario ${asignado.Nombre} por ${nombre} (${rol}).`,
            Fecha: obtenerFechaActual(),
        });
    };
    return Historia_ticket;
};

export const historicoAsignacion = async (user: any, ticketData: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: "Ticket Asignado",
            Mensaje: `El ticket ha sido asignado por ${nombre} (${rol}).`,
            Fecha: obtenerFechaActual(),
        },
    ];
    if (ticketData.Nota) {
        Historia_ticket.push({
            Nombre: userId,
            Titulo: "Nota agregada",
            Mensaje: `Nota:\n${ticketData.Nota}`,
            Fecha: obtenerFechaActual(),
        });
    }
    return Historia_ticket;
};
