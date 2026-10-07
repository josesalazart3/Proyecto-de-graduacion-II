# INSTRUCCIONES PARA CLAUDE CODE — SCIAD · Fases 1 y 2
## Escáner QR con cámara + acceso desde el celular (HTTPS, app instalable)

> **Para quién es este archivo:** Claude Code, ejecutándose en la computadora del usuario, dentro de su copia local del
> proyecto SCIAD (Proyecto de Graduación II). Es **autocontenido**: trae todo el código necesario. No depende de ningún otro archivo.
>
> ⚠ **Este archivo es largo (~2600 líneas).** Léelo **completo**, en varias lecturas consecutivas (p. ej. de 500 en 500 líneas), antes de empezar
> a modificar nada. No te saltes secciones: los pasos dependen unos de otros.

---

## 0. REGLAS OBLIGATORIAS (léelas antes de tocar nada)

1. **Todo es LOCAL y solo sobre el árbol de trabajo.** Prohibido: `git commit`, `git push`, `git stash`, `git reset`, `git checkout -b`,
   crear o cambiar de rama, `git apply` sobre el índice (`--index`/`--cached`). El usuario hará el commit local **él mismo**, después de
   revisar y de confirmarlo explícitamente. (Sí se permite `git apply` *sin* `--index`, que solo modifica archivos.)
2. **No modifiques `sciad-backend/` ni la base de datos** en este trabajo.
3. **No ejecutes `docker`/`docker compose`** sin pedir permiso al usuario antes (ver Paso 9).
4. **Aplica el código tal cual está aquí.** No lo "mejores", no renombres, no cambies decisiones del Anexo B. Si crees que hay un error,
   **repórtalo al usuario** en vez de corregirlo en silencio.
5. **Si un bloque no encaja** (el archivo local es distinto del esperado, un `diff` no aplica, falta un archivo): **detente en ese punto**,
   muestra la diferencia exacta y pregunta. No improvises ni fuerces.
6. No sobrescribas nada fuera de la lista de este documento. Antes de empezar, el usuario puede tener cambios sin commit: respétalos.
7. Al terminar, entrega el **informe del Paso 10** y **espera**. No avances a otras fases.

## 1. Qué se construye

Hoy la pantalla de escaneo **no usa la cámara** (solo un ícono y un campo para pegar el token), el modal "Ver QR" muestra un ícono en vez
de un QR, todos los íconos de la app salen vacíos, las horas se muestran en UTC (6 h adelantadas) y no hay forma de abrir la cámara desde el
celular (requiere HTTPS). Este trabajo agrega:

**Fase 1 (frontend):** escáner con cámara (celular y webcam) con alerta verde/roja a pantalla completa, sonido, vibración y protección contra
doble lectura · QR real en credenciales con descarga PNG e impresión de gafete · arreglo de íconos · horas locales · cierre de sesión en 401 ·
el Administrador también puede escanear desde la computadora.

**Fase 2 (móvil):** app instalable (manifest + íconos) · cabeceras nginx (index sin caché, permiso de cámara) · túnel HTTPS de Cloudflare para
probar en el celular · scripts que muestran la URL.

Mapa del repositorio: la carpeta `SCIAD/` contiene `sciad-frontend/` (Angular), `sciad-backend/` (.NET), `docker-compose*.yml`. Todas las
rutas de este documento son **relativas a `SCIAD/`** salvo que se indique otra cosa.

---

## 2. PASO 0 — Preparación y comprobaciones previas

Ejecuta y reporta el resultado de cada una **antes** de modificar archivos:

1. Ubica la **raíz del repositorio** (`git rev-parse --show-toplevel`) y la carpeta que contiene `sciad-frontend/` y `sciad-backend/`
   (normalmente `SCIAD/`). Llámala `SCIAD/` de aquí en adelante. Los comandos `git apply` de este documento se ejecutan **desde la raíz del
   repositorio** con `--directory=<ruta de SCIAD respecto a la raíz>` (normalmente `--directory=SCIAD`).
2. `git status --short` → guarda la salida. Si hay cambios sin commit en archivos que este documento va a tocar, **avisa al usuario y pregunta**.
3. `node -v` → debe ser **≥ 22.22.3** (Angular CLI 22 lo exige). Si no, detente y díselo al usuario.
4. Comprueba que el punto de partida es el esperado:
   - `sciad-frontend/src/app/shared/ui/icon.component.ts` contiene `[innerHTML]="markup()"`.
   - `sciad-frontend/src/app/features/security/scan.component.ts` contiene el texto `Registro manual del acceso`.
   - `sciad-frontend/src/app/core/util/` **no existe** (si existe y tiene `qr-camera.ts`, esto ya se aplicó parcialmente: pregunta).
   - `sciad-frontend/src/app/features/admin/credentials.component.ts` contiene `<sci-icon name="qr" [size]="120" />`.
5. Si algo no coincide, **detente y pregunta**.

---

## 3. PASO 1 — Dependencias

```bash
cd SCIAD/sciad-frontend
npm install jsqr@1.4.0 qrcode@1.5.4
npm install --save-dev @types/qrcode
```
(Esto actualiza `package.json` y `package-lock.json`; es lo esperado.)

---

## 4. PASO 2 — Archivos NUEVOS de utilidades (frontend)

Crea las carpetas que falten (`src/app/core/util/`). Copia cada bloque **exactamente**.

#### 📄 NUEVO — `sciad-frontend/src/app/core/util/time.ts`

````ts
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
````

#### 📄 NUEVO — `sciad-frontend/src/app/core/util/token.ts`

````ts
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
````

#### 📄 NUEVO — `sciad-frontend/src/app/core/util/qr.ts`

````ts
// Generación de la imagen QR de una credencial (descarga PNG e impresión de gafete).
// El QR codifica únicamente el token de 64 hex; el nombre del titular solo aparece en el gafete
// impreso, nunca dentro del código (RNF-01 / RNF-10).

/** Escapa texto para insertarlo en HTML (el gafete se arma como HTML en un iframe). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** PNG (data URL) del QR. `size` es el ancho en píxeles; incluye zona de silencio blanca. */
export async function qrDataUrl(value: string, size = 480): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: 'M',
    margin: 3,
    width: size,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/** Nombre de archivo seguro a partir de un texto libre. */
export function safeFileName(s: string): string {
  const base = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'credencial';
}

