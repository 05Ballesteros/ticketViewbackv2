import { format } from 'date-fns';

export function formatDates(ticket: any): any {
    const dateFields = [
        'Fecha_hora_creacion',
        'Fecha_limite_resolucion_SLA',
        'Fecha_limite_respuesta_SLA',
        'Fecha_hora_ultima_modificacion',
        'Fecha_hora_cierre',
        'Fecha_hora_resolucion',
    ];

    const formattedTicket = { ...ticket.toObject() };

    dateFields.forEach((field) => {
        if (formattedTicket[field]) {
            formattedTicket[field] = format(new Date(formattedTicket[field]), 'yyyy-MM-dd HH:mm:ss');
        }
    });

    return formattedTicket;
}
