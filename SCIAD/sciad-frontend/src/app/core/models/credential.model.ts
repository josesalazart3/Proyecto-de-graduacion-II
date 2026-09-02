// Credenciales QR. Reconciliado al contrato real del backend (Fase 3).
// CredencialDto: { id, personaId, personaNombre, dpiCodigo, token, estado, emitido, motivo, reemitidoDe }
// estado: 'activa' | 'revocada' (nunca borrado físico). token = 64 caracteres hex (RNF-01).

export type CredencialEstado = 'activa' | 'revocada';

export const CREDENCIAL_ESTADO_LABELS: Record<string, string> = {
  activa: 'Activa',
  revocada: 'Revocada',
};

export interface Credencial {
  id: string;
  personaId: string;
  personaNombre: string;
  dpiCodigo: string;
  token: string;
  estado: CredencialEstado;
  emitido: string; // ISO (yyyy-mm-dd)
  motivo?: string | null; // motivo de revocación, si aplica
  reemitidoDe?: number | null; // id de la credencial anterior (trazabilidad)
}
