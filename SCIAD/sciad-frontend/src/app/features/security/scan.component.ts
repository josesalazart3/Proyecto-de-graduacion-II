import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccessLogService } from '../../core/services/crud.service';
import { AuthService } from '../../core/services/auth.service';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';
import { ToastService } from '../../shared/ui/toast.service';

const RESULT_META = {
  AUTORIZADO: {
    label: 'Acceso autorizado',
    sub: 'Ingreso permitido',
    tone: 'ok',
    icon: 'checkCircle',
  },
  DENEGADO: {
    label: 'Acceso denegado',
    sub: 'Ingreso rechazado',
    tone: 'bad',
    icon: 'alertTriangle',
  },
  PENDIENTE: {
    label: 'Pendiente de revisión',
    sub: 'Se requiere revisión',
    tone: 'warn',
    icon: 'clock',
  },
} as const;

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [ReactiveFormsModule, Button, Icon, Card],
  template: `
    <div class="scan">
      <div class="scan-hero">
        <div class="scan-frame" [class.animate]="scanning()">
          <sci-icon name="qr" [size]="120" class="frame-icon" />
          @if (scanning()) {
            <div class="frame-line"></div>
            <div class="frame-caption">Escaneando…</div>
          }
        </div>
        <p class="scan-hint">Apunta la cámara al código QR del visitante</p>
      </div>

      @if (result(); as r) {
        <div class="result" [class]="'r-' + r.resultado.toLowerCase()" role="status">
          <sci-icon [name]="meta(r.resultado).icon" [size]="30" />
          <div>
            <div class="result-title">{{ meta(r.resultado).label }}</div>
            <div class="result-sub">{{ r.titular }}</div>
            @if (r.motivo) {
              <div class="result-motivo">{{ r.motivo }}</div>
            }
            <div class="result-when">{{ r.zona }} · {{ time(r.timestamp) }}</div>
          </div>
        </div>
      }

      <sci-card class="manual">
        <div class="manual-label uppercase-label">Ingreso manual del token</div>
        <form [formGroup]="form" (ngSubmit)="submit()" class="manual-form">
          <input
            formControlName="token"
            placeholder="Ej. SC1AD-0101"
            class="token-input mono"
            (input)="form.get('token')?.setValue($any($event.target).value.toUpperCase())"
          />
          <button sci-btn variant="primary" size="md" [loading]="loading()">
            Registrar acceso
          </button>
        </form>
        <p class="manual-hint">Usa el código de ejemplo <button type="button" class="hint-btn mono" (click)="fillDemo()">SC1AD-0101</button> (autorizado) o <button type="button" class="hint-btn mono" (click)="fillDemoRevoked()">SC1AD-0109</button> (revocado).</p>
      </sci-card>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .scan {
        max-width: 520px;
        margin: 0 auto;
        padding: 20px 16px 40px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .scan-hero { display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .scan-frame {
        position: relative;
        width: 220px;
        height: 220px;
        border-radius: 20px;
        border: 2px dashed var(--border-strong);
        background: var(--surface);
        display: grid;
        place-items: center;
        color: var(--text-subtle);
        overflow: hidden;
      }
      .scan-frame.animate {
        border-color: var(--sciad-brand);
        color: var(--sciad-brand);
      }
      .frame-line {
        position: absolute;
        left: 16px;
        right: 16px;
        top: 0;
        height: 3px;
        border-radius: 3px;
        background: var(--sciad-brand);
        animation: scanmove 1.6s ease-in-out infinite;
      }
      @keyframes scanmove {
        0% { top: 12%; }
        50% { top: 88%; }
        100% { top: 12%; }
      }
      .frame-caption { position: absolute; bottom: 14px; font-size: 12px; font-weight: 600; }
      .scan-hint { text-align: center; color: var(--text-muted); font-size: 14px; }

      .result {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        padding: 16px;
        border-radius: var(--radius-md);
        animation: pop 0.25s var(--ease-out);
      }
      @keyframes pop { from { transform: scale(0.98); opacity: 0; } }
      .r-autorizado { background: var(--sciad-success-soft); color: var(--sciad-success); }
      .r-denegado { background: var(--sciad-danger-soft); color: var(--sciad-danger); }
      .r-pendiente { background: var(--sciad-warning-soft); color: var(--sciad-warning); }
      .result-title { font-weight: 800; font-size: 18px; line-height: 1.2; }
      .result-sub { font-weight: 600; font-size: 15px; margin-top: 2px; }
      .result-motivo { font-size: 13px; margin-top: 2px; }
      .result-when { font-size: 12px; opacity: 0.75; margin-top: 4px; }

      .manual { padding: 20px; }
      .manual-label { color: var(--text-subtle); margin-bottom: 10px; }
      .manual-form { display: flex; flex-direction: column; gap: 12px; }
      .token-input {
        width: 100%;
        height: 48px;
        padding: 0 12px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-strong);
        background: var(--surface);
        color: var(--text);
        font-size: 16px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .token-input:focus { outline: none; border-color: var(--sciad-brand); box-shadow: 0 0 0 3px var(--sciad-brand-soft); }
      .manual-hint { font-size: 12px; color: var(--text-subtle); margin-top: 10px; }
      .hint-btn {
        border: none; background: transparent; padding: 0;
        color: var(--sciad-brand); font-weight: 600; cursor: pointer; text-decoration: underline;
      }
    `,
  ],
})
export class ScanComponent {
  private readonly service = inject(AccessLogService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly scanning = signal(true);
  protected readonly loading = signal(false);
  protected readonly result = signal<any>(null);

  protected readonly form = this.fb.group({
    token: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected meta(result: string) {
    return RESULT_META[result as keyof typeof RESULT_META] ?? RESULT_META.PENDIENTE;
  }

  fillDemo(): void {
    this.form.setValue({ token: 'SC1AD-0101' });
  }
  fillDemoRevoked(): void {
    this.form.setValue({ token: 'SC1AD-0109' });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    const token = this.form.value.token!;
    this.loading.set(true);
    this.service
      .escanear({
        codigoQr: token,
        operador: this.auth.currentUserName(),
        estacion: 'Acceso Principal',
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.result.set(res);
          this.form.reset();
          if (res.resultado === 'AUTORIZADO') {
            this.toast.success('Acceso autorizado', res.titular);
          } else {
            this.toast.warning('Acceso denegado', res.motivo);
          }
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Error', 'No se pudo procesar el escaneo.');
        },
      });
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
