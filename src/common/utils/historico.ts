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
    console.log(Historia_ticket);
    return Historia_ticket;
};