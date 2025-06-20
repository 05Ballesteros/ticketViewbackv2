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

export const historicoReasignacion = async (user: any, Usuario: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: "Ticket Reasignado",
            Mensaje: `El ticket ha sido reasignado a ${Usuario.Nombre} por ${nombre} - ${rol}.`,
            Fecha: obtenerFechaActual(),
        },
    ];
    return Historia_ticket;
};

export const historicoReabrir = async (user: any, ticketData: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: "Ticket Reabierto",
            Mensaje: `El ticket fue reabierto por ${nombre} - ${rol}.`,
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

export const historicoResolver = async (user: any, ticketData: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: ticketData.vistoBueno
                ? "Ticket enviado a revisión"
                : "Ticket resuelto",
            Mensaje:
                ticketData.vistoBueno === true
                    ? `El ticket ha sido enviado a revisión por ${nombre}(${rol}). En espera de respuesta del moderador. Descripcion resolucion:${ticketData.Respuesta_cierre_reasignado}`
                    : `El ticket ha sido resuelto por ${nombre}(${rol}). Descripcion resolucion: ${ticketData.Respuesta_cierre_reasignado}`,
            Fecha: obtenerFechaActual(),
        },
    ];
    return Historia_ticket;
};

export const historicoAceptarSolucion = async (user: any, ticketData: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: "Ticket revisado y aceptado",
            Mensaje: `${nombre}(${rol}) ha aceptado la solucion de ${ticketData.Nombre} (Resolutor). El estado del ticket es cambiado a "Resuelto" y se encuentra en espera de Cierre.`,
            Fecha: obtenerFechaActual(),
        },
    ];
    return Historia_ticket;
};

export const historicoRechazarSolucion = async (user: any, ticketData: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: "Ticket revisado y rechazado",
            Mensaje: `${nombre}(${rol}) ha rechazado la solucion de ${ticketData.Nombre} (Resolutor). El estado del ticket es cambiado a "Abierto". Motivo: ${ticketData.feedback}`,
            Fecha: obtenerFechaActual(),
        },
    ];
    return Historia_ticket;
};

export const historicoRegresarMesa = async (user: any, ticketData: any) => {
    const Historia_ticket = [
        {
            Nombre: user.userId,
            Titulo: "Ticket Retornado a Mesa de Servicio",
            Mensaje: `Descripción: ${ticketData.descripcion_retorno}`,
            Fecha: obtenerFechaActual(),
        },
    ];
    return Historia_ticket;
};

export const historicoRegresarModerador = async (user: any, ticketData: any) => {
    const Historia_ticket = [
        {
            Nombre: user.userId,
            Titulo: "Ticket Retornado a Moderador",
            Mensaje: `Descripción: ${ticketData.descripcion_retorno}`,
            Fecha: obtenerFechaActual(),
        },
    ];
    return Historia_ticket;
};

export const historicoRegresarResolutor = async (user: any, ticketData: any) => {
    const Historia_ticket = [
        {
            Nombre: user.userId,
            Titulo: "Ticket devuelto",
            Mensaje: `El ticket ha sido devuelto al resolutor por: ${user.nombre} (${user.rol}). Con la respuesta del cliente "${ticketData.Descripcion_respuesta_cliente}"`,
            Fecha: obtenerFechaActual(),
        },
    ];
    return Historia_ticket;
};

export const historicoCerrar = async (user: any, ticketData: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: "Ticket Cerrado",
            Mensaje: `El ticket fue cerrado por ${nombre}(${rol}).\nDescripción:\n${ticketData.Descripcion_cierre}`,
            Fecha: obtenerFechaActual(),
        },
    ];

    return Historia_ticket;
};

export const historicoNota = async (user: any, ticketData: any) => {
    const { userId, nombre, rol } = user;
    const Historia_ticket = [
        {
            Nombre: userId,
            Titulo: "Nota agregada",
            Mensaje: `Nota:\n${ticketData.Nota}`,
            Fecha: obtenerFechaActual(),
        },
    ];

    return Historia_ticket;
};