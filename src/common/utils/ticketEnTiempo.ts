import { isAfter } from "date-fns";
export default function incTicketsUsuario(fecha_resolucion: any, fecha_limite: any) {
  const resuelto = isAfter(fecha_resolucion,fecha_limite);
  return resuelto ? "fuera_tiempo" : "a_tiempo";
}
