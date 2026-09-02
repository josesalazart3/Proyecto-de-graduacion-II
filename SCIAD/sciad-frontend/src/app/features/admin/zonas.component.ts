// Zonas de acceso — alta/baja de zonas físicas con nivel de seguridad y riesgo.
// Fase 2B CRUD admin; reconciliado Fase 3 al contrato real (ZonaDto, CrearZonaRequest).
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ZonasService } from '../../core/services/crud.service';
import { Zona } from '../../core/models/access.model';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { Modal } from '../../shared/ui/modal.component';
import { SciInput, SciSelect } from '../../shared/ui/field.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

const NIVEL_OPTIONS = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
];

const RIESGO_OPTIONS = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
  { value: 'critico', label: 'Crítico' },
];

@Component({
  selector: 'app-admin-zonas',
  standalone: true,
  imports: [ReactiveFormsModule, Button, Icon, Card, Badge, Modal, SciInput, SciSelect, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Zonas de acceso</h1>
          <p class="page-sub">Espacios físicos controlados con nivel de seguridad y riesgo.</p>
        </div>
        <div class="page-actions">
          <div class="search-box">
            <sci-icon name="search" [size]="16" class="search-ic" />
            <input
              class="search-input"
              placeholder="Buscar zona…"
              (input)="searchText.set($any($event.target).value)"
            />
          </div>
          <button sci-btn variant="primary" size="md" iconName="plus" (click)="openCreate()">
            Nueva zona
          </button>
        </div>
      </div>

      <sci-card>
        <div class="table-wrap">
          @if (loading()) {
            <table class="sci-table"><tbody>
              @for (i of [1,2,3,4]; track i) {
                <tr class="sci-skel-row">@for (c of [1,2,3,4,5]; track c) {<td><div class="skel"></div></td>}</tr>
              }
            </tbody></table>
          } @else if (filtered().length === 0) {
            <sci-empty-state icon="building2" title="Sin zonas" message="No hay zonas que coincidan con la búsqueda.">
              <button sci-btn variant="primary" size="sm" iconName="plus" (click)="openCreate()">Nueva zona</button>
            </sci-empty-state>
          } @else {
            <table class="sci-table">
              <thead>
                <tr>
                  <th>Zona</th>
                  <th class="hide-sm">Seguridad</th>
                  <th class="hide-sm">Riesgo</th>
                  <th class="hide-md">Capacidad</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (z of filtered(); track z.id) {
                  <tr>
                    <td class="cell-strong">{{ z.nombre }}</td>
                    <td class="hide-sm"><sci-badge [label]="z.nivelSeguridad" [status]="nivelStatus(z.nivelSeguridad)" /></td>
                    <td class="hide-sm"><sci-badge [label]="z.nivelRiesgo" [status]="riesgoStatus(z.nivelRiesgo)" /></td>
                    <td class="cell-muted hide-md">{{ z.capacidad ?? '—' }}</td>
                    <td><sci-badge [status]="z.estado === 'activo' ? 'activo' : 'inactivo'" /></td>
                    <td>
                      <div class="cell-actions">
                        <button class="sci-btn-ghost" aria-label="Editar" (click)="openEdit(z)"><sci-icon name="edit" [size]="17" /></button>
                        <button class="sci-btn-ghost" [attr.aria-label]="z.estado === 'activo' ? 'Inactivar' : 'Activar'" (click)="toggle(z)">
                          <sci-icon [name]="z.estado === 'activo' ? 'x' : 'check'" [size]="17" />
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

    <sci-modal [open]="modalOpen()" [title]="editing() ? 'Editar zona' : 'Nueva zona'" (closed)="modalOpen.set(false)">
      <form [formGroup]="form" (ngSubmit)="save()" class="modal-form">
        <sci-input formControlName="nombre" label="Nombre de la zona" placeholder="Ej: Sala de servidores" [error]="f('nombre')" />
        <sci-select formControlName="nivelSeguridad" label="Nivel de seguridad" [options]="nivelOptions" />
        <sci-select formControlName="nivelRiesgo" label="Nivel de riesgo" [options]="riesgoOptions" />
        <sci-input formControlName="capacidad" label="Capacidad (opcional)" type="number" placeholder="0" [error]="f('capacidad')" />
        <div sci-modal-actions>
          <button sci-btn variant="ghost" size="md" (click)="modalOpen.set(false)">Cancelar</button>
          <button sci-btn variant="primary" size="md" type="submit" [loading]="saving()">
            {{ editing() ? 'Guardar' : 'Crear zona' }}
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
        width: 220px; height: 40px; padding: 0 12px 0 38px;
        border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
        background: var(--surface); color: var(--text); font-size: 14px;
      }
      .search-input:focus { outline: none; border-color: var(--sciad-brand); box-shadow: 0 0 0 3px var(--sciad-brand-soft); }
      @media (max-width: 639px) { .search-input { width: 100%; } }
      .modal-form { display: flex; flex-direction: column; gap: 16px; }
    `,
  ],
})
export class ZonasComponent implements OnInit {
  private readonly service = inject(ZonasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly nivelOptions = NIVEL_OPTIONS;
  protected readonly riesgoOptions = RIESGO_OPTIONS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly zonas = signal<Zona[]>([]);
  protected readonly searchText = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Zona | null>(null);

  protected readonly form = this.fb.group({
    id: [''],
    nombre: ['', Validators.required],
    nivelSeguridad: ['medio', Validators.required],
    nivelRiesgo: ['medio', Validators.required],
    capacidad: [null as number | null],
  });

  protected filtered = computed(() => {
    const q = this.searchText().toLowerCase();
    return this.zonas().filter((z) => !q || z.nombre.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (list) => { this.zonas.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Error', 'No se pudieron cargar las zonas.'); },
    });
  }

  protected nivelStatus(nivel: string): StatusKey {
    switch (nivel) {
      case 'bajo': return 'baja';
      case 'medio': return 'media';
      case 'alto': return 'alta';
      default: return 'baja';
    }
  }

  protected riesgoStatus(riesgo: string): StatusKey {
    switch (riesgo) {
      case 'bajo': return 'baja';
      case 'medio': return 'media';
      case 'alto': return 'alta';
      case 'critico': return 'critica';
      default: return 'baja';
    }
  }

  protected f(name: string): string | null {
    const c = this.form.get(name);
    if (c?.touched && c.errors?.['required']) return 'Campo requerido.';
    if (c?.touched && c.errors?.['min']) return 'Debe ser un número positivo.';
    return null;
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.form.patchValue({ nivelSeguridad: 'medio', nivelRiesgo: 'medio', capacidad: null });
    this.modalOpen.set(true);
  }

  protected openEdit(z: Zona): void {
    this.editing.set(z);
    this.form.patchValue({
      id: z.id,
      nombre: z.nombre,
      nivelSeguridad: z.nivelSeguridad,
      nivelRiesgo: z.nivelRiesgo,
      capacidad: z.capacidad ?? null,
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
    const capacidad = v.capacidad == null ? null : +v.capacidad;
    const nombre = v.nombre!;
    const nivelSeguridad = v.nivelSeguridad!;
    const nivelRiesgo = v.nivelRiesgo!;
    this.saving.set(true);
    const req = editing
      ? this.service.update({
          id: editing.id,
          nombre,
          nivelSeguridad,
          nivelRiesgo,
          capacidad,
          estado: editing.estado,
        })
      : this.service.create({ nombre, nivelSeguridad, nivelRiesgo, capacidad });
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(editing ? 'Zona actualizada' : 'Zona creada');
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error('Error', this.errorMessage(e) ?? 'No se guardó la zona.');
      },
    });
  }

  protected toggle(z: Zona): void {
    const estado = z.estado === 'activo' ? 'inactivo' : 'activo';
    this.service.setEstado(z.id, estado).subscribe({
      next: () => {
        this.toast.info(z.estado === 'activo' ? 'Zona inactivada' : 'Zona activada');
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