/** Descarga el QR como PNG. */
export async function descargarQrPng(token: string, titular: string): Promise<void> {
  const url = await qrDataUrl(token, 720);
  const a = document.createElement('a');
  a.href = url;
  a.download = `QR_${safeFileName(titular)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface DatosGafete {
  token: string;
  titular: string;
  tipo: string; // Colaborador / Visitante
}

/** Abre el diálogo de impresión con el gafete (tarjeta de 86×54 mm aprox.). */
export async function imprimirGafete(d: DatosGafete): Promise<void> {
  const img = await qrDataUrl(d.token, 600);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Gafete</title>
<style>
  @page { size: auto; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; }
  .badge { width: 86mm; height: 120mm; border: 0.4mm solid #0f172a; border-radius: 4mm; padding: 6mm;
           display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
  .brand { font-weight: 800; letter-spacing: .12em; font-size: 5mm; color: #3b5bdb; }
  .qr { width: 62mm; height: 62mm; }
  .name { font-size: 6mm; font-weight: 700; text-align: center; line-height: 1.15; }
  .tipo { font-size: 3.6mm; text-transform: uppercase; letter-spacing: .1em; color: #475569; }
  .tok { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 2.2mm; color: #64748b; }
</style></head><body>
<div class="badge">
  <div class="brand">SCIAD</div>
  <img class="qr" src="${img}" alt="Código QR">
  <div><div class="name">${escapeHtml(d.titular)}</div><div class="tipo" style="text-align:center;margin-top:2mm">${escapeHtml(d.tipo)}</div></div>
  <div class="tok">${escapeHtml(d.token.slice(0, 8))}…${escapeHtml(d.token.slice(-8))}</div>
</div></body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error('No se pudo preparar la impresión.');
  }
  doc.open();
  doc.write(html);
  doc.close();

  const imgEl = doc.querySelector('img');
  const imprimir = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Se retira el iframe un poco después para no cortar el diálogo de impresión.
    setTimeout(() => iframe.remove(), 60_000);
  };
  if (imgEl && !imgEl.complete) {
    imgEl.addEventListener('load', imprimir, { once: true });
  } else {
    imprimir();
  }
}
````

#### 📄 NUEVO — `sciad-frontend/src/app/core/util/qr-camera.ts`

````ts
// Lector de QR por cámara (CU-04). Funciona en móvil y computadora, sin instalar nada (RNF-05):
//  - Usa la API nativa `BarcodeDetector` cuando existe (Chrome/Android, Edge, Safari reciente).
//  - Si no, cae a `jsQR` (JavaScript puro) sobre un canvas — necesario para iOS/Firefox.
// Requiere contexto seguro (HTTPS o localhost): es una restricción del navegador para getUserMedia.

export type CamaraErrorCode = 'INSECURE' | 'DENIED' | 'NOCAMERA' | 'BUSY' | 'UNSUPPORTED' | 'UNKNOWN';

export class CamaraError extends Error {
  constructor(
    readonly code: CamaraErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const CAMARA_MENSAJES: Record<CamaraErrorCode, string> = {
  INSECURE:
    'El navegador solo permite usar la cámara en páginas seguras (HTTPS). Abre la aplicación desde una dirección https:// o desde localhost.',
  DENIED:
    'Se bloqueó el permiso de la cámara. Permítelo en el candado de la barra de direcciones (o en Ajustes del navegador) y vuelve a intentar.',
  NOCAMERA: 'No se encontró ninguna cámara en este dispositivo.',
  BUSY: 'La cámara está en uso por otra aplicación. Ciérrala e inténtalo de nuevo.',
  UNSUPPORTED: 'Este navegador no permite acceder a la cámara. Prueba con Chrome o Safari actualizados.',
  UNKNOWN: 'No se pudo iniciar la cámara.',
};

function mapError(e: unknown): CamaraError {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
    return new CamaraError('DENIED', CAMARA_MENSAJES.DENIED);
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError')
    return new CamaraError('NOCAMERA', CAMARA_MENSAJES.NOCAMERA);
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError')
    return new CamaraError('BUSY', CAMARA_MENSAJES.BUSY);
  return new CamaraError('UNKNOWN', CAMARA_MENSAJES.UNKNOWN);
}

/** Decodifica un QR desde píxeles RGBA con jsQR (carga diferida: no pesa en el bundle inicial). */
export async function decodificarPixeles(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  probarInvertido = false,
): Promise<string | null> {
  const jsQR = (await import('jsqr')).default;
  const r = jsQR(data, width, height, {
    // En vivo se evita la pasada invertida (duplicaría el costo por fotograma).
    inversionAttempts: probarInvertido ? 'attemptBoth' : 'dontInvert',
  });
  return r?.data ?? null;
}

/** Decodifica un QR desde un archivo de imagen (alternativa cuando la cámara en vivo no está disponible). */
export async function decodificarImagen(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  return decodificarPixeles(img.data, w, h, true);
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

export class QrCameraScanner {
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private paused = false;
  private detector: BarcodeDetectorLike | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private lastText: string | null = null;

  /** Intervalo entre intentos de lectura (ms). ~8 lecturas/s es suficiente y cuida la batería. */
  private readonly intervalMs = 120;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onDetect: (text: string) => void,
  ) {}

  get active(): boolean {
    return this.running;
  }

  /** ¿Puede este navegador usar la cámara? */
  static soportado(): CamaraErrorCode | null {
    if (typeof window === 'undefined') return 'UNSUPPORTED';
    if (!window.isSecureContext) return 'INSECURE';
    if (!navigator.mediaDevices?.getUserMedia) return 'UNSUPPORTED';
    return null;
  }

  /** Cámaras de vídeo disponibles (las etiquetas solo aparecen tras conceder el permiso). */
  static async camaras(): Promise<MediaDeviceInfo[]> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter((d) => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }

  async start(deviceId?: string): Promise<void> {
    const motivo = QrCameraScanner.soportado();
    if (motivo) throw new CamaraError(motivo, CAMARA_MENSAJES[motivo]);

    this.stop();
    const video: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
      throw mapError(e);
    }

    // iOS Safari exige estos atributos para reproducir en línea.
    this.video.muted = true;
    this.video.setAttribute('playsinline', 'true');
    this.video.srcObject = this.stream;
    try {
      await this.video.play();
    } catch (e) {
      this.stop();
      throw mapError(e);
    }

    await this.prepararDetector();
    this.running = true;
    this.paused = false;
    this.lastText = null;
    this.programar();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  pause(): void {
    this.paused = true;
  }

  /**
   * Reanuda la lectura. NO se olvida el último código: si la credencial sigue frente a la cámara
   * no se vuelve a disparar; solo lo hará cuando salga del encuadre y vuelva a presentarse.
   */
  resume(): void {
    this.paused = false;
  }

  /** ¿La cámara activa tiene linterna? */
  get linterna(): boolean {
    const track = this.stream?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    return !!caps?.torch;
  }

  async setLinterna(on: boolean): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
  }

  /** Id de la cámara en uso (para alternar entre frontal y trasera). */
  get deviceIdActual(): string | undefined {
    return this.stream?.getVideoTracks()[0]?.getSettings().deviceId;
  }

  private async prepararDetector(): Promise<void> {
    this.detector = null;
    try {
      if (typeof BarcodeDetector !== 'undefined') {
        const formats = (await BarcodeDetector.getSupportedFormats?.()) ?? ['qr_code'];
        if (formats.includes('qr_code')) this.detector = new BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch {
      this.detector = null;
    }
  }

  private programar(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => void this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    try {
      if (!this.paused && this.video.readyState >= 2 && this.video.videoWidth > 0) {
        const text = await this.leerFotograma();
        if (text && text !== this.lastText) {
          this.lastText = text;
          this.onDetect(text);
        } else if (!text) {
          this.lastText = null;
        }
      }
    } catch {
      // Un fotograma fallido no debe detener el escáner.
    }
    this.programar();
  }

  private async leerFotograma(): Promise<string | null> {
    if (this.detector) {
      const found = await this.detector.detect(this.video);
      return found[0]?.rawValue ?? null;
    }
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    const max = 800;
    const scale = Math.min(1, max / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
    if (!this.ctx) return null;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.drawImage(this.video, 0, 0, w, h);
    const img = this.ctx.getImageData(0, 0, w, h);
    return decodificarPixeles(img.data, w, h);
  }
}
````

#### 📄 NUEVO — `sciad-frontend/src/app/shared/ui/qr-image.component.ts`

````ts
// <sci-qr [value]="token" [size]="220" /> — dibuja el QR real de un valor (carga diferida de la librería).
import { Component, effect, input, signal } from '@angular/core';
import { qrDataUrl } from '../../core/util/qr';

@Component({
  selector: 'sci-qr',
  standalone: true,
  template: `
    @if (src(); as s) {
      <img [src]="s" [width]="size()" [height]="size()" [alt]="alt()" class="qr-img" />
    } @else {
      <div class="qr-ph" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true"></div>
    }
  `,
  styles: [
    `
      :host { display: inline-block; line-height: 0; }
      .qr-img { display: block; background: #fff; border-radius: 6px; image-rendering: pixelated; }
      .qr-ph { border-radius: 6px; background: var(--surface-sunken); }
    `,
  ],
})
export class QrImage {
  readonly value = input.required<string>();
  readonly size = input(220);
  readonly alt = input('Código QR de la credencial');

  protected readonly src = signal('');

  constructor() {
    effect((onCleanup) => {
      const v = this.value();
      const s = this.size();
      let cancelled = false;
      onCleanup(() => (cancelled = true));
      // Se genera al doble de resolución para que se vea nítido en pantallas de alta densidad.
      qrDataUrl(v, s * 2)
        .then((u) => !cancelled && this.src.set(u))
        .catch(() => !cancelled && this.src.set(''));
    });
  }
}
````

---

## 5. PASO 3 — Archivos que se REEMPLAZAN por completo

Sobrescribe el contenido completo de estos dos archivos existentes con el bloque indicado.

#### ♻️ REEMPLAZAR POR COMPLETO — `sciad-frontend/src/app/features/security/scan.component.ts`
Pantalla de escaneo con cámara real (reemplaza la versión anterior sin cámara).
````ts
// Escaneo QR (CU-04) con cámara real. Funciona en celular (BYOD) y en computadora (webcam).
//
// Flujo: elegir zona → apuntar la cámara al QR de la credencial → el token (64 hex) se envía a
// POST /registros-acceso {token, zonaId} → el servidor valida y decide ingreso/egreso → alerta
// verde/roja a pantalla completa con sonido y vibración.
//
// Notas de diseño:
//  - El servidor ALTERNA ingreso/egreso en cada escaneo válido. Una cámara lee el mismo QR muchas
//    veces por segundo, por eso `ScanGate` impide reenviar el mismo código (ver core/util/token.ts).
//  - La cámara exige HTTPS (o localhost). Si no se cumple, se explica y se ofrece la alternativa
//    de leer desde una foto o ingresar el token a mano.
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AccessLogService, ZonasService } from '../../core/services/crud.service';
import { RegistroAccesoResultado } from '../../core/models/access-log.model';
import { Zona } from '../../core/models/access.model';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';
import { ToastService } from '../../shared/ui/toast.service';
import { extractToken, ScanGate } from '../../core/util/token';
import { horaLocal } from '../../core/util/time';
import {
  CAMARA_MENSAJES,
  CamaraError,
  CamaraErrorCode,
  decodificarImagen,
  QrCameraScanner,
} from '../../core/util/qr-camera';

interface EscanerResultado {
  ok: boolean;
  titulo: string;
  persona?: string;
  zona?: string;
  tipo?: string;
  hora?: string;
  motivo?: string;
}

interface Reciente extends EscanerResultado {
  at: number;
}

type CamState = 'idle' | 'starting' | 'live' | 'error';

const ZONA_KEY = 'sciad.scan.zona';
const RESULT_MS = 2500;

const TITULOS_ERROR: Record<string, string> = {
  TOKEN_INVALIDO: 'Credencial no reconocida',
  CREDENCIAL_REVOCADA: 'Credencial revocada',
  PERSONA_INACTIVA: 'Persona inactiva',
  ZONA_NO_AUTORIZADA: 'Zona no autorizada',
  FUERA_VIGENCIA: 'Fuera de vigencia',
};

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [ReactiveFormsModule, Button, Icon, Card],
  template: `
    <div class="scan">
      <div class="zona-row">
        <label class="uppercase-label" for="zona-sel">Zona de acceso</label>
        <select id="zona-sel" class="token-input" [formControl]="form.controls.zonaId" aria-label="Zona de acceso">
          <option value="" disabled>Selecciona la zona…</option>
          @for (z of zonaOptions(); track z.id) {
            <option [value]="z.id">{{ z.nombre }}</option>
          }
        </select>
        @if (zonas().length > 0 && zonaOptions().length === 0) {
          <p class="hint">No hay zonas activas. Actívalas desde administración.</p>
        }
      </div>

      <div class="viewport" [class.live]="cam() === 'live'">
        <video #video class="video" playsinline muted></video>

        @if (cam() !== 'live') {
          <div class="placeholder">
            <sci-icon name="qr" [size]="84" />
            <p>
              @switch (cam()) {
                @case ('starting') { Iniciando cámara… }
                @case ('error') { Cámara no disponible }
                @default { Cámara apagada }
              }
            </p>
          </div>
        } @else if (!result()) {
          <div class="reticle" aria-hidden="true">
            <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
            <span class="scanline"></span>
          </div>
          <div class="live-hint">Apunta al código QR de la credencial</div>
        }

        @if (cam() === 'live') {
          <div class="tools">
            @if (linterna()) {
              <button type="button" class="tool" [class.on]="linternaOn()" (click)="toggleLinterna()" aria-label="Linterna">
                <sci-icon name="zap" [size]="20" />
              </button>
            }
            @if (camaras().length > 1) {
              <button type="button" class="tool" (click)="cambiarCamara()" aria-label="Cambiar de cámara">
                <sci-icon name="refresh" [size]="20" />
              </button>
            }
          </div>
        }

        @if (result(); as r) {
          <div class="overlay" [class.ok]="r.ok" [class.bad]="!r.ok" [attr.role]="r.ok ? 'status' : 'alert'" aria-live="assertive">
            <sci-icon [name]="r.ok ? 'checkCircle' : 'alertTriangle'" [size]="76" />
            <div class="o-title">{{ r.titulo }}</div>
            @if (r.persona) { <div class="o-name">{{ r.persona }}</div> }
            @if (r.ok) {
              <div class="o-sub">{{ r.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO' }} · {{ r.zona }}</div>
              <div class="o-when mono">{{ r.hora }}</div>
            } @else if (r.motivo) {
              <div class="o-sub">{{ r.motivo }}</div>
            }
          </div>
        }

        @if (loading()) {
          <div class="busy"><span class="spin"></span> Validando…</div>
        }
      </div>

      @if (camError(); as msg) {
        <div class="cam-error" role="alert">
          <sci-icon name="alertTriangle" [size]="20" />
          <div>
            <div class="ce-msg">{{ msg }}</div>
            @if (camErrorCode() === 'INSECURE') {
              <div class="ce-sub">Mientras tanto puedes usar «Leer desde foto» o escribir el token.</div>
            }
          </div>
        </div>
      }

      <div class="actions">
        @if (cam() === 'live') {
          <button sci-btn variant="secondary" size="md" iconName="x" (click)="detener()">Apagar cámara</button>
        } @else {
          <button sci-btn variant="primary" size="md" iconName="camera" [loading]="cam() === 'starting'" (click)="iniciar()">
            {{ cam() === 'error' ? 'Reintentar cámara' : 'Activar cámara' }}
          </button>
        }
        <label class="file-btn">
          <input type="file" accept="image/*" capture="environment" (change)="onFoto($event)" hidden />
          <sci-icon name="scan" [size]="18" /> Leer desde foto
        </label>
      </div>

      @if (recientes().length > 0) {
        <sci-card class="recientes">
          <div class="manual-label uppercase-label">Últimos escaneos</div>
          <ul class="rec-list">
            @for (r of recientes(); track r.at) {
              <li class="rec" [class.rec-ok]="r.ok" [class.rec-bad]="!r.ok">
                <sci-icon [name]="r.ok ? 'checkCircle' : 'alertCircle'" [size]="18" />
                <div class="rec-main">
                  <div class="rec-t">{{ r.persona ?? r.titulo }}</div>
                  <div class="rec-s">{{ r.ok ? (r.tipo === 'ingreso' ? 'Ingreso' : 'Egreso') + ' · ' + r.zona : r.motivo ?? r.titulo }}</div>
                </div>
                <div class="rec-h mono">{{ r.hora ?? '' }}</div>
              </li>
            }
          </ul>
        </sci-card>
      }

      <sci-card class="manual">
        <details>
          <summary class="manual-label uppercase-label">Registro manual (sin cámara)</summary>
          <form [formGroup]="form" (ngSubmit)="submitManual()" class="manual-form">
            <input
              formControlName="token"
              placeholder="Token QR de 64 caracteres"
              class="token-input mono"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              (input)="form.controls.token.setValue($any($event.target).value.trim(), { emitEvent: false })"
            />
            <button sci-btn variant="primary" size="md" [loading]="loading()" [disabled]="zonaOptions().length === 0">
              Registrar acceso
            </button>
          </form>
        </details>
      </sci-card>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .scan { max-width: 560px; margin: 0 auto; padding: 16px 16px 40px; display: flex; flex-direction: column; gap: 16px; }
      .zona-row { display: flex; flex-direction: column; gap: 6px; }
      .uppercase-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-subtle); }
      .hint { font-size: 12px; color: var(--text-subtle); }

      .viewport {
        position: relative; width: 100%; aspect-ratio: 1 / 1; max-height: 68dvh; margin: 0 auto;
        border-radius: 20px; overflow: hidden; background: #0b1220; border: 2px solid var(--border-strong);
      }
      .viewport.live { border-color: var(--sciad-brand); }
      .video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .viewport:not(.live) .video { visibility: hidden; }
      .placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #94a3b8; font-size: 14px; }

      .reticle { position: absolute; inset: 14%; pointer-events: none; }
      .c { position: absolute; width: 34px; height: 34px; border: 4px solid #fff; opacity: 0.95; }
      .tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-top-left-radius: 12px; }
      .tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-top-right-radius: 12px; }
      .bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-bottom-left-radius: 12px; }
      .br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-bottom-right-radius: 12px; }
      .scanline { position: absolute; left: 6px; right: 6px; height: 3px; border-radius: 3px; background: var(--sciad-brand); box-shadow: 0 0 12px var(--sciad-brand); animation: scanmove 1.8s ease-in-out infinite; }
      @keyframes scanmove { 0%, 100% { top: 6%; } 50% { top: 92%; } }
      .live-hint { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; color: #fff; font-size: 13px; font-weight: 600; text-shadow: 0 1px 4px rgb(0 0 0 / 0.7); pointer-events: none; }

      .tools { position: absolute; top: 10px; right: 10px; display: flex; gap: 8px; z-index: 3; }
      .tool { width: 42px; height: 42px; border-radius: 50%; border: 0; display: grid; place-items: center; color: #fff; background: rgb(15 23 42 / 0.6); backdrop-filter: blur(4px); }
      .tool.on { background: var(--sciad-warning); }

      .overlay { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 20px; text-align: center; color: #fff; animation: pop 0.2s var(--ease-out); }
      .overlay.ok { background: rgb(21 127 67 / 0.94); }
      .overlay.bad { background: rgb(198 40 40 / 0.94); }
      @keyframes pop { from { transform: scale(0.97); opacity: 0; } }
      .o-title { font-size: 24px; font-weight: 800; line-height: 1.15; }
      .o-name { font-size: 20px; font-weight: 700; }
      .o-sub { font-size: 15px; font-weight: 600; opacity: 0.95; }
      .o-when { font-size: 28px; font-weight: 700; margin-top: 4px; }

      .busy { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); z-index: 5; display: inline-flex; align-items: center; gap: 8px; background: rgb(15 23 42 / 0.75); color: #fff; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 999px; }
      .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; border-right-color: transparent; animation: sp 0.7s linear infinite; }
      @keyframes sp { to { transform: rotate(360deg); } }

      .cam-error { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: var(--radius-md); background: var(--sciad-warning-soft); color: var(--sciad-warning); font-size: 13px; }
      .ce-msg { font-weight: 600; }
      .ce-sub { margin-top: 4px; opacity: 0.9; }

      .actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .file-btn { display: inline-flex; align-items: center; gap: 8px; padding: 0 14px; height: 44px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 600; font-size: 14px; cursor: pointer; }

      .recientes, .manual { padding: 16px 18px; }
      .manual-label { cursor: pointer; }
      .rec-list { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .rec { display: flex; align-items: center; gap: 10px; }
      .rec-ok { color: var(--sciad-success); }
      .rec-bad { color: var(--sciad-danger); }
      .rec-main { flex: 1; min-width: 0; }
      .rec-t { font-weight: 600; font-size: 14px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .rec-s { font-size: 12px; color: var(--text-muted); }
      .rec-h { font-size: 13px; color: var(--text-muted); }

      .manual-form { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
      .token-input { width: 100%; height: 48px; padding: 0 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 15px; }
      .token-input:focus { outline: none; border-color: var(--sciad-brand); box-shadow: 0 0 0 3px var(--sciad-brand-soft); }
    `,
  ],
})
export class ScanComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly service = inject(AccessLogService);
  private readonly zonasSvc = inject(ZonasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private scanner: QrCameraScanner | null = null;
  private readonly gate = new ScanGate();
  private resultTimer: ReturnType<typeof setTimeout> | null = null;
  private lastInvalidAt = 0;
  private audio: AudioContext | null = null;
  private resumeOnVisible = false;

  protected readonly cam = signal<CamState>('idle');
  protected readonly camError = signal<string | null>(null);
  protected readonly camErrorCode = signal<CamaraErrorCode | null>(null);
  protected readonly camaras = signal<MediaDeviceInfo[]>([]);
  protected readonly linterna = signal(false);
  protected readonly linternaOn = signal(false);
  protected readonly loading = signal(false);
  protected readonly zonas = signal<Zona[]>([]);
  protected readonly result = signal<EscanerResultado | null>(null);
  protected readonly recientes = signal<Reciente[]>([]);

  protected readonly zonaOptions = computed(() => this.zonas().filter((z) => z.estado === 'activo'));
  protected readonly form = this.fb.group({
    zonaId: this.fb.nonNullable.control('', Validators.required),
    token: ['', [Validators.minLength(6)]],
  });

  ngOnInit(): void {
    this.form.controls.zonaId.valueChanges.subscribe((v) => {
      try {
        if (v) localStorage.setItem(ZONA_KEY, v);
      } catch {
        /* almacenamiento no disponible: se ignora */
      }
    });

    this.zonasSvc.list().subscribe({
      next: (zs) => {
        this.zonas.set(zs);
        const activas = zs.filter((z) => z.estado === 'activo');
        let guardada: string | null = null;
        try {
          guardada = localStorage.getItem(ZONA_KEY);
        } catch {
          guardada = null;
        }
        const elegida = activas.find((z) => z.id === guardada) ?? activas[0];
        if (elegida) this.form.controls.zonaId.setValue(String(elegida.id));
      },
      error: () => this.toast.error('Error', 'No se pudieron cargar las zonas.'),
    });
  }

  ngAfterViewInit(): void {
    // El <video> ya existe: se intenta abrir la cámara de inmediato (el navegador pedirá permiso).
    void this.iniciar();
  }

  ngOnDestroy(): void {
    this.scanner?.stop();
    if (this.resultTimer) clearTimeout(this.resultTimer);
    void this.audio?.close().catch(() => undefined);
  }

  /** Libera la cámara al ocultar la pestaña (batería/privacidad) y la reanuda al volver. */
  @HostListener('document:visibilitychange')
  onVisibility(): void {
    if (document.hidden) {
      if (this.cam() === 'live') {
        this.resumeOnVisible = true;
        this.scanner?.stop();
        this.cam.set('idle');
      }
    } else if (this.resumeOnVisible) {
      this.resumeOnVisible = false;
      void this.iniciar();
    }
  }

  protected async iniciar(deviceId?: string): Promise<void> {
    if (this.cam() === 'starting') return;
    this.cam.set('starting');
    this.camError.set(null);
    this.camErrorCode.set(null);
    this.prepararAudio();
    try {
      if (!this.scanner) {
        this.scanner = new QrCameraScanner(this.videoRef().nativeElement, (t) => this.onLectura(t));
      }
      await this.scanner.start(deviceId);
      this.cam.set('live');
      this.linterna.set(this.scanner.linterna);
      this.linternaOn.set(false);
      this.camaras.set(await QrCameraScanner.camaras());
    } catch (e) {
      const ce = e instanceof CamaraError ? e : new CamaraError('UNKNOWN', CAMARA_MENSAJES.UNKNOWN);
      this.cam.set('error');
      this.camErrorCode.set(ce.code);
      this.camError.set(ce.message);
    }
  }

  protected detener(): void {
    this.scanner?.stop();
    this.cam.set('idle');
    this.linterna.set(false);
  }

  protected async toggleLinterna(): Promise<void> {
    try {
      const next = !this.linternaOn();
      await this.scanner?.setLinterna(next);
      this.linternaOn.set(next);
    } catch {
      this.toast.warning('Linterna', 'Este dispositivo no permite controlar la linterna.');
    }
  }

  protected async cambiarCamara(): Promise<void> {
    const lista = this.camaras();
    if (lista.length < 2) return;
    const actual = this.scanner?.deviceIdActual;
    const idx = lista.findIndex((d) => d.deviceId === actual);
    const siguiente = lista[(idx + 1) % lista.length];
    await this.iniciar(siguiente.deviceId);
  }

  /** Lectura de la cámara (puede llegar muchas veces por segundo). */
  private onLectura(texto: string): void {
    const token = extractToken(texto);
    const now = Date.now();
    if (!token) {
      // Un QR ajeno a SCIAD: se avisa una vez cada pocos segundos, sin molestar.
      if (!this.gate.isBusy && !this.result() && now - this.lastInvalidAt > 3000) {
        this.lastInvalidAt = now;
        this.mostrar({ ok: false, titulo: 'Código no reconocido', motivo: 'El QR no es una credencial SCIAD.' }, false);
      }
      return;
    }
    if (!this.gate.canProcess(token, now)) return;
    this.enviar(token, true);
  }

  protected submitManual(): void {
    const t = extractToken(this.form.controls.token.value);
    if (!t) {
      this.mostrar({ ok: false, titulo: 'Token inválido', motivo: 'Debe tener 64 caracteres hexadecimales.' }, false);
      return;
    }
    if (this.loading()) return;
    this.enviar(t, false);
  }

  protected async onFoto(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.loading()) return;
    try {
      const texto = await decodificarImagen(file);
      const t = extractToken(texto);
      if (!t) {
        this.mostrar(
          { ok: false, titulo: 'No se leyó ningún QR', motivo: 'Acerca la foto al código y evita reflejos.' },
          false,
        );
        return;
      }
      this.enviar(t, false);
    } catch {
      this.toast.error('Error', 'No se pudo leer la imagen.');
    }
  }

  private enviar(token: string, porCamara: boolean): void {
    const zonaId = Number(this.form.controls.zonaId.value);
    if (!zonaId) {
      this.toast.warning('Zona requerida', 'Selecciona la zona de acceso antes de escanear.');
      return;
    }
    if (porCamara) this.gate.begin(token, Date.now());
    this.scanner?.pause();
    this.loading.set(true);

    this.service.escanear({ token, zonaId }).subscribe({
      next: (res: RegistroAccesoResultado) => {
        this.loading.set(false);
        if (porCamara) this.gate.end(Date.now());
        this.form.controls.token.reset('');
        this.mostrar(
          {
            ok: true,
            titulo: 'Acceso autorizado',
            persona: res.personaNombre,
            zona: res.zonaNombre,
            tipo: res.tipo,
            hora: this.horaDe(res),
          },
          true,
        );
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        if (porCamara) {
          this.gate.end(Date.now());
          // Fallos de red/servidor: permitir reintentar el mismo QR enseguida.
          if (e.status === 0 || e.status >= 500) this.gate.forget();
        }
        this.mostrar(this.errorResultado(e), true);
      },
    });
  }

  private horaDe(res: RegistroAccesoResultado): string {
    const d = new Date(res.timestamp);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return horaLocal(res.fecha, res.hora);
  }

  private errorResultado(e: HttpErrorResponse): EscanerResultado {
    if (e.status === 0) {
      return { ok: false, titulo: 'Sin conexión', motivo: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.' };
    }
    if (e.status >= 500) {
      return { ok: false, titulo: 'Error del servidor', motivo: 'El servidor no pudo procesar el escaneo. Reintenta.' };
    }
    if (e.status === 403) {
      return { ok: false, titulo: 'Sin permiso', motivo: 'Tu rol no puede registrar accesos.' };
    }
    const body = e.error as { code?: string; detail?: string } | null;
    // 409 = UNIQUE de BD (doble ingreso el mismo día); la API lo envía con code "CONFLICT".
    if (e.status === 409) {
      return { ok: false, titulo: 'Ingreso ya registrado', motivo: body?.detail ?? 'Ya existe un ingreso para hoy.' };
    }
    const titulo = (body?.code && TITULOS_ERROR[body.code]) || 'Acceso denegado';
    return { ok: false, titulo, motivo: body?.detail ?? 'El acceso fue rechazado.' };
  }

  /** Muestra el resultado a pantalla completa, da feedback y reanuda la cámara. */
  private mostrar(r: EscanerResultado, registrar: boolean): void {
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.result.set(r);
    this.feedback(r.ok);
    if (registrar) {
      this.recientes.update((l) => [{ ...r, at: Date.now() }, ...l].slice(0, 6));
    }
    this.resultTimer = setTimeout(() => {
      this.result.set(null);
      this.scanner?.resume();
    }, RESULT_MS);
  }

  private prepararAudio(): void {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !this.audio) this.audio = new Ctx();
      void this.audio?.resume();
    } catch {
      this.audio = null;
    }
  }

  private feedback(ok: boolean): void {
    try {
      navigator.vibrate?.(ok ? 80 : [140, 70, 140]);
    } catch {
      /* sin vibración */
    }
    try {
      if (!this.audio) return;
      const osc = this.audio.createOscillator();
      const gain = this.audio.createGain();
      osc.type = ok ? 'sine' : 'square';
      osc.frequency.value = ok ? 880 : 200;
      gain.gain.value = 0.12;
      osc.connect(gain).connect(this.audio.destination);
      osc.start();
      osc.stop(this.audio.currentTime + (ok ? 0.12 : 0.35));
    } catch {
      /* sin audio */
    }
  }
}
````

#### ♻️ REEMPLAZAR POR COMPLETO — `sciad-frontend/src/app/core/auth/jwt.interceptor.ts`
Agrega el cierre de sesión ante 401 (token vencido).
````ts
// Interceptor HTTP: adjunta el JWT (Bearer) a cada petición y maneja la sesión vencida.
// Si el servidor responde 401 en cualquier endpoint (excepto el propio login), el token expiró
// (8 h, RF-10) o fue invalidado: se cierra la sesión local y se vuelve al login.
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../../shared/ui/toast.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const token = auth.token();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  const esLogin = req.url.includes('/auth/login');

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !esLogin && auth.isAuthenticated()) {
        auth.logout();
        toast.warning('Sesión expirada', 'Inicia sesión nuevamente para continuar.');
        void router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
````

---

## 6. PASO 4 — EDICIONES a archivos existentes (diffs)

Cada bloque es un `diff` unificado con rutas **relativas a `SCIAD/`**. Para cada uno: guárdalo en un archivo temporal **fuera del repo**
(p. ej. en la carpeta temporal del sistema) y aplícalo **desde la raíz del repo** con:

```bash
git apply --directory=SCIAD --whitespace=nowarn <archivo.diff>
```
(sin `--index`; solo modifica el archivo). Si `git apply` falla, **no lo fuerces**: aplica los cambios a mano con el editor siguiendo el diff
al pie de la letra si el archivo es equivalente, o detente y pregunta si difiere. Después borra los temporales.

#### 🔧 EDITAR (diff) — `sciad-frontend/angular.json`
Permite dependencias CommonJS (jsqr/qrcode) y sube el presupuesto de estilos de componente.
````diff
diff --git a/sciad-frontend/angular.json b/sciad-frontend/angular.json
index 497e0ba..0101a15 100644
--- a/sciad-frontend/angular.json
+++ b/sciad-frontend/angular.json
@@ -53,6 +53,11 @@
             ],
             "styles": [
               "src/styles.scss"
+            ],
+            "allowedCommonJsDependencies": [
+              "jsqr",
+              "qrcode",
+              "dijkstrajs"
             ]
           },
           "configurations": {
@@ -65,8 +70,8 @@
                 },
                 {
                   "type": "anyComponentStyle",
-                  "maximumWarning": "4kB",
-                  "maximumError": "8kB"
+                  "maximumWarning": "6kB",
+                  "maximumError": "10kB"
                 }
               ],
               "outputHashing": "all"
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/shared/ui/icon.component.ts`
**Corrige un bug previo:** el sanitizador de Angular borraba los `<path>` y todos los íconos salían vacíos. Añade además los íconos `zap` y `printer`.
````diff
diff --git a/sciad-frontend/src/app/shared/ui/icon.component.ts b/sciad-frontend/src/app/shared/ui/icon.component.ts
index 3ad28d6..faa4423 100644
--- a/sciad-frontend/src/app/shared/ui/icon.component.ts
+++ b/sciad-frontend/src/app/shared/ui/icon.component.ts
@@ -1,7 +1,10 @@
 // Iconos inline (set Lucide, trazo 1.75, 24x24) — una sola familia en el proyecto.
-import { Component, computed, input } from '@angular/core';
+import { Component, computed, inject, input } from '@angular/core';
+import { DomSanitizer } from '@angular/platform-browser';
 
 const ICONS: Record<string, string> = {
+  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
+  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
   dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
   users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
   shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
@@ -80,5 +83,12 @@ export type IconName = keyof typeof ICONS;
 export class Icon {
   readonly name = input<IconName>('check');
   readonly size = input<number>(20);
-  protected readonly markup = computed(() => ICONS[this.name()] ?? '');
+  private readonly sanitizer = inject(DomSanitizer);
+
+  // El sanitizador de Angular elimina los elementos SVG (<path>, <circle>…) de un [innerHTML],
+  // dejando el ícono vacío. El contenido proviene SOLO de la constante ICONS de este archivo
+  // (nunca de entrada del usuario), por lo que es seguro marcarlo como HTML de confianza.
+  protected readonly markup = computed(() =>
+    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''),
+  );
 }
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/app.routes.ts`
Rutas `/admin/escaneo` y `/admin/accesos` (el backend ya permite escanear a SEGURIDAD **o** ADMIN).
````diff
diff --git a/sciad-frontend/src/app/app.routes.ts b/sciad-frontend/src/app/app.routes.ts
index 4567fbe..63b5475 100644
--- a/sciad-frontend/src/app/app.routes.ts
+++ b/sciad-frontend/src/app/app.routes.ts
@@ -63,6 +63,18 @@ export const routes: Routes = [
         loadComponent: () =>
           import('./features/reports/reports.component').then((m) => m.ReportsComponent),
       },
+      // El backend permite al Administrador registrar accesos (RequireSeguridadOAdmin): se expone
+      // el mismo escáner para usarlo desde una computadora con cámara web.
+      {
+        path: 'escaneo',
+        loadComponent: () =>
+          import('./features/security/scan.component').then((m) => m.ScanComponent),
+      },
+      {
+        path: 'accesos',
+        loadComponent: () =>
+          import('./features/security/access-log.component').then((m) => m.AccessLogComponent),
+      },
     ],
   },
 
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/shared/layout/app-shell.component.ts`
Entradas de menú para Admin: "Punto de acceso" y "Accesos de hoy".
````diff
diff --git a/sciad-frontend/src/app/shared/layout/app-shell.component.ts b/sciad-frontend/src/app/shared/layout/app-shell.component.ts
index 4f29829..0446e1f 100644
--- a/sciad-frontend/src/app/shared/layout/app-shell.component.ts
+++ b/sciad-frontend/src/app/shared/layout/app-shell.component.ts
@@ -20,6 +20,8 @@ const NAV: NavItem[] = [
   { label: 'Credenciales QR', path: '/admin/credenciales', icon: 'qr', roles: ['ADMIN'] },
   { label: 'Auditoría', path: '/admin/auditoria', icon: 'activity', roles: ['ADMIN'] },
   { label: 'Reportes', path: '/admin/reportes', icon: 'file', roles: ['ADMIN'] },
+  { label: 'Punto de acceso', path: '/admin/escaneo', icon: 'scan', roles: ['ADMIN'] },
+  { label: 'Accesos de hoy', path: '/admin/accesos', icon: 'clock', roles: ['ADMIN'] },
 
   { label: 'Punto de acceso', path: '/seguridad/escaneo', icon: 'scan', roles: ['SEGURIDAD'] },
   { label: 'Accesos del turno', path: '/seguridad/accesos', icon: 'clock', roles: ['SEGURIDAD'] },
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/admin/credentials.component.ts`
Modal con QR real, "Descargar PNG" e "Imprimir gafete" (deshabilitado si la credencial está revocada).
````diff
diff --git a/sciad-frontend/src/app/features/admin/credentials.component.ts b/sciad-frontend/src/app/features/admin/credentials.component.ts
index b95af6f..4a31269 100644
--- a/sciad-frontend/src/app/features/admin/credentials.component.ts
+++ b/sciad-frontend/src/app/features/admin/credentials.component.ts
@@ -13,6 +13,8 @@ import { Modal } from '../../shared/ui/modal.component';
 import { SciInput, SciSelect } from '../../shared/ui/field.component';
 import { EmptyState } from '../../shared/ui/empty-state.component';
 import { ToastService } from '../../shared/ui/toast.service';
+import { QrImage } from '../../shared/ui/qr-image.component';
+import { descargarQrPng, imprimirGafete } from '../../core/util/qr';
 
 function badgeFor(estado: string): StatusKey {
   return estado === 'activa' ? 'activo' : 'revocado';
@@ -31,6 +33,7 @@ function badgeFor(estado: string): StatusKey {
     SciInput,
     SciSelect,
     EmptyState,
+    QrImage,
   ],
   template: `
     <div class="page">
@@ -126,12 +129,24 @@ function badgeFor(estado: string): StatusKey {
 
     <!-- Ver QR -->
     <sci-modal [open]="viewOpen()" title="Credencial QR" (closed)="viewOpen.set(false)">
-      <div class="qr-view">
-        <div class="qr-box"><sci-icon name="qr" [size]="120" /></div>
-        <div class="qr-code mono">{{ selected()?.token }}</div>
-        <div class="qr-titular">{{ selected()?.personaNombre }}</div>
-        <div class="qr-sub">{{ estatusLabel() }}</div>
-      </div>
+      @if (selected(); as sel) {
+        <div class="qr-view">
+          <div class="qr-box" [class.qr-revoked]="sel.estado !== 'activa'">
+            <sci-qr [value]="sel.token" [size]="240" />
+            @if (sel.estado !== 'activa') {
+              <div class="qr-stamp">REVOCADA</div>
+            }
+          </div>
+          <div class="qr-titular">{{ sel.personaNombre }}</div>
+          <div class="qr-sub">{{ personaTipo(sel.personaId) }} · {{ estatusLabel() }}</div>
+          <div class="qr-code mono">{{ sel.token }}</div>
+          <p class="qr-note">El código contiene solo el token; no incluye datos personales.</p>
+          <div class="qr-actions">
+            <button sci-btn variant="secondary" size="md" iconName="download" (click)="descargar(sel)">Descargar PNG</button>
+            <button sci-btn variant="primary" size="md" iconName="printer" (click)="imprimir(sel)" [disabled]="sel.estado !== 'activa'">Imprimir gafete</button>
+          </div>
+        </div>
+      }
     </sci-modal>
   `,
   styles: [
@@ -148,13 +163,22 @@ function badgeFor(estado: string): StatusKey {
         text-align: center;
       }
       .qr-box {
-        padding: 16px;
-        border: 1px dashed var(--border-strong);
+        position: relative;
+        padding: 12px;
+        border: 1px solid var(--border-strong);
         border-radius: var(--radius-md);
-        background: var(--surface);
-        color: var(--text);
+        background: #fff;
+        color: #000;
       }
-      .qr-code { font-size: 16px; font-weight: 700; color: var(--text); word-break: break-all; }
+      .qr-box.qr-revoked sci-qr { opacity: 0.25; }
+      .qr-stamp {
+        position: absolute; inset: 0; display: grid; place-items: center;
+        font-weight: 800; font-size: 26px; letter-spacing: 0.1em; color: var(--sciad-danger);
+        transform: rotate(-14deg);
+      }
+      .qr-code { font-size: 11px; font-weight: 600; color: var(--text-muted); word-break: break-all; max-width: 320px; }
+      .qr-note { font-size: 12px; color: var(--text-subtle); max-width: 320px; }
+      .qr-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 4px; }
       .qr-titular { font-weight: 600; font-size: 15px; color: var(--text); }
       .qr-sub { font-size: 13px; color: var(--text-muted); }
     `,
@@ -291,6 +315,22 @@ export class CredentialsComponent implements OnInit {
     this.viewOpen.set(true);
   }
 
+  protected async descargar(c: Credencial): Promise<void> {
+    try {
+      await descargarQrPng(c.token, c.personaNombre);
+    } catch {
+      this.toast.error('Error', 'No se pudo generar la imagen del QR.');
+    }
+  }
+
+  protected async imprimir(c: Credencial): Promise<void> {
+    try {
+      await imprimirGafete({ token: c.token, titular: c.personaNombre, tipo: this.personaTipo(c.personaId) });
+    } catch {
+      this.toast.error('Error', 'No se pudo preparar la impresión del gafete.');
+    }
+  }
+
   protected estatusLabel(): string {
     const s = this.selected()?.estado;
     return s === 'activa' ? 'Activa' : s === 'revocada' ? 'Revocada' : '';
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/security/access-log.component.ts`
Hora en formato local.
````diff
diff --git a/sciad-frontend/src/app/features/security/access-log.component.ts b/sciad-frontend/src/app/features/security/access-log.component.ts
index 3173443..53d30dd 100644
--- a/sciad-frontend/src/app/features/security/access-log.component.ts
+++ b/sciad-frontend/src/app/features/security/access-log.component.ts
@@ -10,6 +10,7 @@ import { Button } from '../../shared/ui/button.component';
 import { Card } from '../../shared/ui/card.component';
 import { EmptyState } from '../../shared/ui/empty-state.component';
 import { ToastService } from '../../shared/ui/toast.service';
+import { horaLocal, hoyUtc } from '../../core/util/time';
 
 @Component({
   selector: 'app-access-log',
@@ -55,7 +56,7 @@ import { ToastService } from '../../shared/ui/toast.service';
               </div>
               <div class="row-right">
                 <span class="row-type mono">{{ r.ultimoTipo === 'ingreso' ? 'IN' : 'OUT' }}</span>
-                <span class="mono">{{ (r.ultimaHora || '').slice(0, 5) }}</span>
+                <span class="mono">{{ hora(r.ultimaHora) }}</span>
               </div>
             </div>
           }
@@ -109,6 +110,11 @@ export class AccessLogComponent implements OnInit {
   protected readonly loading = signal(true);
   protected readonly records = signal<AccesoDelDia[]>([]);
 
+  /** La hora llega en UTC del servidor ("hoy" = fecha UTC): se muestra en hora local. */
+  protected hora(h: string | null | undefined): string {
+    return horaLocal(hoyUtc(), h);
+  }
+
   protected readonly counts = computed(() => {
     const rows = this.records();
     return {
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/management/traceability.component.ts`
Fecha y hora en formato local.
````diff
diff --git a/sciad-frontend/src/app/features/management/traceability.component.ts b/sciad-frontend/src/app/features/management/traceability.component.ts
index 6fd2c5c..f546564 100644
--- a/sciad-frontend/src/app/features/management/traceability.component.ts
+++ b/sciad-frontend/src/app/features/management/traceability.component.ts
@@ -9,6 +9,7 @@ import { Card } from '../../shared/ui/card.component';
 import { Button } from '../../shared/ui/button.component';
 import { Badge, StatusKey } from '../../shared/ui/badge.component';
 import { EmptyState } from '../../shared/ui/empty-state.component';
+import { fechaLocal, horaLocal } from '../../core/util/time';
 
 function badgeTipo(tipo: string): StatusKey {
   return tipo === 'ingreso' ? 'activo' : 'inactivo';
@@ -71,8 +72,8 @@ function badgeTipo(tipo: string): StatusKey {
               <tbody>
                 @for (r of rows(); track r.id) {
                   <tr>
-                    <td class="cell-muted">{{ r.fecha }}</td>
-                    <td class="cell-muted hide-sm">{{ r.hora.slice(0, 5) }}</td>
+                    <td class="cell-muted">{{ fechaDe(r) }}</td>
+                    <td class="cell-muted hide-sm">{{ horaDe(r) }}</td>
                     <td class="cell-strong">{{ r.personaNombre }}</td>
                     <td>{{ r.zonaNombre }}</td>
                     <td class="hide-sm"><sci-badge [status]="badgeTipo(r.tipo)" [label]="r.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'" /></td>
@@ -103,6 +104,10 @@ export class TraceabilityComponent implements OnInit {
   private readonly zonasSvc = inject(ZonasService);
 
   protected readonly badgeTipo = badgeTipo;
+
+  // fecha/hora vienen en UTC del servidor: se muestran en hora local del dispositivo.
+  protected fechaDe(r: RegistroHistorial): string { return fechaLocal(r.fecha, r.hora); }
+  protected horaDe(r: RegistroHistorial): string { return horaLocal(r.fecha, r.hora); }
   protected readonly loading = signal(true);
   protected readonly rows = signal<RegistroHistorial[]>([]);
   protected readonly personas = signal<Persona[]>([]);
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/admin/dashboard.component.ts`
Hora en formato local.
````diff
diff --git a/sciad-frontend/src/app/features/admin/dashboard.component.ts b/sciad-frontend/src/app/features/admin/dashboard.component.ts
index 7ec42b9..9a9f58b 100644
--- a/sciad-frontend/src/app/features/admin/dashboard.component.ts
+++ b/sciad-frontend/src/app/features/admin/dashboard.component.ts
@@ -11,6 +11,7 @@ import {
 } from '../../core/services/crud.service';
 import { RegistroHistorial } from '../../core/models/access-log.model';
 import { KpiCard } from '../../shared/ui/kpi-card.component';
+import { horaLocal } from '../../core/util/time';
 import { Card } from '../../shared/ui/card.component';
 
 @Component({
@@ -56,7 +57,7 @@ import { Card } from '../../shared/ui/card.component';
                           {{ ev.tipo === 'ingreso' ? 'Ingreso' : 'Egreso' }}
                         </span>
                       </div>
-                      <div class="event-sub">{{ ev.zonaNombre }} · {{ ev.hora.slice(0, 5) }}</div>
+                      <div class="event-sub">{{ ev.zonaNombre }} · {{ horaDe(ev) }}</div>
                     </div>
                   </div>
                 } @empty {
@@ -204,6 +205,11 @@ export class AdminDashboardComponent implements OnInit {
     });
   }
 
+  /** La hora del registro viene en UTC del servidor: se muestra en hora local. */
+  protected horaDe(ev: RegistroHistorial): string {
+    return horaLocal(ev.fecha, ev.hora);
+  }
+
   protected time(iso: string): string {
     return new Date(iso).toLocaleString('es-GT', {
       day: '2-digit',
````

---

## 7. PASO 5 — App instalable (PWA)

### 7.1 Manifest
#### 📄 NUEVO — `sciad-frontend/public/manifest.webmanifest`

````json
{
  "name": "SCIAD — Control de Acceso",
  "short_name": "SCIAD",
  "description": "Sistema de Control Integral de Identidad y Acceso Digital con credenciales QR.",
  "lang": "es-GT",
  "id": "/",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f4f6fb",
  "theme_color": "#3b5bdb",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Punto de acceso (escanear)", "short_name": "Escanear", "url": "/seguridad/escaneo", "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" }] }
  ]
}
````

### 7.2 Script que genera los íconos

Crea este script y **ejecútalo una vez** (necesita Python y Pillow: `pip install pillow`). Genera 4 PNG en `sciad-frontend/public/icons/`.
En Windows, usa `python` (o `py`) en lugar de `python3`.

#### 📄 NUEVO — `scripts/generar-iconos-pwa.py`

````python
"""Genera los íconos de la app instalable (PWA) en sciad-frontend/public/icons/.
Uso (una sola vez):  pip install pillow   &&   python scripts/generar-iconos-pwa.py
Salida: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
"""
from pathlib import Path
from PIL import Image, ImageDraw

BRAND = (59, 91, 219)   # #3b5bdb
WHITE = (255, 255, 255)
S = 1024                # se dibuja grande y se reduce (suavizado)
OUT = Path(__file__).resolve().parent.parent / "sciad-frontend" / "public" / "icons"


def glyph(d, scale, ox, oy):
    """Escudo blanco con tres marcadores de QR (coordenadas base 512)."""
    def P(x, y):
        return (ox + x * scale, oy + y * scale)

    shield = [(256, 64), (408, 116), (408, 262), (380, 342), (256, 448), (132, 342), (104, 262), (104, 116)]
    d.polygon([P(*p) for p in shield], fill=WHITE)

    def box(x, y, s=58, w=12):
        d.rectangle([P(x, y), P(x + s, y + s)], fill=BRAND)
        d.rectangle([P(x + w, y + w), P(x + s - w, y + s - w)], fill=WHITE)
        d.rectangle([P(x + w + 8, y + w + 8), P(x + s - w - 8, y + s - w - 8)], fill=BRAND)

    box(160, 148); box(294, 148); box(160, 282)
    for (x, y) in [(294, 282), (336, 282), (294, 324), (336, 324), (315, 303)]:
        d.rectangle([P(x, y), P(x + 22, y + 22)], fill=BRAND)


def make(size, maskable=False, rounded=True):
    img = Image.new("RGB", (S, S), BRAND)
    d = ImageDraw.Draw(img)
    k = 0.62 if maskable else 0.86          # el maskable deja zona segura (~60 %)
    glyph(d, (S / 512) * k, S * (1 - k) / 2, S * (1 - k) / 2)
    out = img.resize((size, size), Image.LANCZOS)
    if rounded and not maskable:
        m = Image.new("L", (size, size), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
        bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        bg.paste(out, (0, 0), m)
        return bg
    return out


OUT.mkdir(parents=True, exist_ok=True)
make(192).save(OUT / "icon-192.png")
make(512).save(OUT / "icon-512.png")
make(512, maskable=True).save(OUT / "icon-maskable-512.png")
make(180, rounded=False).save(OUT / "apple-touch-icon.png")  # iOS aplica su propia máscara
print("Íconos generados en", OUT)
````

```bash
cd SCIAD
python scripts/generar-iconos-pwa.py
```
Comprueba que existen `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` y `apple-touch-icon.png` en `sciad-frontend/public/icons/`.
Si el usuario no tiene Python/Pillow, **avísale** y deja ese sub-paso pendiente (la app funciona igual; solo faltarían los íconos de instalación).

### 7.3 `index.html`
#### 🔧 EDITAR (diff) — `sciad-frontend/src/index.html`
Enlaza el manifest, el ícono de iOS y las metas de app web.
````diff
diff --git a/sciad-frontend/src/index.html b/sciad-frontend/src/index.html
index c1cd612..056f3c5 100644
--- a/sciad-frontend/src/index.html
+++ b/sciad-frontend/src/index.html
@@ -8,6 +8,12 @@
   <meta name="description" content="SCIAD — Sistema de Control Integral de Identidad y Acceso Digital basado en credenciales QR.">
   <meta name="theme-color" content="#3b5bdb">
   <link rel="icon" type="image/x-icon" href="favicon.ico">
+  <link rel="manifest" href="manifest.webmanifest">
+  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
+  <meta name="mobile-web-app-capable" content="yes">
+  <meta name="apple-mobile-web-app-capable" content="yes">
+  <meta name="apple-mobile-web-app-title" content="SCIAD">
+  <meta name="apple-mobile-web-app-status-bar-style" content="default">
 </head>
 <body>
   <app-root></app-root>
````

---

## 8. PASO 6 — nginx

#### 🔧 EDITAR (diff) — `sciad-frontend/nginx.conf`
Desarrollo: `index.html` y rutas SPA siempre revalidados; manifest con su MIME; `Permissions-Policy: camera=(self)`.
````diff
diff --git a/sciad-frontend/nginx.conf b/sciad-frontend/nginx.conf
index 6957246..c9a44db 100644
--- a/sciad-frontend/nginx.conf
+++ b/sciad-frontend/nginx.conf
@@ -11,6 +11,27 @@ server {
     gzip_types text/plain text/css application/javascript application/json image/svg+xml;
     gzip_min_length 1024;
 
+    # --- PWA / móviles (Fase 2) ---------------------------------------------------------
+    # index.html SIEMPRE se revalida: si un celular conserva un index viejo, apuntaría a chunks
+    # con hash que ya no existen tras un despliegue (pantalla en blanco). Los assets con hash
+    # sí se cachean 1 año (bloque de estáticos). add_header en un location anula los del
+    # server, por eso se repiten las cabeceras de seguridad aquí.
+    location = /index.html {
+        add_header Cache-Control "no-cache" always;
+        add_header X-Content-Type-Options "nosniff" always;
+        add_header X-Frame-Options "SAMEORIGIN" always;
+        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
+        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;
+    }
+
+    # Manifest de la app instalable: MIME correcto y sin caché larga.
+    location = /manifest.webmanifest {
+        default_type application/manifest+json;
+        add_header Cache-Control "no-cache" always;
+        add_header X-Content-Type-Options "nosniff" always;
+        try_files $uri =404;
+    }
+
     # SPA fallback: cualquier ruta no coincidente → index.html (deja que Angular enrute)
     location / {
         try_files $uri $uri/ /index.html;
@@ -39,4 +60,5 @@ server {
     add_header X-Content-Type-Options "nosniff" always;
     add_header X-Frame-Options "SAMEORIGIN" always;
     add_header Referrer-Policy "strict-origin-when-cross-origin" always;
+    add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;
 }
\ No newline at end of file
````

#### 🔧 EDITAR (diff) — `sciad-frontend/nginx.prod.conf`
Producción: lo mismo que arriba (conserva HSTS).
````diff
diff --git a/sciad-frontend/nginx.prod.conf b/sciad-frontend/nginx.prod.conf
index 71b3d67..fa133db 100644
--- a/sciad-frontend/nginx.prod.conf
+++ b/sciad-frontend/nginx.prod.conf
@@ -44,6 +44,28 @@ server {
     gzip_types text/plain text/css application/javascript application/json image/svg+xml;
     gzip_min_length 1024;
 
+    # --- PWA / móviles (Fase 2) ---------------------------------------------------------
+    # index.html SIEMPRE se revalida: si un celular conserva un index viejo, apuntaría a chunks
+    # con hash que ya no existen tras un despliegue (pantalla en blanco). Los assets con hash
+    # sí se cachean 1 año (bloque de estáticos). add_header en un location anula los del
+    # server, por eso se repiten las cabeceras de seguridad aquí.
+    location = /index.html {
+        add_header Cache-Control "no-cache" always;
+        add_header X-Content-Type-Options "nosniff" always;
+        add_header X-Frame-Options "SAMEORIGIN" always;
+        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
+        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;
+        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
+    }
+
+    # Manifest de la app instalable: MIME correcto y sin caché larga.
+    location = /manifest.webmanifest {
+        default_type application/manifest+json;
+        add_header Cache-Control "no-cache" always;
+        add_header X-Content-Type-Options "nosniff" always;
+        try_files $uri =404;
+    }
+
     # SPA fallback
     location / {
         try_files $uri $uri/ /index.html;
@@ -69,5 +91,6 @@ server {
     add_header X-Content-Type-Options "nosniff" always;
     add_header X-Frame-Options "SAMEORIGIN" always;
     add_header Referrer-Policy "strict-origin-when-cross-origin" always;
+    add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;
     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
 }
\ No newline at end of file
````

---

## 9. PASO 7 — Túnel HTTPS para probar en el celular (archivos nuevos)

#### 📄 NUEVO — `docker-compose.tunnel.yml`
Overlay de Compose: **no** modifica `docker-compose.yml`.
````yaml
# ============================================================
# SCIAD — Túnel HTTPS para probar en el celular (Fase 2)
#
# La cámara del navegador SOLO funciona en HTTPS (o localhost). Este archivo añade un túnel
# "quick tunnel" de Cloudflare (gratis, sin cuenta ni dominio) que publica el frontend con una
# URL https://<palabras>.trycloudflare.com y certificado válido.
#
# Uso (junto al compose de desarrollo):
#   docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
#   ./scripts/url-celular.sh            # (Windows: .\scripts\url-celular.ps1)  → imprime la URL
#   # Apagar el túnel cuando termines:
#   docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop tunnel
#
# ⚠ SOLO PARA PRUEBAS. La URL es pública mientras el túnel esté encendido y el seeder crea
#   cuentas demo con contraseña conocida (sciad123). No compartas la URL y apaga el túnel al
#   terminar. Para uso real: VPS con dominio y TLS (DESPLIEGUE.md).
# ============================================================
services:
  tunnel:
    image: cloudflare/cloudflared:latest
    container_name: sciad-tunnel
    # El SPA y /api salen por el mismo origen (nginx del frontend), así que no hay CORS.
    command: tunnel --no-autoupdate --url http://frontend:80
    depends_on:
      - frontend
    restart: unless-stopped

  backend:
    environment:
      # Detrás de nginx/túnel todos los clientes llegan con la IP del proxy: el límite de login
      # (5 por 5 min) se comparte entre TODOS. Se amplía solo para pruebas con varios celulares.
      - RateLimit__LoginPermitLimit=30
````

#### 📄 NUEVO — `scripts/url-celular.sh`
Bash (Linux/macOS/WSL). Dale permiso de ejecución: `chmod +x scripts/url-celular.sh`.
````bash
#!/usr/bin/env sh
# Imprime la URL https del túnel (docker-compose.tunnel.yml) para abrirla en el celular.
set -e
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.tunnel.yml"

echo "Esperando la URL del túnel…"
url=""
for _ in $(seq 1 30); do
  url=$($COMPOSE logs tunnel 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -n 1 || true)
  [ -n "$url" ] && break
  sleep 2
done

if [ -z "$url" ]; then
  echo "No apareció la URL. Revisa:  $COMPOSE logs tunnel" >&2
  exit 1
fi

echo
echo "  Abre en el celular:  $url"
echo
echo "  • Entra con una cuenta de Personal de Seguridad y permite la cámara."
echo "  • Es una URL temporal y pública: no la compartas."
echo "  • Para apagarla:  $COMPOSE stop tunnel"
````

#### 📄 NUEVO — `scripts/url-celular.ps1`
PowerShell (Windows).
````powershell
# Imprime la URL https del túnel (docker-compose.tunnel.yml) para abrirla en el celular. (Windows)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$compose = @('compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.tunnel.yml')

Write-Host 'Esperando la URL del túnel…'
$url = $null
for ($i = 0; $i -lt 30 -and -not $url; $i++) {
  $logs = (& docker @compose logs tunnel 2>&1) -join "`n"
  $m = [regex]::Matches($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($m.Count -gt 0) { $url = $m[$m.Count - 1].Value } else { Start-Sleep -Seconds 2 }
}
if (-not $url) {
  Write-Error 'No apareció la URL. Revisa: docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs tunnel'
}
Write-Host ''
Write-Host "  Abre en el celular:  $url"
Write-Host ''
Write-Host '  • Entra con una cuenta de Personal de Seguridad y permite la cámara.'
Write-Host '  • Es una URL temporal y pública: no la compartas.'
Write-Host '  • Para apagarla:  docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop tunnel'
````

---

## 10. PASO 8 — Compilar

```bash
cd SCIAD/sciad-frontend
npx ng build --configuration production
```
**Criterio:** termina con `Application bundle generation complete` y **sin** líneas `WARNING` ni `ERROR`. Si hay errores de TypeScript, repórtalos
con el texto exacto (no los "arregles" cambiando el código embebido).

---

## 11. PASO 9 — Verificación

### 11.1 Automática (recomendada) — ver Anexo A
Crea los archivos del Anexo A y ejecuta las pruebas. Resultado esperado:
- Lógica: **19 pruebas OK** (`npm run test:logic` en `tests-fase1`).
- QR ida y vuelta: **300/300** exactos y ≥ 95 % en las degradaciones (`npm run test:qr`).
- E2E con navegador y cámara simulada: **28 ✓ / 0 ✗** (`npm run test:e2e`; en Windows/macOS requiere `CHROME_PATH`, ver Anexo A).
- nginx/PWA: **16 ✓ / 0 ✗** (`tests-fase2`; requiere `nginx` instalado: Linux/WSL).

### 11.2 Manual en el equipo del usuario (**pide permiso antes de ejecutar docker**)
```bash
cd SCIAD
cp .env.example .env            # solo si no existe .env
docker compose up --build       # frontend http://localhost:8080
```
1. `http://localhost:8080` → entra como `admin@sciad.gt` / `sciad123` → **Credenciales QR** → **Ver**: debe mostrar un **QR real**.
   (La base nueva está vacía: antes crea una Zona, una Persona, un Perfil de acceso y genera la credencial.)
2. Entra como `seguridad@sciad.gt` / `sciad123` → **Punto de acceso**: la cámara debe abrir (en `localhost` funciona sin HTTPS).
   Escanea el QR desde otra pantalla: verde con INGRESO; volver a presentarlo mucho después → EGRESO.
3. **Celular (HTTPS por túnel):**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
   ./scripts/url-celular.sh          # Windows: .\scripts\url-celular.ps1
   ```
   Abre la URL `https://….trycloudflare.com` en el celular, entra como seguridad y permite la cámara.
   Al terminar: `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop tunnel`.
   ⚠ La URL es pública mientras el túnel esté encendido y las cuentas demo tienen contraseña conocida: solo para pruebas.

---

## 12. PASO 10 — Informe final y confirmación (obligatorio)

1. Ejecuta `git status --short` y `git diff --stat` y pégalos en el informe.
2. Informe con: qué pasos se aplicaron, resultado de cada verificación (con la salida real), qué **no** se pudo verificar y por qué, y cualquier
   desviación respecto a este documento.
3. **Pregunta al usuario**: *"¿Revisaste los cambios? ¿Hago el commit local?"*. **No hagas commit hasta que responda que sí.** Si responde que sí:
   `git add -A && git commit -m "Fases 1 y 2: escáner QR con cámara, QR real, íconos, hora local, 401 y acceso móvil"` — **local, sin push**.
4. No inicies otras fases. Los pendientes están en el Anexo C.

---

## ANEXO A — Pruebas automatizadas (carpetas nuevas dentro de `sciad-frontend/`)

Crea estas dos carpetas con los archivos indicados. No se cargan en la app: son independientes (cada una con su `package.json`).

### A.1 `sciad-frontend/tests-fase1/` — lógica, QR y E2E con cámara simulada

Requisitos: Node ≥ 22.22.3; para generar el video de la cámara falsa, Python con `numpy` y `pillow` (`pip install numpy pillow`).
Comandos (desde `sciad-frontend/tests-fase1`): `npm install`, y luego `npm run test:logic`, `npm run test:qr`, `npm run prep:video`, `npm run test:e2e`.
Antes del E2E hay que haber compilado la app (`ng build`, Paso 8): el servidor de prueba sirve `dist/`.
**Navegador del E2E:** en **Linux** usa Chromium descargado por npm (automático). En **Windows/macOS** define `CHROME_PATH` con la ruta de Chrome o Edge
(Windows PowerShell: `$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"`).
En Windows, `python3` puede llamarse `python`: si `prep:video` falla por eso, ejecuta `node mkqr.mjs` y `python mkvideo.py` a mano.

#### 📄 NUEVO — `sciad-frontend/tests-fase1/package.json`

````json
{
  "name": "sciad-tests-fase1",
  "private": true,
  "type": "module",
  "description": "Pruebas de la Fase 1 (escáner QR con cámara). Independiente del package.json de la app.",
  "scripts": {
    "test:logic": "node --experimental-transform-types --no-warnings logic.test.mjs",
    "test:qr": "node --no-warnings qr-roundtrip.test.mjs",
    "prep:video": "node mkqr.mjs && python3 mkvideo.py",
    "test:e2e": "node --no-warnings e2e.mjs",
    "test": "npm run test:logic && npm run test:qr && npm run prep:video && npm run test:e2e"
  },
  "devDependencies": {
    "puppeteer-core": "25.12.0"
  },
  "optionalDependencies": {
    "@sparticuz/chromium": "153.0.0"
  }
}
````

#### 📄 NUEVO — `sciad-frontend/tests-fase1/.gitignore`

````
node_modules/
out/
*.y4m
qr_*.png
tokens.json
````

#### 📄 NUEVO — `sciad-frontend/tests-fase1/logic.test.mjs`

````js
process.env.TZ = 'America/Guatemala'; // portable (Windows/Linux/macOS); debe fijarse antes de usar Date
import assert from 'node:assert/strict';
import { extractToken, ScanGate, TOKEN_RE } from '../src/app/core/util/token.ts';
import { horaLocal, fechaLocal, hoyUtc } from '../src/app/core/util/time.ts';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('  ✓', name); };
const T = 'A'.repeat(32) + '0123456789abcdef'.repeat(2);   // 64 hex
assert.equal(T.length, 64);

console.log('token.ts');
ok('acepta token puro', () => assert.equal(extractToken(T), T));
ok('recorta espacios/saltos', () => assert.equal(extractToken('  ' + T + '\n'), T));
ok('extrae token dentro de URL', () => assert.equal(extractToken('https://x.gt/c/' + T + '?a=1'), T));
ok('rechaza 63 y 65 hex', () => { assert.equal(extractToken(T.slice(1)), null); assert.equal(extractToken(T + 'a'), null); });
ok('rechaza texto no hex / vacío / null', () => { assert.equal(extractToken('hola'), null); assert.equal(extractToken(''), null); assert.equal(extractToken(null), null); });
ok('rechaza 64 chars con una letra no-hex', () => assert.equal(extractToken('g' + T.slice(1)), null));

console.log('ScanGate');
const g = new ScanGate({ holdMs: 2500, sameTokenMs: 15000 });
ok('primer token se procesa', () => assert.equal(g.canProcess(T, 0), true));
g.begin(T, 0);
ok('bloquea mientras hay petición en curso (otro token)', () => assert.equal(g.canProcess('B'.repeat(64), 100), false));
g.end(300);
ok('bloquea todo durante holdMs tras terminar', () => assert.equal(g.canProcess('B'.repeat(64), 1000), false));
ok('otro token pasa tras holdMs', () => assert.equal(g.canProcess('B'.repeat(64), 2900), true));
ok('mismo token bloqueado hasta sameTokenMs', () => { assert.equal(g.canProcess(T, 5000), false); assert.equal(g.canProcess(T, 14999), false); });
ok('mismo token permitido pasado sameTokenMs', () => assert.equal(g.canProcess(T, 15001), true));
ok('forget() permite reintento inmediato (fallo de red)', () => { g.forget(); assert.equal(g.canProcess(T, 3000), true); });

console.log('time.ts (backend guarda UTC; Guatemala = UTC-6)');
const tz = process.env.TZ; 
ok('TZ del proceso = America/Guatemala', () => assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Guatemala'));
ok('13:15:32Z → 07:15 local', () => assert.equal(horaLocal('2026-08-21', '13:15:32'), '07:15'));
ok('acepta fracciones de segundo del servidor', () => assert.equal(horaLocal('2026-08-21', '13:15:32.1234567'), '07:15'));
ok('00:30Z del día siguiente → 18:30 del día anterior (cruce de día)', () => { assert.equal(horaLocal('2026-08-22', '00:30:00'), '18:30'); assert.equal(fechaLocal('2026-08-22', '00:30:00'), '2026-08-21'); });
ok('entradas inválidas no rompen (fallback)', () => { assert.equal(horaLocal(null, '13:15:32'), '13:15'); assert.equal(horaLocal('x', 'y'), 'y'.slice(0,5)); });
ok('hoyUtc formato yyyy-mm-dd', () => assert.match(hoyUtc(), /^\d{4}-\d{2}-\d{2}$/));
console.log(`\n${n} pruebas OK`);
````

#### 📄 NUEVO — `sciad-frontend/tests-fase1/qr-roundtrip.test.mjs`

````js
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
const require = createRequire(new URL('../package.json', import.meta.url));
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

const rgba = async (text, width) => {
  const buf = await QRCode.toBuffer(text, { errorCorrectionLevel: 'M', margin: 3, width, color: { dark: '#000000', light: '#ffffff' } });
  const png = PNG.sync.read(buf);
  return { data: new Uint8ClampedArray(png.data), w: png.width, h: png.height };
};
// Reducción por promedio de cajas (como el escalado de una cámara) + desenfoque + ruido gaussiano
const degradar = ({ data, w, h }, factor, blur, sigma) => {
  const nw = Math.max(1, Math.round(w / factor)), nh = Math.max(1, Math.round(h / factor));
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const x0 = Math.floor(x * w / nw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / nw));
    const y0 = Math.floor(y * h / nh), y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / nh));
    let s = 0, c = 0; for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { s += data[(yy * w + xx) * 4]; c++; }
    const v = s / c; for (let k = 0; k < 3; k++) out[(y * nw + x) * 4 + k] = v; out[(y * nw + x) * 4 + 3] = 255;
  }
  let cur = out;
  for (let p = 0; p < blur; p++) { // box blur 3x3
    const nx = new Uint8ClampedArray(cur);
    for (let y = 1; y < nh - 1; y++) for (let x = 1; x < nw - 1; x++) {
      let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += cur[((y + dy) * nw + x + dx) * 4];
      const v = s / 9; for (let k = 0; k < 3; k++) nx[(y * nw + x) * 4 + k] = v;
    }
    cur = nx;
  }
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  if (sigma) for (let i = 0; i < nw * nh; i++) { const n = gauss() * sigma; for (let k = 0; k < 3; k++) cur[i * 4 + k] = Math.min(255, Math.max(0, cur[i * 4 + k] + n)); }
  return { data: cur, w: nw, h: nh };
};
const dec = (img, inv = 'dontInvert') => jsQR(img.data, img.w, img.h, { inversionAttempts: inv })?.data ?? null;

const N = 300, tokens = [];
for (let i = 0; i < N; i++) { const hex = randomBytes(32).toString('hex'); tokens.push(i % 2 ? hex.toUpperCase() : hex); }

// 1) Ida y vuelta exacta (sin degradar), distintos tamaños de render
for (const width of [240, 360, 480, 720]) {
  let okc = 0; for (const t of tokens.slice(0, 100)) if (dec(await rgba(t, width)) === t) okc++;
  console.log(`exacto ${width}px: ${okc}/100`);
  if (okc !== 100) { console.log('FALLO'); process.exitCode = 1; }
}
// 2) Misma matriz de QR → 300 tokens a 480px sin degradar
{ let okc = 0; for (const t of tokens) if (dec(await rgba(t, 480)) === t) okc++; console.log(`300 tokens @480px: ${okc}/300`); if (okc !== 300) process.exitCode = 1; }

// 3) Degradación tipo cámara (solo informativo: tasa de éxito)
const casos = [
  ['reducido ÷2 (240px)', 2, 0, 0], ['reducido ÷3 (160px)', 3, 0, 0], ['÷3 + desenfoque 1', 3, 1, 0],
  ['÷3 + ruido σ=15', 3, 0, 15], ['÷2 + desenfoque 1 + ruido σ=20', 2, 1, 20], ['÷4 (120px)', 4, 0, 0],
];
for (const [nombre, f, b, s] of casos) {
  let okc = 0; const M = 60;
  for (const t of tokens.slice(0, M)) { const base = await rgba(t, 480); if (dec(degradar(base, f, b, s)) === t) okc++; }
  console.log(`${nombre}: ${okc}/${M} (${Math.round(okc / M * 100)}%)`);
}
// 4) Un QR de otro contenido NO debe confundirse con un token
const otro = await rgba('https://example.com/hola', 480);
console.log('QR ajeno decodifica a:', dec(otro));
````

#### 📄 NUEVO — `sciad-frontend/tests-fase1/mkqr.mjs`

````js
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const QRCode = require('qrcode');
const TOK = { A: 'C0FFEE'.repeat(10) + 'ABCD', REV: 'DEADBE'.repeat(10) + '1234' }; // 64 hex, mayúsculas como Convert.ToHexString
for (const [k, v] of Object.entries(TOK)) if (v.length !== 64) throw new Error(k);
writeFileSync('tokens.json', JSON.stringify(TOK));
for (const [name, text] of [['A', TOK.A], ['REV', TOK.REV], ['ALIEN', 'https://example.com/promo?x=1']]) {
  writeFileSync(`qr_${name}.png`, await QRCode.toBuffer(text, { errorCorrectionLevel: 'M', margin: 3, width: 220 }));
}
console.log('qr listos', TOK);
````

#### 📄 NUEVO — `sciad-frontend/tests-fase1/mkvideo.py`

````python
import numpy as np
from PIL import Image, ImageFilter
W,H,FPS = 320,240,10
rng = np.random.default_rng(1)
def frame(qr=None, jitter=0):
    bg = np.full((H,W,3), (150,155,160), np.uint8)               # fondo gris (escena)
    img = Image.fromarray(bg)
    if qr is not None:
        q = Image.open(qr).convert('RGB').resize((200,200), Image.NEAREST)
        q = q.rotate(jitter, expand=False, fillcolor=(150,155,160), resample=Image.BILINEAR)
        img.paste(q, ((W-200)//2 + int(jitter), (H-200)//2))
    img = img.filter(ImageFilter.GaussianBlur(0.6))               # ligero desenfoque de lente
    a = np.asarray(img).astype(np.int16) + rng.normal(0, 4, (H,W,3)).astype(np.int16)  # ruido de sensor
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8))
def to_yuv420(im):
    y,cb,cr = [np.asarray(c) for c in im.convert('YCbCr').split()]
    cb = cb.reshape(H//2,2,W//2,2).mean((1,3)).astype(np.uint8); cr = cr.reshape(H//2,2,W//2,2).mean((1,3)).astype(np.uint8)
    return y.tobytes()+cb.tobytes()+cr.tobytes()
timeline = [(None,3),('qr_A.png',6),(None,3),('qr_REV.png',6),(None,3),('qr_ALIEN.png',6),(None,3),('qr_A.png',6)]
with open('fake_cam.y4m','wb') as f:
    f.write(f'YUV4MPEG2 W{W} H{H} F{FPS}:1 Ip A1:1 C420jpeg\n'.encode())
    n=0
    for qr,sec in timeline:
        for i in range(sec*FPS):
            j = (np.sin(i/6.0)*2.0) if qr else 0   # ligero movimiento de mano
            f.write(b'FRAME\n'); f.write(to_yuv420(frame(qr, j))); n+=1
print('frames', n, 'segundos', n/FPS)
````

#### 📄 NUEVO — `sciad-frontend/tests-fase1/mock-server.mjs`

````js
// Servidor simulado que respeta el CONTRATO real del backend (DTOs, Problem Details con code/detail,
// alternancia ingreso/egreso, 409 por UNIQUE, 401 por token expirado). Sirve además el build de Angular.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOK = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url)));
const DIST = fileURLToPath(new URL('../dist/sciad-frontend/browser', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

export function createServer() {
  const log = [];            // POST /registros-acceso recibidos: {token, status, code, tipo}
  const movs = [];           // movimientos persistidos
  const zonas = [
    { id: '1', nombre: 'Entrada Principal', nivelSeguridad: 'MEDIO', capacidad: 50, nivelRiesgo: 'BAJO', estado: 'activo' },
    { id: '2', nombre: 'Sala de Servidores', nivelSeguridad: 'ALTO', capacidad: 5, nivelRiesgo: 'ALTO', estado: 'activo' },
  ];
  const persona = { id: '7', nombre: 'Juan Pérez López', dpiCodigo: '2345678901234', tipo: 1, estado: 'activo' };
  const creds = [
    { id: '1', personaId: '7', personaNombre: persona.nombre, dpiCodigo: persona.dpiCodigo, token: TOK.A, estado: 'activa', emitido: '2026-08-21', motivo: null, reemitidoDe: null },
    { id: '2', personaId: '7', personaNombre: persona.nombre, dpiCodigo: persona.dpiCodigo, token: TOK.REV, estado: 'revocada', emitido: '2026-08-01', motivo: 'Pérdida', reemitidoDe: null },
  ];
  const users = {
    'admin@sciad.gt': { rol: 'ADMIN', nombre: 'Lic. Marco Antonio Ortíz', token: 'ok.jwt' },
    'seguridad@sciad.gt': { rol: 'SEGURIDAD', nombre: 'Carlos Gómez Rivera', token: 'ok.jwt' },
    'expira@sciad.gt': { rol: 'ADMIN', nombre: 'Sesión Vencida', token: 'expired.jwt' },
  };
  const problem = (res, status, code, detail) => {
    res.writeHead(status, { 'Content-Type': 'application/problem+json' });
    res.end(JSON.stringify({ status, title: 'x', detail, code, message: detail }));
  };
  const json = (res, obj, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const page = (items) => ({ items, total: items.length, pagina: 1, tamanoPagina: 500, totalPaginas: 1 });
  const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d ? JSON.parse(d) : {})); });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      const auth = req.headers.authorization ?? '';
      const p = url.pathname;
      if (p === '/api/auth/login' && req.method === 'POST') {
        const { email, password } = await body(req);
        const u = users[email];
        if (!u || password !== 'sciad123') return problem(res, 401, 'UNAUTHORIZED', 'Credenciales inválidas.');
        return json(res, { token: u.token, user: { id: '1', nombre: u.nombre, email, rol: u.rol, puesto: 'x', activo: true, avatarInitials: 'XX', fechaCreacion: new Date().toISOString() } });
      }
      if (!auth.startsWith('Bearer ') || auth.includes('expired')) return problem(res, 401, 'UNAUTHORIZED', 'Token ausente, inválido o expirado.');
      if (p === '/api/zonas-acceso') return json(res, zonas);
      if (p === '/api/personas') return json(res, page([persona]));
      if (p === '/api/credenciales' && req.method === 'GET') return json(res, creds);
      if (p === '/api/notificaciones') return json(res, page([]));
      if (p === '/api/registros-acceso/hoy') {
        const rows = [];
        for (const m of movs) { const last = movs.filter((x) => x.personaId === m.personaId).at(-1); if (m === last) rows.push({ personaId: +m.personaId, personaNombre: persona.nombre, zonaId: +m.zonaId, zonaNombre: zonas[+m.zonaId - 1].nombre, ultimoTipo: m.tipo, ultimaHora: m.hora, dentro: m.tipo === 'ingreso' }); }
        return json(res, rows);
      }
      if (p === '/api/registros-acceso' && req.method === 'GET') {
        return json(res, page(movs.map((m, i) => ({ id: String(i + 1), personaId: +m.personaId, personaNombre: persona.nombre, zonaId: +m.zonaId, zonaNombre: zonas[+m.zonaId - 1].nombre, fecha: m.fecha, hora: m.hora, tipo: m.tipo, registradoPor: 'Carlos' }))));
      }
      if (p === '/api/registros-acceso' && req.method === 'POST') {
        const { token, zonaId } = await body(req);
        const entry = { token, status: 0, code: null, tipo: null, at: Date.now() };
        log.push(entry);
        const fail = (status, code, detail) => { entry.status = status; entry.code = code; return problem(res, status, code, detail); };
        if (!/^[0-9a-fA-F]{64}$/.test(token ?? '')) return fail(400, 'VALIDACION', 'Token inválido.');
        const c = creds.find((x) => x.token === token);
        if (!c) return fail(400, 'TOKEN_INVALIDO', 'El token de la credencial QR no es válido.');
        if (c.estado !== 'activa') return fail(400, 'CREDENCIAL_REVOCADA', 'La credencial está revocada o vencida.');
        const ing = movs.filter((m) => m.tipo === 'ingreso').length, egr = movs.filter((m) => m.tipo === 'egreso').length;
        const tipo = ing > egr ? 'egreso' : 'ingreso';
        if (tipo === 'ingreso' && ing > 0) return fail(409, 'CONFLICT', 'Ya existe un ingreso registrado para esta persona hoy (doble ingreso).');
        const now = new Date();
        const m = { personaId: '7', zonaId: String(zonaId), tipo, fecha: now.toISOString().slice(0, 10), hora: now.toISOString().slice(11, 19) };
        movs.push(m); entry.status = 200; entry.tipo = tipo;
        return json(res, { id: String(movs.length), personaId: 7, personaNombre: persona.nombre, zonaId: +zonaId, zonaNombre: zonas[+zonaId - 1].nombre, tipo, fecha: m.fecha, hora: m.hora, estado: 'autorizado', timestamp: now.toISOString() });
      }
      return json(res, {}, 404);
    }
    let f = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!existsSync(f) || statSync(f).isDirectory()) f = join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return { server, log, movs, TOK };
}
````

#### 📄 NUEVO — `sciad-frontend/tests-fase1/e2e.mjs`

````js
// TZ: la prueba valida horas locales de Guatemala (portable, se fija antes de usar Date).
process.env.TZ = 'America/Guatemala';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import os from 'node:os';
import { createServer } from './mock-server.mjs';
const require = createRequire(new URL('../package.json', import.meta.url));
const jsQR = require('jsqr'); const { PNG } = require('pngjs');

const PORT = 8099, BASE = `http://localhost:${PORT}`;
const { server, log, movs, TOK } = createServer();
await new Promise((r) => server.listen(PORT, '0.0.0.0', r));

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`  ${cond ? '✓' : '✗ FALLO'} ${name}${extra ? '  → ' + extra : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, step = 150) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };

// Navegador: CHROME_PATH (Chrome/Edge instalado; Windows/macOS/Linux) o, en Linux, Chromium vía npm (@sparticuz/chromium).
async function resolverNavegador() {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, headless: true };
  if (process.platform !== 'linux') throw new Error('Define CHROME_PATH con la ruta de Chrome/Edge (p. ej. C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe).');
  const chromium = (await import('@sparticuz/chromium')).default;
  return { executablePath: await chromium.executablePath(), headless: 'shell' };
}
const nav = await resolverNavegador();
const browser = await puppeteer.launch({
  ...nav,
  env: { ...process.env, TZ: 'America/Guatemala' },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${fileURLToPath(new URL('./fake_cam.y4m', import.meta.url))}`],
});
const mobile = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

async function login(page, base, email) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[type=email], input[formcontrolname=email], sci-input input', email);
  const inputs = await page.$$('form input');
  await inputs[1].type('sciad123');
  await page.click('form button.submit, form button[type=submit], form button');
}

// ───────────────────────── 1) ESCANEO CON CÁMARA (celular) ─────────────────────────
console.log('\n[1] Escaneo con cámara real (viewport de celular, cámara simulada)');
{
  const page = await browser.newPage(); await page.setViewport(mobile); await page.setUserAgent(UA);
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await login(page, BASE, 'seguridad@sciad.gt');
  await page.waitForFunction(() => location.pathname.includes('/seguridad/escaneo'), { timeout: 10000 });
  check('login SEGURIDAD → /seguridad/escaneo', true);

  const live = await until(() => page.$('.viewport.live'), 12000);
  check('cámara activa (viewport.live) sin pulsar nada', !!live);
  const vsz = await page.evaluate(() => { const v = document.querySelector('video'); return v ? [v.videoWidth, v.videoHeight, !!v.srcObject] : null; });
  check('el <video> recibe fotogramas', vsz && vsz[0] > 0, JSON.stringify(vsz));
  const iconos = await page.$$eval('sci-icon svg', (n) => n.filter((s) => s.children.length > 0).length);
  check('los íconos de la app se dibujan (SVG con contenido)', iconos > 3, `íconos con contenido=${iconos}`);
  const zona = await page.$eval('#zona-sel', (e) => e.value);
  check('zona preseleccionada automáticamente', zona === '1', `zona=${zona}`);

  // 1.a QR válido → ingreso (exactamente UNA petición aunque el QR esté 6 s frente a la cámara)
  const ok1 = await until(() => page.$('.overlay.ok'), 45000);
  check('QR válido → alerta VERDE', !!ok1);
  if (ok1) {
    const t = await page.$eval('.overlay.ok', (e) => e.innerText);
    check('muestra persona y tipo INGRESO', /Juan Pérez López/.test(t) && /INGRESO/.test(t), t.replace(/\n/g, ' | '));
    const hh = await page.$eval('.overlay.ok .o-when', (e) => e.textContent.trim());
    const d = new Date(), exp = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const near = Math.abs((+hh.slice(0, 2) * 60 + +hh.slice(3)) - (d.getHours() * 60 + d.getMinutes())) <= 1;
    check('hora mostrada = hora LOCAL (UTC-6), no UTC', near && hh !== new Date().toISOString().slice(11, 16), `mostrada=${hh} local≈${exp} utc=${new Date().toISOString().slice(11, 16)}`);
    await page.screenshot({ path: 'out/shot_scan_ok.png' });
  }
  await sleep(5500); // el QR sigue frente a la cámara varios segundos
  const aPosts1 = log.filter((l) => l.token === TOK.A).length;
  check('NO se duplica el escaneo mientras el QR sigue visible (1 petición)', aPosts1 === 1, `peticiones=${aPosts1}`);

  // 1.b QR revocado → rojo
  const bad = await until(() => page.$('.overlay.bad'), 30000);
  check('QR revocado → alerta ROJA', !!bad);
  if (bad) {
    const t = await page.$eval('.overlay.bad', (e) => e.innerText);
    check('título "Credencial revocada"', /Credencial revocada/.test(t), t.replace(/\n/g, ' | '));
    await page.screenshot({ path: 'out/shot_scan_bad.png' });
  }

  // 1.c QR ajeno → "Código no reconocido" sin llamar al servidor
  const before = log.length;
  const alien = await until(async () => (await page.$$eval('.overlay.bad .o-title', (n) => n.map((x) => x.textContent))).some((x) => /Código no reconocido/.test(x)), 30000);
  check('QR ajeno → "Código no reconocido"', !!alien);
  check('QR ajeno NO genera petición al servidor', log.length === before, `peticiones nuevas=${log.length - before}`);

  // 1.d Reaparece el QR válido (>15 s después) → EGRESO
  const egreso = await until(async () => { const t = await page.$$eval('.overlay.ok', (n) => n.map((x) => x.innerText)); return t.find((x) => /EGRESO/.test(x)); }, 45000);
  check('al volver a presentar la credencial → EGRESO (alternancia del servidor)', !!egreso);

  const seq = log.map((l) => `${l.token === TOK.A ? 'A' : l.token === TOK.REV ? 'REV' : '?'}:${l.status}${l.tipo ? '/' + l.tipo : ''}`).join('  ');
  check('secuencia de peticiones exacta: A ingreso, REV 400, A egreso', seq === 'A:200/ingreso  REV:400  A:200/egreso', seq);
  const rec = await page.$$eval('.rec', (n) => n.length);
  check('lista "Últimos escaneos" registra los resultados', rec >= 3, `filas=${rec}`);
  check('sin errores de consola/JS', errs.length === 0, errs.slice(0, 2).join(' || '));
  await page.close();
}

// ───────────────────────── 2) CONTEXTO NO SEGURO (HTTP por IP de red) ─────────────────────────
console.log('\n[2] Cámara sobre HTTP en IP de red (contexto no seguro) → mensaje claro');
{
  const ip = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  if (!ip) { console.log('  (sin IP de red en este entorno, se omite)'); }
  else {
    const page = await browser.newPage(); await page.setViewport(mobile); await page.setUserAgent(UA);
    await login(page, `http://${ip}:${PORT}`, 'seguridad@sciad.gt');
    await page.waitForFunction(() => location.pathname.includes('/seguridad/escaneo'), { timeout: 10000 });
    const secure = await page.evaluate(() => window.isSecureContext);
    const msg = await until(() => page.$eval('.cam-error', (e) => e.innerText).catch(() => null), 8000);
    check('isSecureContext=false en http://IP', secure === false, `ip=${ip}`);
    check('explica que se necesita HTTPS y ofrece alternativas', !!msg && /HTTPS/.test(msg) && /foto/.test(msg), msg && msg.replace(/\n/g, ' | '));
    const btn = await page.$$eval('.actions button', (b) => b.map((x) => x.innerText.trim()));
    check('botón "Reintentar cámara" disponible', btn.some((t) => /Reintentar/.test(t)), btn.join(','));
    await page.screenshot({ path: 'out/shot_insecure.png' });
    await page.close();
  }
}

// ───────────────────────── 3) ADMIN: QR real, descarga, gafete, escaneo en PC ─────────────────────────
console.log('\n[3] Administrador en escritorio: QR real + gafete + escáner');
{
  const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 800 });
  await login(page, BASE, 'admin@sciad.gt');
  await page.waitForFunction(() => location.pathname.includes('/admin/'), { timeout: 10000 });
  await page.goto(`${BASE}/admin/credenciales`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('table.sci-table tbody tr td');
  const ver = (await page.$$('button[aria-label="Ver"]'))[0]; await ver.click();
  await page.waitForSelector('img.qr-img', { timeout: 8000 });
  const src = await page.$eval('img.qr-img', (i) => i.src);
  const png = PNG.sync.read(Buffer.from(src.split(',')[1], 'base64'));
  const dec = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
  check('el modal muestra un QR REAL que decodifica exactamente al token', dec === TOK.A, `${dec?.slice(0, 12)}…`);
  const nota = await page.$eval('.qr-note', (e) => e.textContent);
  check('aclara que el QR no contiene datos personales', /no incluye datos personales/.test(nota));
  await page.screenshot({ path: 'out/shot_qr_modal.png' });

  // gafete: se arma el iframe de impresión con nombre + QR
  await page.evaluate(() => { window.__iframes = []; const orig = Node.prototype.appendChild; Node.prototype.appendChild = function (n) { const r = orig.call(this, n); if (n.tagName === 'IFRAME') window.__iframes.push(n); return r; }; });
  const [, btnImp] = await page.$$('.qr-actions button');
  await btnImp.click(); await sleep(1500);
  const gaf = await page.evaluate(() => { const f = window.__iframes[0]; const d = f?.contentDocument; return d ? { nombre: d.querySelector('.name')?.textContent, img: !!d.querySelector('img.qr')?.src.startsWith('data:image/png'), tipo: d.querySelector('.tipo')?.textContent } : null; });
  check('"Imprimir gafete" arma el gafete con nombre, tipo y QR', gaf && gaf.nombre === 'Juan Pérez López' && gaf.img, JSON.stringify(gaf));

  // credencial revocada: QR atenuado + sello + sin impresión
  await page.evaluate(() => document.querySelectorAll('button[aria-label="Ver"]')[1].click());
  await page.waitForSelector('.qr-stamp', { timeout: 5000 });
  const disabled = await page.$$eval('.qr-actions button', (b) => b[1].disabled);
  check('credencial revocada: sello "REVOCADA" y gafete deshabilitado', disabled === true);

  // el admin puede abrir el escáner en la PC
  await page.goto(`${BASE}/admin/escaneo`, { waitUntil: 'networkidle0' });
  const live = await until(() => page.$('.viewport.live'), 12000);
  check('Admin: /admin/escaneo abre la cámara de la computadora', !!live);
  const nav = await page.$$eval('.nav a', (a) => a.map((x) => x.innerText.trim()));
  check('menú de Admin incluye "Punto de acceso" y "Accesos de hoy"', nav.includes('Punto de acceso') && nav.includes('Accesos de hoy'), nav.join(' | '));
  await page.screenshot({ path: 'out/shot_admin_scan.png' });

  // pantallas con hora: muestran hora local
  await page.goto(`${BASE}/admin/accesos`, { waitUntil: 'networkidle0' });
  const h = await page.$$eval('.row-right .mono', (n) => n.map((x) => x.textContent.trim()).filter((t) => /\d\d:\d\d/.test(t)));
  const utcH = movs.at(-1)?.hora.slice(0, 5);
  check('"Accesos de hoy" muestra hora local (≠ UTC)', h.length > 0 && h[0] !== utcH, `mostrada=${h[0]} utc=${utcH}`);
  await page.close();
}

// ───────────────────────── 4) SESIÓN EXPIRADA ─────────────────────────
console.log('\n[4] Token vencido (401) → vuelve al login');
{
  const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 800 });
  await login(page, BASE, 'expira@sciad.gt');
  const back = await page.waitForFunction(() => location.pathname === '/login' && !localStorage.getItem('sciad.session'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('401 en cualquier endpoint → sesión cerrada y redirige a /login', back);
  await page.close();
}

console.log(`\nRESULTADO: ${pass} ✓  ${fail} ✗`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
````

### A.2 `sciad-frontend/tests-fase2/` — nginx real + manifest PWA (solo Linux/WSL con `nginx` instalado)

Comandos (desde `sciad-frontend/tests-fase2`): `npm install` y `npm test`. Necesita el build (`dist/`) y `nginx` en el PATH. Edita `/etc/hosts`
(añade `127.0.0.1 backend`), por lo que en Linux hay que ejecutarlo con permisos para ello. **Si el entorno no lo permite, omítela y dilo en el informe.**

#### 📄 NUEVO — `sciad-frontend/tests-fase2/package.json`

````json
{
  "name": "sciad-tests-fase2",
  "private": true,
  "type": "module",
  "description": "Fase 2: valida nginx (cabeceras, manifest) y la instalabilidad PWA con Chromium real.",
  "scripts": { "test": "node --no-warnings pwa-nginx.test.mjs" },
  "devDependencies": { "puppeteer-core": "25.12.0" },
  "optionalDependencies": { "@sparticuz/chromium": "153.0.0" }
}
````

#### 📄 NUEVO — `sciad-frontend/tests-fase2/.gitignore`

````
node_modules
node_modules/
.tmp/
````

#### 📄 NUEVO — `sciad-frontend/tests-fase2/pwa-nginx.test.mjs`

````js
// Fase 2 — Levanta el build de Angular detrás de NGINX REAL usando el nginx.conf del repo
// (solo se cambian root/listen/rutas temporales), con un backend falso que devuelve 401,
// y comprueba cabeceras, manifest, íconos e instalabilidad con Chromium.
// Requisitos: nginx instalado en el sistema (apt install nginx), build en ../dist y `npm i` en ../tests-fase1.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.resolve(HERE, '..');
const DIST = path.join(FRONT, 'dist/sciad-frontend/browser');
const TMP = path.join(HERE, '.tmp'); mkdirSync(TMP, { recursive: true });
const PORT = 8097;
let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗ FALLO'} ${n}${x ? '  → ' + x : ''}`); };
const get = (p, headers = {}) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p, headers }, (r) => { let b = []; r.on('data', (c) => b.push(c)); r.on('end', () => res({ status: r.statusCode, h: r.headers, body: Buffer.concat(b) })); }).on('error', rej));

