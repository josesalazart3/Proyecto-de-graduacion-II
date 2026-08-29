// Auditoría e integridad de bitácoras (CU-08, CU-09).

export type HallazgoSeveridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type HallazgoEstado = 'ABIERTO' | 'EN_REVISION' | 'RESUELTO';

export interface InconsistenciaAuditoria {
  id: string;
  tipo: string; // tipo de inconsistencia detectada
  descripcion: string;
  severidad: HallazgoSeveridad;
  estado: HallazgoEstado;
  fechaDeteccion: string; // ISO
  afectaBitacora?: string; // hash/referencia si aplica
}
