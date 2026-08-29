// Credenciales QR cifradas (CU-04: gestionar credenciales).

export type CredencialEstado = 'ACTIVA' | 'VENCIDA' | 'REVOCADA' | 'PENDIENTE';

export interface Credencial {
  id: string;
  titularId: string; // persona (colaborador/visitante) — no usuario
  titular: string;
  documento: string; // DPI/Pasaporte (contexto Guatemala)
  zonaIdPerfil: string; // perfil de acceso asociado
  perfilNombre: string;
  codigoQr: string; // token/valor del QR cifrado (para escaneo simulado)
  estado: CredencialEstado;
  emitidaEn: string; // ISO
  venceEn: string; // ISO
  emitidaPor: string; // nombre del admin que emitió
  motivo?: string; // motivo de revocación, si aplica
}
