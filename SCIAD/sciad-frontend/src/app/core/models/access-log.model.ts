// Registros de ingreso/egreso y notificaciones (CU-05, CU-06, CU-07, CU-10).

export type TipoRegistro = 'INGRESO' | 'EGRESO';

export type ResultadoAcceso =
  | 'AUTORIZADO' // verde
  | 'DENEGADO' // rojo — motivo en `motivo`
  | 'PENDIENTE'; // ámbar — requiere revisión

export interface RegistroAcceso {
  id: string;
  credentialId: string;
  titular: string;
  zona: string;
  tipo: TipoRegistro;
  resultado: ResultadoAcceso;
  motivo?: string; // ejemplo: 'Credencial revocada', 'Fuera de horario permitido'
  timestamp: string; // ISO
  registradoPor: string; // nombre del personal/operador
  estacion: string; // nombre del punto de acceso / estación
}

export type TipoAnomalia =
  | 'ACCESO_FUERA_HORARIO'
  | 'CREDENCIAL_REVOCADA'
  | 'REINTENTO_DE_INGRESO'
  | 'INGRESO_NO_AUTORIZADO'
  | 'CREDENCIAL_VENCIDA';

export interface Notificacion {
  id: string;
  tipo: TipoAnomalia;
  titular?: string;
  zona?: string;
  mensaje: string;
  timestamp: string; // ISO
  leida: boolean;
  severidad: 'INFO' | 'WARNING' | 'ALERTA';
}

export const ANOMALIA_LABELS: Record<TipoAnomalia, string> = {
  ACCESO_FUERA_HORARIO: 'Acceso fuera de horario',
  CREDENCIAL_REVOCADA: 'Credencial revocada',
  REINTENTO_DE_INGRESO: 'Reintento de ingreso',
  INGRESO_NO_AUTORIZADO: 'Ingreso no autorizado',
  CREDENCIAL_VENCIDA: 'Credencial vencida',
};
