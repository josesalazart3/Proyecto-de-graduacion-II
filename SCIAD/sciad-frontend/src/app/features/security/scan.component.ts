// Escaneo QR (CU-04): Fase 3 lo reconcilia al backend real — payload {token, zonaId},
// el tipo (ingreso/egreso) se infiere en el servidor. Los rechazos llegan como error 4xx
// con `detail` (TOKEN_INVALIDO, CREDENCIAL_REVOCADA, PERSONA_INACTIVA, ZONA_NO_AUTORIZADA,
// FUERA_VIGENCIA, CONFLICTO). Ya no hay "tomadores" de demo: el token es el hex de 64 chars.
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccessLogService, ZonasService } from '../../core/services/crud.service';
import { RegistroAccesoResultado } from '../../core/models/access-log.model';
import { Zona } from '../../core/models/access.model';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';

interface EscanerResultado {
  ok: boolean;
  persona?: string;
  zona?: string;
  tipo?: string;
  hora?: string;
  motivo?: string;
}

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
        <p class="scan-hint">Apunta la cámara al código QR de la credencial</p>
      </div>

      @if (result(); as r) {
        @if (r.ok) {
          <div class="result r-ok" role="status">
            <sci-icon name="checkCircle" [size]="30" />
            <div>
              <div class="result-title">Acceso autorizado</div>
              <div class="result-sub">{{ r.persona }}</div>
              <div class="result-motivo">{{ r.tipo === 'ingreso' ? 'Ingreso' : 'Egreso' }} · {{ r.zona }}</div>
              <div class="result-when">{{ r.hora }}</div>
            </div>
          </div>
        } @else {
          <div class="result r-den" role="alert">
            <sci-icon name="alertTriangle" [size]="30" />
            <div>
              <div class="result-title">Acceso denegado</div>
              <div class="result-sub">{{ r.persona ?? 'Token no reconocido' }}</div>
              @if (r.motivo) {
                <div class="result-motivo">{{ r.motivo }}</div>
              }
            </div>
          </div>
        }
      }

      <sci-card class="manual">
        <div class="manual-label uppercase-label">Registro manual del acceso</div>
        <form [formGroup]="form" (ngSubmit)="submit()" class="manual-form">
          <select
            formControlName="zonaId"
            class="token-input"
            [class.invalid]="form.controls.zonaId.touched && form.controls.zonaId.invalid"
          >
            <option value="" disabled>Zona de acceso…</option>
            @for (z of zonaOptions(); track z.id) {
              <option [value]="z.id">{{ z.nombre }}</option>
            }
          </select>
          <input
            formControlName="token"
            placeholder="Token QR de 64 caracteres"
            class="token-input mono"
            (input)="form.get('token')?.setValue($any($event.target).value.trim())"
          />
          <button sci-btn variant="primary" size="md" [loading]="loading()" [disabled]="zonaOptions().length === 0">
            Registrar acceso
          </button>
        </form>
        @if (zonaOptions().length === 0) {
          <p class="manual-hint">No hay zonas activas. Regístralas primero desde administración.</p>
        }
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
      .r-ok { background: var(--sciad-success-soft); color: var(--sciad-success); }
      .r-den { background: var(--sciad-danger-soft); color: var(--sciad-danger); }
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
        font-size: 15px;
      }
      .token-input.invalid { border-color: var(--sciad-danger); }
      .token-input:focus { outline: none; border-color: var(--sciad-brand); box-shadow: 0 0 0 3px var(--sciad-brand-soft); }
      .manual-hint { font-size: 12px; color: var(--text-subtle); margin-top: 10px; }
    `,
  ],
})
export class ScanComponent implements OnInit {
  private readonly service = inject(AccessLogService);
  private readonly zonasSvc = inject(ZonasService);
  private readonly fb = inject(FormBuilder);

  protected readonly scanning = signal(true);
  protected readonly loading = signal(false);
  protected readonly zonas = signal<Zona[]>([]);
  protected readonly result = signal<EscanerResultado | null>(null);

  protected readonly zonaOptions = computed(() =>
    this.zonas().filter((z) => z.estado === 'activo'),
  );
  protected readonly form = this.fb.group({
    zonaId: ['', Validators.required],
    token: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    this.zonasSvc.list().subscribe((zs) => {
      this.zonas.set(zs);
      const first = zs.find((z) => z.estado === 'activo');
      if (first) this.form.patchValue({ zonaId: String(first.id) });
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    const v = this.form.value;
    this.loading.set(true);
    this.service.escanear({ token: v.token!, zonaId: +v.zonaId! }).subscribe({
      next: (res: RegistroAccesoResultado) => {
        this.loading.set(false);
        this.result.set({
          ok: true,
          persona: res.personaNombre,
          zona: res.zonaNombre,
          tipo: res.tipo,
          hora: res.hora.slice(0, 5),
        });
        this.form.controls.token.reset();
        this.scanning.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        const detail = (e as { error?: { detail?: string } })?.error?.detail;
        this.result.set({ ok: false, motivo: detail ?? 'El acceso fue rechazado.' });
        this.scanning.set(false);
      },
    });
  }
}