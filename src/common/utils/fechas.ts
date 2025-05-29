import { toZonedTime } from "date-fns-tz";
export const obtenerFechaActual = () => toZonedTime(new Date(), "America/Mexico_City");
export const fechaDefecto = new Date("1900-01-01T00:00:00.980+00:00");