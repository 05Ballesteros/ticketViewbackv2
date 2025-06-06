import { format } from 'date-fns';
import { es } from 'date-fns/locale';
export function formatDates(ticket: any): any {
  const dateFields = [
    'Fecha_hora_creacion',
    'Fecha_limite_resolucion_SLA',
    'Fecha_limite_respuesta_SLA',
    'Fecha_hora_ultima_modificacion',
    'Fecha_hora_cierre',
    'Fecha_hora_resolucion',
  ];

  const formatFecha = (fecha) => {
    if (!fecha || new Date(fecha).getFullYear() === 1900) {
      return '';
    }
    return format(fecha, "d 'de' MMMM 'de' yyyy, h:mm a", { locale: es });
  };

  const formattedTicket = { ...ticket.toObject() };

  dateFields.forEach((field) => {
    if (formattedTicket[field]) {
      formattedTicket[field] = formatFecha(new Date(formattedTicket[field]));
    }
  });

  return formattedTicket;
}
