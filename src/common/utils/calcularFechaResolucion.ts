// src/utils/date.utils.ts
import { addHours, setHours, setMinutes, addDays, getDay } from 'date-fns';
import { obtenerFechaActual } from 'src/common/utils/fechas';

const HORARIO_INICIO = 8;
const HORARIO_FIN = 16;

function esFinDeSemana(fecha: Date): boolean {
  const dia = getDay(fecha);
  return dia === 0 || dia === 6;
}

function ajustarAProximoLunes(fecha: Date): Date {
  while (esFinDeSemana(fecha)) {
    fecha = addDays(fecha, 1);
  }
  return fecha;
}

/**
 * Calcula fecha de resolución solo en horario laboral.
 */
export function calcularFechaResolucion(tiempoResolucionHoras: number): Date {
  const fechaRegistro = obtenerFechaActual();
  let fecha = new Date(fechaRegistro);

  // Ajuste de entrada fuera de horario
  const h = fecha.getHours();
  if (h < HORARIO_INICIO) {
    fecha = setHours(fecha, HORARIO_INICIO);
    fecha = setMinutes(fecha, 0);
  } else if (h >= HORARIO_FIN) {
    fecha = addDays(fecha, 1);
    fecha = setHours(fecha, HORARIO_INICIO);
    fecha = setMinutes(fecha, 0);
  }

  // Saltar fines de semana
  fecha = ajustarAProximoLunes(fecha);

  let horasRestantes = tiempoResolucionHoras;
  while (horasRestantes > 0) {
    const horasHoy = HORARIO_FIN - fecha.getHours();
    if (horasRestantes <= horasHoy) {
      fecha = addHours(fecha, horasRestantes);
      horasRestantes = 0;
    } else {
      // termina jornada y avanza al siguiente día hábil
      fecha = addHours(fecha, horasHoy);
      horasRestantes -= horasHoy;
      fecha = addDays(fecha, 1);
      fecha = setHours(fecha, HORARIO_INICIO);
      fecha = setMinutes(fecha, 0);
      fecha = ajustarAProximoLunes(fecha);
    }
  }

  return fecha;
}
