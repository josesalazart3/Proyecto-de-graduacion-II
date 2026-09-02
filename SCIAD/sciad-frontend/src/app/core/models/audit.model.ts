// Auditoría e integridad de bitácoras. Reconciliado al contrato real del backend (Fase 3).
// AuditoriaHallazgoDto: { id, tipo, descripcion, personaId, personaNombre, estado, fecha }
// estado: 'abierto' | 'en_revision' | 'resuelto' (minúsculas). Sin severidad en el backend.

export type HallazgoEstado = 'abierto' | 'en_revision' | 'resuelto';

export const HALLAZGO_ESTADO_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
};

export interface HallazgoAuditoria {
  id: string;
  tipo: string; // 'acceso_sin_egreso' | 'concentracion' | 'registro_duplicado' | ...
  descripcion: string;
  personaId?: number | null;
  personaNombre?: string | null;
  estado: HallazgoEstado;
  fecha: string; // yyyy-mm-dd
}

/** Resumen de POST /api/auditoria/verificar. */
export interface VerificacionAuditoriaResultado {
  hallazgosCreados: number;
  notificacionesGeneradas: number;
  porTipo: Record<string, number>;
}
