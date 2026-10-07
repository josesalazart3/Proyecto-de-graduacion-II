// Utilidades de fecha/hora.
//
// El backend persiste `fecha` (DateOnly) y `hora` (TimeOnly) en **UTC** (usa DateTime.UtcNow en
// RegistrosAccesoService). Guatemala es UTC-6, así que mostrar `hora.slice(0, 5)` tal cual
// enseña una hora 6 h adelantada. Estas funciones convierten ese par UTC a la hora local del
// dispositivo. Si en el futuro el backend pasa a guardar hora local, basta con cambiar
// `UTC_STORED` a `false` aquí y todas las pantallas quedan correctas.
const UTC_STORED = true;

const HORA_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Convierte (fecha yyyy-mm-dd, hora HH:mm[:ss]) guardados en UTC a un Date. null si no es válido. */
export function toDate(fecha: string | null | undefined, hora: string | null | undefined): Date | null {
  if (!fecha || !hora) return null;
  const m = HORA_RE.exec(hora);
  if (!m || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) return null;
  const iso = `${fecha.slice(0, 10)}T${m[1]}:${m[2]}:${m[3] ?? '00'}${UTC_STORED ? 'Z' : ''}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'HH:mm' en hora local. Si no se puede convertir, devuelve los primeros 5 caracteres de `hora`. */
export function horaLocal(fecha: string | null | undefined, hora: string | null | undefined): string {
  const d = toDate(fecha, hora);
  if (!d) return (hora ?? '').slice(0, 5);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'yyyy-mm-dd' en fecha local. Si no se puede convertir, devuelve `fecha` tal cual. */
export function fechaLocal(fecha: string | null | undefined, hora: string | null | undefined): string {
  const d = toDate(fecha, hora);
  if (!d) return fecha ?? '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha UTC de "hoy" (yyyy-mm-dd), la misma noción de "hoy" que usa el servidor. */
export function hoyUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