if (!existsSync(DIST)) throw new Error('Falta el build: ng build --configuration production');
try { execFileSync('nginx', ['-v'], { stdio: 'pipe' }); } catch { throw new Error('nginx no está instalado'); }

// backend falso en :8080 (el nginx.conf hace proxy_pass a http://backend:8080 → se resuelve por /etc/hosts)
const back = http.createServer((q, r) => { r.writeHead(401, { 'Content-Type': 'application/problem+json' }); r.end('{"code":"UNAUTHORIZED"}'); });
await new Promise((r) => back.listen(8080, '127.0.0.1', r));
const hosts = readFileSync('/etc/hosts', 'utf8'); if (!/\bbackend\b/.test(hosts)) writeFileSync('/etc/hosts', hosts + '\n127.0.0.1 backend\n');

// nginx.conf del repo → envuelto en un nginx.conf completo
let server = readFileSync(path.join(FRONT, 'nginx.conf'), 'utf8')
  .replace('listen       80;', `listen ${PORT};`).replace('root   /usr/share/nginx/html;', `root ${DIST};`);
const main = `pid ${TMP}/nginx.pid; error_log ${TMP}/err.log; daemon off;
events { worker_connections 64; }
http { include /etc/nginx/mime.types; access_log off;
  client_body_temp_path ${TMP}/b; proxy_temp_path ${TMP}/p; fastcgi_temp_path ${TMP}/f; uwsgi_temp_path ${TMP}/u; scgi_temp_path ${TMP}/s;
${server}
}`;
writeFileSync(path.join(TMP, 'nginx.conf'), main);
const t = (() => { try { execFileSync('nginx', ['-t', '-c', path.join(TMP, 'nginx.conf')], { stdio: 'pipe' }); return true; } catch (e) { console.log(String(e.stderr)); return false; } })();
check('nginx -t acepta el nginx.conf del repo', t);
const ng = spawn('nginx', ['-c', path.join(TMP, 'nginx.conf')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

console.log('\n[A] Cabeceras HTTP (nginx real)');
let r = await get('/manifest.webmanifest');
check('manifest: 200 y application/manifest+json', r.status === 200 && /application\/manifest\+json/.test(r.h['content-type']), `${r.status} ${r.h['content-type']}`);
check('manifest: Cache-Control no-cache', /no-cache/.test(r.h['cache-control'] ?? ''), r.h['cache-control']);
const man = JSON.parse(r.body.toString());
r = await get('/index.html');
check('index.html: no-cache + Permissions-Policy cámara', /no-cache/.test(r.h['cache-control'] ?? '') && /camera=\(self\)/.test(r.h['permissions-policy'] ?? ''), `${r.h['cache-control']} | ${r.h['permissions-policy']}`);
check('index.html: conserva cabeceras de seguridad', r.h['x-content-type-options'] === 'nosniff' && r.h['x-frame-options'] === 'SAMEORIGIN');
r = await get('/seguridad/escaneo');
check('ruta SPA (/seguridad/escaneo) cae a index.html SIN caché', r.status === 200 && /<app-root>/.test(r.body.toString()) && /no-cache/.test(r.h['cache-control'] ?? ''), r.h['cache-control']);
const js = readFileSync(path.join(DIST, 'index.html'), 'utf8').match(/main-[A-Za-z0-9_-]+\.js/)[0];
r = await get('/' + js);
check('asset con hash: caché larga immutable', /immutable/.test(r.h['cache-control'] ?? '') && r.status === 200, r.h['cache-control']);
r = await get('/chunk-INEXISTENTE.js');
check('asset viejo inexistente → 404 (no devuelve index.html)', r.status === 404, String(r.status));
r = await get('/api/zonas-acceso');
check('proxy /api/ llega al backend', r.status === 401 && /UNAUTHORIZED/.test(r.body.toString()), String(r.status));

console.log('\n[B] Manifest e íconos');
for (const ic of man.icons) {
  const f = await get(ic.src);
  const [w, h] = [f.body.readUInt32BE(16), f.body.readUInt32BE(20)];
  check(`ícono ${ic.src} (${ic.purpose}) existe y mide ${ic.sizes}`, f.status === 200 && f.h['content-type'] === 'image/png' && `${w}x${h}` === ic.sizes, `${f.status} ${w}x${h}`);
}
r = await get('/icons/apple-touch-icon.png');
check('apple-touch-icon 180x180', r.status === 200 && r.body.readUInt32BE(16) === 180);
check('manifest: standalone, start_url y theme_color', man.display === 'standalone' && man.start_url === '/' && man.theme_color === '#3b5bdb');

console.log('\n[C] Chromium reconoce el manifest');
const nav = process.env.CHROME_PATH
  ? { executablePath: process.env.CHROME_PATH, headless: true }
  : { executablePath: await (await import('@sparticuz/chromium')).default.executablePath(), headless: 'shell' };
const browser = await puppeteer.launch({ ...nav, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/login`, { waitUntil: 'networkidle0' });
const cdp = await page.createCDPSession();
const m = await cdp.send('Page.getAppManifest');
check('Chromium parsea el manifest sin errores', (m.errors ?? []).length === 0 && !!m.data, JSON.stringify(m.errors ?? []));
const ins = await cdp.send('Page.getInstallabilityErrors');
const ids = (ins.installabilityErrors ?? []).map((e) => e.errorId);
console.log('  ℹ errores de instalabilidad según Chromium:', ids.length ? ids.join(', ') : '(ninguno)');
const meta = await page.evaluate(() => ({ link: document.querySelector('link[rel=manifest]')?.getAttribute('href'), apple: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'), theme: document.querySelector('meta[name=theme-color]')?.content }));
check('index enlaza manifest, apple-touch-icon y theme-color', meta.link === 'manifest.webmanifest' && !!meta.apple && meta.theme === '#3b5bdb', JSON.stringify(meta));
await browser.close(); ng.kill(); back.close();
console.log(`\nRESULTADO: ${pass} ✓  ${fail} ✗`);
process.exit(fail ? 1 : 0);
````

---

## ANEXO B — Decisiones de diseño que NO se deben deshacer

1. **El servidor alterna ingreso/egreso en cada escaneo válido.** Una cámara lee el mismo QR muchas veces por segundo; por eso existen `ScanGate`
   (espera 2,5 s tras un resultado y no reenvía el mismo token en 15 s) y la regla de `QrCameraScanner.resume()` (no olvida el último código: un
   QR que sigue frente a la cámara no se reenvía; debe salir del encuadre y volver).
2. **El QR contiene solo el token (64 hex)**, sin datos personales (RNF-01/RNF-10). El nombre solo aparece en el gafete impreso.
3. **El token se codifica tal cual** (el backend lo emite en MAYÚSCULAS): no se cambia el caso.
4. **El 409 llega con `code: "CONFLICT"`** (no `CONFLICTO`): el frontend decide por estado HTTP.
5. **La cámara exige contexto seguro (HTTPS o `localhost`)**. En HTTP por IP de red se muestra un aviso claro; quedan "Leer desde foto" y el registro manual.
6. `jsqr` y `qrcode` se cargan con `import()` dinámico (no engordan el bundle inicial).
7. `bypassSecurityTrustHtml` en `icon.component.ts` es seguro porque el contenido sale **solo** de la constante `ICONS` (nunca de entrada del usuario).
8. No hay *service worker* a propósito (sin modo offline; evita servir versiones viejas).
9. El backend guarda `fecha`/`hora` en **UTC**; `core/util/time.ts` las convierte a hora local. Si el backend cambia a hora local (Fase 4), poner `UTC_STORED = false`.

## ANEXO C — Pendientes (NO hacer ahora; son fases siguientes)

| Fase | Contenido |
|---|---|
| 3 | Datos demo (script por API) y guía de uso. La base nueva no trae zonas, personas ni credenciales. |
| 4 | **Backend:** zona horaria de Guatemala. Hoy `DateTime.UtcNow` define "hoy": a las 18:00 locales cambia el día y una salida posterior se registraría como nuevo ingreso. Afecta `RegistrosAccesoService`, `AuditoriaService`, `CredencialesService`, `ReportesService` y los tests que usan `UtcNow`. |
| 5 | Ocultar las cuentas demo del login, rate-limit de login compartido tras nginx en desarrollo, JWT en `localStorage`, y verificación E2E real contra Docker (backend .NET + PostgreSQL). |

## ANEXO D — Qué no se verificó al preparar este documento

- No se ejecutó el backend .NET + PostgreSQL real (las pruebas usan un servidor simulado que replica el contrato leído del código).
- No se probó el túnel de Cloudflare real ni la cámara en un celular físico; el formato del log de `cloudflared` podría variar (si el script no encuentra la URL, revisa `docker compose ... logs tunnel` y ajusta el `grep`).
- No se probó `nginx.prod.conf` completo (necesita certificados y nginx ≥ 1.25.1 por `http2 on`); se probó el mismo bloque de cabeceras en `nginx.conf`.
