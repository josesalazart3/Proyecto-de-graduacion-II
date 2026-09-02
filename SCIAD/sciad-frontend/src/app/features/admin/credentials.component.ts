// Credenciales QR (CU-04): Fase 3 las reconcilia al backend — generar por PERSONA registrada
// (POST /credenciales/{personaId}/generar), revocar con motivo opcional, reemitir, nunca borrado.
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CredentialsService, PersonasService } from '../../core/services/crud.service';
import { Credencial } from '../../core/models/credential.model';
import { Persona, TIPO_PERSONA_LABELS } from '../../core/models/persona.model';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { Modal } from '../../shared/ui/modal.component';
import { SciInput, SciSelect } from '../../shared/ui/field.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

function badgeFor(estado: string): StatusKey {
  return estado === 'activa' ? 'activo' : 'revocado';
}

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
                  <th>Token QR</th>
                  <th class="hide-md">Emitido</th>
                  <th>Estado</th>
                  <th class="hide-lg">Motivo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of credenciales(); track c.id) {
                  <tr>
                    <td>
                      <div class="cell-strong">{{ c.personaNombre }}</div>
                      <div class="cell-muted">{{ personaTipo(c.personaId) }}</div>
                    </td>
                    <td class="cell-muted hide-sm">{{ c.dpiCodigo }}</td>
                    <td><span class="chip mono qr-token">{{ c.token }}</span></td>
                    <td class="cell-muted hide-md">{{ c.emitido }}</td>
                    <td><sci-badge [status]="badgeFor(c.estado)" /></td>
                    <td class="cell-muted hide-lg">{{ c.motivo ?? (c.estado === 'revocada' ? '—' : '') }}</td>
                    <td>
                      <div class="cell-actions">
                        @if (c.estado === 'activa') {
                          <button class="sci-btn-ghost" aria-label="Revocar" (click)="openRevoke(c)"><sci-icon name="trash" [size]="17" /></button>
                        } @else {
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

    <!-- Generar (por persona registrada) -->
    <sci-modal [open]="createOpen()" title="Generar credencial" (closed)="createOpen.set(false)">
      <form [formGroup]="createForm" (ngSubmit)="generate()" class="modal-form">
        <sci-select formControlName="personaId" label="Persona" [options]="personaOptions()" [error]="cf('personaId')" />
        <p class="modal-note">Se emitirá la primera credencial de la persona seleccionada. Si ya tiene una activa, el backend rechaza y hay que reemitir.</p>
        <div sci-modal-actions>
          <button sci-btn variant="ghost" size="md" (click)="createOpen.set(false)">Cancelar</button>
          <button sci-btn variant="primary" size="md" type="submit" [loading]="saving()">Generar</button>
        </div>
      </form>
    </sci-modal>

    <!-- Revocar -->
    <sci-modal [open]="revokeOpen()" title="Revocar credencial" (closed)="revokeOpen.set(false)">
      <form [formGroup]="revokeForm" (ngSubmit)="revoke()" class="modal-form">
        <p class="modal-note">Se revocará la credencial de <strong>{{ selected()?.personaNombre }}</strong>. Esta acción no se puede deshacer.</p>
        <sci-input formControlName="motivo" label="Motivo (opcional)" placeholder="Pérdida, extravío, baja…" [error]="rf('motivo')" />
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
        <div class="qr-code mono">{{ selected()?.token }}</div>
        <div class="qr-titular">{{ selected()?.personaNombre }}</div>
        <div class="qr-sub">{{ estatusLabel() }}</div>
      </div>
    </sci-modal>
  `,
  styles: [
    `
      .qr-token { font-family: var(--font-mono); max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
      .modal-form { display: flex; flex-direction: column; gap: 16px; }
      .modal-note { font-size: 13px; color: var(--text-muted); }
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
      .qr-code { font-size: 16px; font-weight: 700; color: var(--text); word-break: break-all; }
      .qr-titular { font-weight: 600; font-size: 15px; color: var(--text); }
      .qr-sub { font-size: 13px; color: var(--text-muted); }
    `,
  ],
})
export class CredentialsComponent implements OnInit {
  private readonly service = inject(CredentialsService);
  private readonly personasSvc = inject(PersonasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly credenciales = signal<Credencial[]>([]);
  protected readonly personasList = signal<Persona[]>([]);
  protected readonly createOpen = signal(false);
  protected readonly revokeOpen = signal(false);
  protected readonly viewOpen = signal(false);
  protected readonly selected = signal<Credencial | null>(null);

  protected readonly personaOptions = computed(() =>
    this.personasList()
      .filter((p) => p.estado === 'activo')
      .map((p) => ({ value: p.id, label: `${p.nombre} — ${TIPO_PERSONA_LABELS[p.tipo]}` })),
  );
  protected readonly createForm = this.fb.group({
    personaId: ['', Validators.required],
  });
  protected readonly revokeForm = this.fb.group({
    motivo: ['', Validators.maxLength(200)],
  });

  protected readonly badgeFor = badgeFor;

  ngOnInit(): void {
    this.load();
    this.personasSvc.list().subscribe({
      next: (ps) => this.personasList.set(ps),
      error: () => this.toast.error('Error', 'No se pudieron cargar las personas.'),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (list) => { this.credenciales.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Error', 'No se pudieron cargar las credenciales.'); },
    });
  }

  protected personaTipo(personaId: string): string {
    const p = this.personasList().find((x) => x.id === personaId);
    return p ? TIPO_PERSONA_LABELS[p.tipo] : '';
  }

  protected cf(name: string): string | null {
    const c = this.createForm.get(name);
    if (c?.touched && c.errors?.['required']) return 'Selecciona una persona.';
    return null;
  }
  protected rf(name: string): string | null {
    const c = this.revokeForm.get(name);
    if (c?.touched && c.errors?.['maxlength']) return 'El motivo no puede superar 200 caracteres.';
    return null;
  }

  protected openCreate(): void {
    if (this.personaOptions().length === 0) {
      this.toast.warning('Sin personas', 'Registra una persona primero (Colaboradores/Visitantes).');
      return;
    }
    this.createForm.reset();
    this.createForm.patchValue({ personaId: this.personaOptions()[0].value });
    this.createOpen.set(true);
  }
  protected generate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const personaId = this.createForm.value.personaId!;
    this.saving.set(true);
    this.service.generar(personaId).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.selected.set(c);
        this.viewOpen.set(true);
        this.toast.success('Credencial generada', `QR ${c.token.slice(0, 8)}… emitido.`);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error('Error', this.errorMessage(e) ?? 'No se pudo generar la credencial.');
      },
    });
  }

  protected openRevoke(c: Credencial): void {
    this.selected.set(c);
    this.revokeForm.reset();
    this.revokeOpen.set(true);
  }
  protected revoke(): void {
    const sel = this.selected();
    if (!sel) return;
    this.saving.set(true);
    this.service.revocar(sel.id, this.revokeForm.value.motivo ?? undefined).subscribe({
      next: () => {
        this.saving.set(false);
        this.revokeOpen.set(false);
        this.toast.warning('Credencial revocada', sel.personaNombre);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error('Error', this.errorMessage(e) ?? 'No se pudo revocar.');
      },
    });
  }

  protected reissue(c: Credencial): void {
    this.service.reemitir(c.id).subscribe({
      next: (updated) => {
        this.toast.success('Credencial reemitida', `Nuevo QR ${updated.token.slice(0, 8)}…`);
        this.load();
      },
      error: () => this.toast.error('Error', 'No se pudo reemitir.'),
    });
  }

  protected previewToken(c: Credencial): void {
    this.selected.set(c);
    this.viewOpen.set(true);
  }

  protected estatusLabel(): string {
    const s = this.selected()?.estado;
    return s === 'activa' ? 'Activa' : s === 'revocada' ? 'Revocada' : '';
  }

  private errorMessage(e: unknown): string | null {
    const detail = (e as { error?: { detail?: string } })?.error?.detail;
    return detail ? String(detail) : null;
  }
}