// Validación del contenido de un QR y control anti-doble-lectura.
//
// El QR de una credencial contiene ÚNICAMENTE el token (64 caracteres hexadecimales, RNF-01),
// sin datos personales. El servidor alterna ingreso/egreso en cada escaneo válido, por eso una
// cámara que lee en continuo NO debe enviar el mismo código varias veces seguidas: `ScanGate`
// lo impide.

export const TOKEN_RE = /^[0-9a-fA-F]{64}$/;
const TOKEN_EMBEDDED_RE = /(?<![0-9a-fA-F])[0-9a-fA-F]{64}(?![0-9a-fA-F])/;

/**
 * Extrae el token de lo que haya leído el lector. Acepta el token puro o (por tolerancia con
 * gafetes impresos con prefijo/URL) un token de 64 hex rodeado de otros caracteres.
 * Devuelve null si el contenido no contiene un token válido.
 */
export function extractToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (TOKEN_RE.test(t)) return t;
  const m = TOKEN_EMBEDDED_RE.exec(t);
  return m ? m[0] : null;
}

export interface ScanGateOptions {
  /** Tras un resultado, se ignoran TODAS las lecturas durante este tiempo (mientras se muestra el resultado). */
  holdMs: number;
  /** El mismo token no se vuelve a enviar durante este tiempo. */
  sameTokenMs: number;
}

export const DEFAULT_GATE: ScanGateOptions = { holdMs: 2500, sameTokenMs: 15000 };

/**
 * Decide si una lectura debe enviarse al servidor.
 * - Bloquea mientras hay una petición en curso (`begin`/`end`).
 * - Bloquea todo durante `holdMs` tras terminar una petición.
 * - Bloquea el mismo token durante `sameTokenMs`, salvo que se llame a `forget` (p. ej. error de red).
 */
export class ScanGate {
  private busy = false;
  private holdUntil = 0;
  private lastToken: string | null = null;
  private lastTokenAt = 0;

  constructor(private readonly opts: ScanGateOptions = DEFAULT_GATE) {}

  /** ¿Se puede procesar este token ahora? */
  canProcess(token: string, now: number): boolean {
    if (this.busy) return false;
    if (now < this.holdUntil) return false;
    if (token === this.lastToken && now - this.lastTokenAt < this.opts.sameTokenMs) return false;
    return true;
  }

  /** Marca el inicio del envío. */
  begin(token: string, now: number): void {
    this.busy = true;
    this.lastToken = token;
    this.lastTokenAt = now;
  }

  /** Marca el fin del envío (éxito o error) y arranca el periodo de espera. */
  end(now: number): void {
    this.busy = false;
    this.holdUntil = now + this.opts.holdMs;
  }

  /** Olvida el último token (permite reintentarlo enseguida, p. ej. tras un fallo de red). */
  forget(): void {
    this.lastToken = null;
    this.lastTokenAt = 0;
  }

  get isBusy(): boolean {
    return this.busy;
  }
}
