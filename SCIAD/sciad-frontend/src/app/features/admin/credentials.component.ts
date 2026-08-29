import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CredentialsService, ProfilesService } from '../../core/services/crud.service';
import { AuthService } from '../../core/services/auth.service';
import { Credencial, CredencialEstado } from '../../core/models/credential.model';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { Modal } from '../../shared/ui/modal.component';
import { SciInput, SciSelect } from '../../shared/ui/field.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

const STATE_BADGE: Record<CredencialEstado, StatusKey> = {
  ACTIVA: 'activo',
  VENCIDA: 'vencido',
  REVOCADA: 'revocado',
  PENDIENTE: 'pendiente',
};

@Component({
  selector: 'app-admin-credentials',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    Button,
    Icon,
    Card,
    Badge,
    Modal,
    SciInput,
    SciSelect,
    EmptyState,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Credenciales QR</h1>
          <p class="page-sub">Generación, reemisión y revocación de credenciales (CU-04).</p>
        </div>
        <button sci-btn variant="primary" size="md" iconName="plus" (click)="openCreate()">
          Generar credencial
        </button>
      </div>

      <sci-card>
        <div class="wrap">
          @if (loading()) {
            <table class="sci-table"><tbody>
              @for (i of [1,2,3,4,5]; track i) {
                <tr class="sci-skel-row">@for (c of [1,2,3,4,5]; track c) {<td><div class="skel"></div></td>}</tr>
              }
            </tbody></table>
          } @else if (credenciales().length === 0) {
            <sci-empty-state icon="qr" title="Sin credenciales" message="Aún no hay credenciales emitidas.">
              <button sci-btn variant="primary" size="sm" iconName="plus" (click)="openCreate()">Generar primera</button>
            </sci-empty-state>
          } @else {
            <table class="sci-table">
              <thead>
                <tr>
                  <th>Titular</th>
                  <th class="hide-sm">Documento</th>
                  <th>Perfil / Zona</th>
                  <th>Código QR</th>
                  <th class="hide-md">Vence</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of credenciales(); track c.id) {
                  <tr>
                    <td>
                      <div class="cell-strong">{{ c.titular }}</div>
                      <div class="cell-muted">{{ c.emitidaPor }} · {{ date(c.emitidaEn) }}</div>
                    </td>
                    <td class="cell-muted hide-sm">{{ c.documento }}</td>
                    <td>
                      <div class="cell-strong">{{ c.perfilNombre }}</div>
                    </td>
                    <td>
                      <span class="chip mono qr-token">{{ c.codigoQr }}</span>
                    </td>
                    <td class="cell-muted hide-md">{{ date(c.venceEn) }}</td>
                    <td><sci-badge [status]="STATE_BADGE[c.estado]" /></td>
                    <td>
                      <div class="cell-actions">
                        @if (c.estado === 'ACTIVA') {
                          <button class="sci-btn-ghost" aria-label="Revocar" (click)="openRevoke(c)"><sci-icon name="trash" [size]="17" /></button>
                        } @else if (c.estado === 'REVOCADA' || c.estado === 'VENCIDA') {
                          <button class="sci-btn-ghost" aria-label="Reemitir" (click)="reissue(c)"><sci-icon name="refresh" [size]="17" /></button>
                        }
                        <button class="sci-btn-ghost" aria-label="Ver" (click)="previewToken(c)"><sci-icon name="eye" [size]="17" /></button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </sci-card>
    </div>

    <!-- Generar -->
    <sci-modal [open]="createOpen()" title="Generar credencial" (closed)="createOpen.set(false)">
      <form [formGroup]="createForm" (ngSubmit)="generate()" class="modal-form">
        <sci-input formControlName="titular" label="Nombre del titular" [error]="cf('titular')" />
        <sci-input formControlName="documento" label="Documento (DPI / Pasaporte)" [error]="cf('documento')" />
        <sci-select formControlName="zonaIdPerfil" label="Perfil de acceso" [options]="profileOptions()" />
        <div sci-modal-actions>
          <button sci-btn variant="ghost" size="md" (click)="createOpen.set(false)">Cancelar</button>
          <button sci-btn variant="primary" size="md" type="submit" [loading]="saving()">Generar</button>
        </div>
      </form>
    </sci-modal>

    <!-- Revocar -->
    <sci-modal [open]="revokeOpen()" title="Revocar credencial" (closed)="revokeOpen.set(false)">
      <form [formGroup]="revokeForm" (ngSubmit)="revoke()" class="modal-form">
        <p class="modal-note">Se revocará la credencial de <strong>{{ selected()?.titular }}</strong>. Esta acción no se puede deshacer.</p>
        <sci-input formControlName="motivo" label="Motivo de revocación" placeholder="Pérdida, extravío, baja…" [error]="rf('motivo')" />
        <div sci-modal-actions>
          <button sci-btn variant="ghost" size="md" (click)="revokeOpen.set(false)">Cancelar</button>
          <button sci-btn variant="danger" size="md" type="submit" [loading]="saving()">Revocar</button>
        </div>
      </form>
    </sci-modal>

    <!-- Ver QR -->
    <sci-modal [open]="viewOpen()" title="Credencial QR" (closed)="viewOpen.set(false)">
      <div class="qr-view">
        <div class="qr-box"><sci-icon name="qr" [size]="120" /></div>
        <div class="qr-code mono">{{ selected()?.codigoQr }}</div>
        <div class="qr-titular">{{ selected()?.titular }}</div>
        <div class="qr-sub">{{ selected()?.perfilNombre }} · {{ stateLabel() }}</div>
      </div>
    </sci-modal>
  `,
  styles: [
    `
      .wrap { }
      .qr-token { font-family: var(--font-mono); }
      .modal-form { display: flex; flex-direction: column; gap: 16px; }
      .modal-note { font-size: 14px; color: var(--text-muted); }
      .qr-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 8px;
        text-align: center;
      }
      .qr-box {
        padding: 16px;
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius-md);
        background: var(--surface);
        color: var(--text);
      }
      .qr-code { font-size: 18px; font-weight: 700; color: var(--text); }
      .qr-titular { font-weight: 600; font-size: 15px; color: var(--text); }
      .qr-sub { font-size: 13px; color: var(--text-muted); }
    `,
  ],
})
export class CredentialsComponent implements OnInit {
  private readonly service = inject(CredentialsService);
  private readonly profiles = inject(ProfilesService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly STATE_BADGE = STATE_BADGE;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly credenciales = signal<Credencial[]>([]);
  protected readonly profilesList = signal<{ id: string; nombre: string }[]>([]);
  protected readonly createOpen = signal(false);
  protected readonly revokeOpen = signal(false);
  protected readonly viewOpen = signal(false);
  protected readonly selected = signal<Credencial | null>(null);

  protected readonly profileOptions = computed(() =>
    this.profilesList().map((p) => ({ value: p.id, label: p.nombre })),
  );
  protected readonly createForm = this.fb.group({
    titular: ['', Validators.required],
    documento: ['', Validators.required],
    zonaIdPerfil: ['', Validators.required],
  });
  protected readonly revokeForm = this.fb.group({
    motivo: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
    this.profiles.list().subscribe((ps) => this.profilesList.set(ps));
  }

  private load(): void {
    this.loading.set(true);
    this.service.list().subscribe((list) => {
      this.credenciales.set(list);
      this.loading.set(false);
    });
  }

  protected cf(name: string): string | null {
    const c = this.createForm.get(name);
    if (c?.touched && c.errors?.['required']) return 'Campo requerido.';
    return null;
  }
  protected rf(name: string): string | null {
    const c = this.revokeForm.get(name);
    if (c?.touched && c.errors?.['required']) return 'Indica un motivo.';
    return null;
  }

  protected openCreate(): void {
    this.createForm.reset();
    this.createForm.patchValue({ zonaIdPerfil: this.profilesList()[0]?.id ?? '' });
    this.createOpen.set(true);
  }
  protected generate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const v = this.createForm.value;
    this.saving.set(true);
    this.service
      .generar({
        titular: v.titular!,
        documento: v.documento!,
        zonaIdPerfil: v.zonaIdPerfil!,
        emitidaPor: this.auth.currentUserName(),
      })
      .subscribe({
        next: (c) => {
          this.saving.set(false);
          this.createOpen.set(false);
          this.selected.set(c);
          this.viewOpen.set(true);
          this.toast.success('Credencial generada', `QR ${c.codigoQr} emitido.`);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('Error', 'No se pudo generar la credencial.');
        },
      });
  }

  protected openRevoke(c: Credencial): void {
    this.selected.set(c);
    this.revokeForm.reset();
    this.revokeOpen.set(true);
  }
  protected revoke(): void {
    if (this.revokeForm.invalid) {
      this.revokeForm.markAllAsTouched();
      return;
    }
    const sel = this.selected();
    if (!sel) return;
    this.saving.set(true);
    this.service.revocar(sel.id, this.revokeForm.value.motivo!).subscribe({
      next: () => {
        this.saving.set(false);
        this.revokeOpen.set(false);
        this.toast.warning('Credencial revocada', sel.titular);
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Error', 'No se pudo revocar.');
      },
    });
  }

  protected reissue(c: Credencial): void {
    this.service.reemitir(c.id, this.auth.currentUserName()).subscribe({
      next: (updated) => {
        this.toast.success('Credencial reemitida', `Nuevo QR ${updated.codigoQr}`);
        this.load();
      },
      error: () => this.toast.error('Error', 'No se pudo reemitir.'),
    });
  }

  protected previewToken(c: Credencial): void {
    this.selected.set(c);
    this.viewOpen.set(true);
  }

  protected stateLabel(): string {
    const s = this.selected()?.estado;
    return s ? STATE_BADGE[s].toUpperCase() : '';
  }
  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
