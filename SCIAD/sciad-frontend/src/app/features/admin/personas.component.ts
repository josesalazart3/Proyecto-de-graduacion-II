// Personas (Colaboradores/Visitantes) — alta/baja de personas que pueden portar credencial.
// Fase 2B CRUD admin; reconciliado Fase 3 al contrato real (tipo 1=colaborador, 2=visitante).
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PersonasService } from '../../core/services/crud.service';
import { Persona, TIPO_PERSONA_LABELS } from '../../core/models/persona.model';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';
import { Badge } from '../../shared/ui/badge.component';
import { Modal } from '../../shared/ui/modal.component';
import { SciInput, SciSelect } from '../../shared/ui/field.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

const TIPO_OPTIONS = Object.entries(TIPO_PERSONA_LABELS).map(([value, label]) => ({ value, label }));

@Component({
  selector: 'app-admin-personas',
  standalone: true,
  imports: [ReactiveFormsModule, Button, Icon, Card, Badge, Modal, SciInput, SciSelect, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Personas</h1>
          <p class="page-sub">Colaboradores y visitantes que pueden portar una credencial QR.</p>
        </div>
        <div class="page-actions">
          <div class="search-box">
            <sci-icon name="search" [size]="16" class="search-ic" />
            <input
              class="search-input"
              placeholder="Buscar por nombre o DPI…"
              (input)="searchText.set($any($event.target).value)"
            />
          </div>
          <button sci-btn variant="primary" size="md" iconName="plus" (click)="openCreate()">
            Nueva persona
          </button>
        </div>
      </div>

      <sci-card>
        <div class="table-wrap">
          @if (loading()) {
            <table class="sci-table"><tbody>
              @for (i of [1,2,3,4]; track i) {
                <tr class="sci-skel-row">@for (c of [1,2,3,4]; track c) {<td><div class="skel"></div></td>}</tr>
              }
            </tbody></table>
          } @else if (filtered().length === 0) {
            <sci-empty-state icon="users" title="Sin personas" message="No hay personas que coincidan con la búsqueda.">
              <button sci-btn variant="primary" size="sm" iconName="plus" (click)="openCreate()">Nueva persona</button>
            </sci-empty-state>
          } @else {
            <table class="sci-table">
              <thead>
                <tr><th>Persona</th><th class="hide-sm">DPI</th><th>Tipo</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                @for (p of filtered(); track p.id) {
                  <tr>
                    <td class="cell-strong">{{ p.nombre }}</td>
                    <td class="cell-mono hide-sm">{{ p.dpiCodigo }}</td>
                    <td><sci-badge [label]="TIPO_LABELS[p.tipo]" [status]="p.tipo === 1 ? 'baja' : 'pendiente'" /></td>
                    <td><sci-badge [status]="p.estado === 'activo' ? 'activo' : 'inactivo'" /></td>
                    <td>
                      <div class="cell-actions">
                        <button class="sci-btn-ghost" aria-label="Editar" (click)="openEdit(p)"><sci-icon name="edit" [size]="17" /></button>
                        <button class="sci-btn-ghost" [attr.aria-label]="p.estado === 'activo' ? 'Inactivar' : 'Activar'" (click)="toggle(p)">
                          <sci-icon [name]="p.estado === 'activo' ? 'x' : 'check'" [size]="17" />
                        </button>
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

    <sci-modal [open]="modalOpen()" [title]="editing() ? 'Editar persona' : 'Nueva persona'" (closed)="modalOpen.set(false)">
      <form [formGroup]="form" (ngSubmit)="save()" class="modal-form">
        <sci-input formControlName="nombre" label="Nombre completo" [error]="f('nombre')" />
        <sci-input formControlName="dpiCodigo" label="Código DPI" placeholder="0000-00000-0000" [error]="f('dpiCodigo')" />
        <sci-select formControlName="tipo" label="Tipo" [options]="tipoOptions" />
        <div sci-modal-actions>
          <button sci-btn variant="ghost" size="md" (click)="modalOpen.set(false)">Cancelar</button>
          <button sci-btn variant="primary" size="md" type="submit" [loading]="saving()">
            {{ editing() ? 'Guardar' : 'Crear persona' }}
          </button>
        </div>
      </form>
    </sci-modal>
  `,
  styles: [
    `
      .search-box { position: relative; display: flex; align-items: center; }
      .search-ic { position: absolute; left: 12px; color: var(--text-subtle); pointer-events: none; }
      .search-input {
        width: 260px; height: 40px; padding: 0 12px 0 38px;
        border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
        background: var(--surface); color: var(--text); font-size: 14px;
      }
      .search-input:focus { outline: none; border-color: var(--sciad-brand); box-shadow: 0 0 0 3px var(--sciad-brand-soft); }
      @media (max-width: 639px) { .search-input { width: 100%; } }
      .modal-form { display: flex; flex-direction: column; gap: 16px; }
    `,
  ],
})
export class PersonasComponent implements OnInit {
  private readonly service = inject(PersonasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly TIPO_LABELS = TIPO_PERSONA_LABELS;
  protected readonly tipoOptions = TIPO_OPTIONS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly personas = signal<Persona[]>([]);
  protected readonly searchText = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Persona | null>(null);

  protected readonly form = this.fb.group({
    id: [''],
    nombre: ['', Validators.required],
    dpiCodigo: ['', Validators.required],
    tipo: ['1', Validators.required],
  });

  protected filtered = computed(() => {
    const q = this.searchText().toLowerCase();
    return this.personas().filter(
      (p) => !q || p.nombre.toLowerCase().includes(q) || p.dpiCodigo.toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (list) => { this.personas.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Error', 'No se pudieron cargar las personas.'); },
    });
  }

  protected f(name: string): string | null {
    const c = this.form.get(name);
    if (c?.touched && c.errors?.['required']) return 'Campo requerido.';
    return null;
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.form.patchValue({ tipo: '1' });
    this.modalOpen.set(true);
  }
  protected openEdit(p: Persona): void {
    this.editing.set(p);
    this.form.patchValue({
      id: p.id,
      nombre: p.nombre,
      dpiCodigo: p.dpiCodigo,
      tipo: String(p.tipo),
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const editing = this.editing();
    const payload = { nombre: v.nombre!, dpiCodigo: v.dpiCodigo!, tipo: +v.tipo! as 1 | 2 };
    this.saving.set(true);
    const req = editing ? this.service.update({ id: editing.id, ...payload, estado: editing.estado }) : this.service.create(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(editing ? 'Persona actualizada' : 'Persona creada');
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error('Error', this.errorMessage(e) ?? 'No se guardó la persona.');
      },
    });
  }

  protected toggle(p: Persona): void {
    const estado = p.estado === 'activo' ? 'inactivo' : 'activo';
    this.service.setEstado(p.id, estado).subscribe({
      next: () => {
        this.toast.info(p.estado === 'activo' ? 'Persona inactivada' : 'Persona activada');
        this.load();
      },
      error: () => this.toast.error('Error', 'No se pudo cambiar el estado.'),
    });
  }

  private errorMessage(e: unknown): string | null {
    const detail = (e as { error?: { detail?: string } })?.error?.detail;
    return detail ? String(detail) : null;
  }
}