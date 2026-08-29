import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersService } from '../../core/services/crud.service';
import { Usuario, ROL_LABELS, Rol } from '../../core/models/user.model';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { Modal } from '../../shared/ui/modal.component';
import { SciInput, SciSelect } from '../../shared/ui/field.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

const ROL_OPTIONS = (Object.keys(ROL_LABELS) as Rol[]).map((r) => ({
  value: r,
  label: ROL_LABELS[r],
}));

@Component({
  selector: 'app-admin-users',
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
          <h1>Gestión de usuarios</h1>
          <p class="page-sub">Usuarios del sistema y sus roles (CU-02).</p>
        </div>
        <div class="page-actions">
          <div class="search-box">
            <sci-icon name="search" [size]="16" class="search-ic" />
            <input
              class="search-input"
              placeholder="Buscar por nombre o correo…"
              (input)="searchText.set($any($event.target).value)"
            />
          </div>
          <button sci-btn variant="primary" size="md" iconName="plus" (click)="openCreate()">
            Nuevo usuario
          </button>
        </div>
      </div>

      <sci-card>
        <div class="table-wrap">
          @if (loading()) {
            <table class="sci-table"><tbody>
              @for (i of [1,2,3,4,5]; track i) {
                <tr class="sci-skel-row">@for (c of [1,2,3,4]; track c) {<td><div class="skel"></div></td>}</tr>
              }
            </tbody></table>
          } @else if (filtered().length === 0) {
            <sci-empty-state
              icon="users"
              title="Sin usuarios"
              message="No hay usuarios que coincidan con la búsqueda. Crea uno nuevo para comenzar."
            >
              <button sci-btn variant="primary" size="sm" iconName="plus" (click)="openCreate()">Nuevo usuario</button>
            </sci-empty-state>
          } @else {
            <table class="sci-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Puesto</th>
                  <th>Rol</th>
                  <th class="hide-sm">Creación</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (u of filtered(); track u.id) {
                  <tr>
                    <td>
                      <div class="user-cell">
                        <span class="avatar">{{ u.avatarInitials }}</span>
                        <div>
                          <div class="cell-strong">{{ u.nombre }}</div>
                          <div class="cell-muted">{{ u.email }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="cell-muted">{{ u.puesto }}</td>
                    <td><sci-badge [label]="ROL_LABELS[u.rol]" [status]="badgeForRol(u.rol)" /></td>
                    <td class="cell-muted hide-sm">{{ date(u.fechaCreacion) }}</td>
                    <td><sci-badge [status]="u.activo ? 'activo' : 'inactivo'" /></td>
                    <td>
                      <div class="cell-actions">
                        <button class="sci-btn-ghost" aria-label="Editar" (click)="openEdit(u)"><sci-icon name="edit" [size]="17" /></button>
                        <button class="sci-btn-ghost" [attr.aria-label]="u.activo ? 'Desactivar' : 'Activar'" (click)="toggle(u)">
                          <sci-icon [name]="u.activo ? 'x' : 'check'" [size]="17" />
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

    <sci-modal [open]="modalOpen()" [title]="editing() ? 'Editar usuario' : 'Nuevo usuario'" (closed)="modalOpen.set(false)">
      <form [formGroup]="form" (ngSubmit)="save()" class="modal-form">
        <sci-input formControlName="nombre" label="Nombre completo" [error]="f('nombre')" />
        <sci-input formControlName="email" label="Correo electrónico" [error]="f('email')" />
        <sci-input formControlName="puesto" label="Puesto" />
        <sci-select formControlName="rol" label="Rol" [options]="rolOptions" />
        <div sci-modal-actions>
          <button sci-btn variant="ghost" size="md" (click)="modalOpen.set(false)">Cancelar</button>
          <button sci-btn variant="primary" size="md" type="submit" [loading]="saving()">
            {{ editing() ? 'Guardar' : 'Crear usuario' }}
          </button>
        </div>
      </form>
    </sci-modal>
  `,
  styles: [
    `
      .search-box {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-ic {
        position: absolute;
        left: 12px;
        color: var(--text-subtle);
        pointer-events: none;
      }
      .search-input {
        width: 260px;
        height: 40px;
        padding: 0 12px 0 38px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-strong);
        background: var(--surface);
        color: var(--text);
        font-size: 14px;
      }
      .search-input:focus {
        outline: none;
        border-color: var(--sciad-brand);
        box-shadow: 0 0 0 3px var(--sciad-brand-soft);
      }
      @media (max-width: 639px) {
        .search-input { width: 100%; }
      }
      .user-cell { display: flex; align-items: center; gap: 12px; }
      .modal-form { display: flex; flex-direction: column; gap: 16px; }
    `,
  ],
})
export class UsersComponent implements OnInit {
  private readonly service = inject(UsersService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly ROL_LABELS = ROL_LABELS;
  protected readonly rolOptions = ROL_OPTIONS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly users = signal<Usuario[]>([]);
  protected readonly searchText = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Usuario | null>(null);

  protected filtered = computed(() => {
    const q = this.searchText().toLowerCase();
    return this.users().filter(
      (u) =>
        !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  });

  protected readonly form = this.fb.group({
    id: [''],
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    puesto: ['', Validators.required],
    rol: ['ADMIN', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (list) => {
        this.users.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudieron cargar los usuarios.');
      },
    });
  }

  protected f(name: string): string | null {
    const c = this.form.get(name);
    if (c?.touched && c.errors) {
      if (c.errors['required']) return 'Campo requerido.';
      if (c.errors['email']) return 'Correo no válido.';
    }
    return null;
  }

  protected badgeForRol(r: Rol): StatusKey {
    return r === 'ADMIN' ? 'activo' : r === 'GERENCIA' ? 'pendiente' : 'inactivo';
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.form.patchValue({ rol: 'ADMIN' });
    this.modalOpen.set(true);
  }
  protected openEdit(u: Usuario): void {
    this.editing.set(u);
    this.form.patchValue({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      puesto: u.puesto,
      rol: u.rol,
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
    const payload: Usuario = {
      id: editing?.id ?? '',
      nombre: v.nombre!,
      email: v.email!,
      puesto: v.puesto!,
      rol: v.rol as Rol,
      activo: editing?.activo ?? true,
      avatarInitials: initials(v.nombre!),
      fechaCreacion: editing?.fechaCreacion ?? new Date().toISOString(),
    };
    this.saving.set(true);
    const req = editing ? this.service.update(payload) : this.service.create(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(editing ? 'Usuario actualizado' : 'Usuario creado');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Error', 'No se guardó el usuario.');
      },
    });
  }

  protected toggle(u: Usuario): void {
    this.service.toggle(u.id).subscribe({
      next: () => {
        this.toast.info(u.activo ? 'Usuario desactivado' : 'Usuario activado');
        this.load();
      },
      error: () => this.toast.error('Error', 'No se pudo cambiar el estado.'),
    });
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
