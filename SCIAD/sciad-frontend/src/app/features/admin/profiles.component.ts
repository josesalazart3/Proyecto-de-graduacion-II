import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfilesService, ZonasService } from '../../core/services/crud.service';
import { PerfilAcceso, Zona, DiaSemana, HorarioAcceso } from '../../core/models/access.model';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Card } from '../../shared/ui/card.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { Modal } from '../../shared/ui/modal.component';
import { SciInput, SciSelect } from '../../shared/ui/field.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

const DAYS: DiaSemana[] = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

function riskTone(r: Zona['nivelRiesgo']): string {
  return `risk-${r.toLowerCase()}`;
}

interface HorarioRow {
  dia: DiaSemana;
  activo: boolean;
  inicio: string;
  fin: string;
}

@Component({
  selector: 'app-admin-profiles',
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
          <h1>Perfiles de acceso</h1>
          <p class="page-sub">Configuración de acceso por zona y horario (CU-03).</p>
        </div>
        <button sci-btn variant="primary" size="md" iconName="plus" (click)="openCreate()">
          Nuevo perfil
        </button>
      </div>

      <sci-card>
        <div class="body">
          @if (loading()) {
            <div class="grid grid-cols-2">
              @for (i of [1,2,3,4]; track i) {
                <div class="skel-card"><div class="skel"></div></div>
              }
            </div>
          } @else if (perfiles().length === 0) {
            <sci-empty-state icon="id-card" title="Sin perfiles" message="Crea un perfil de acceso para comenzar.">
              <button sci-btn variant="primary" size="sm" iconName="plus" (click)="openCreate()">Nuevo perfil</button>
            </sci-empty-state>
          } @else {
            <div class="grid grid-cols-2">
              @for (p of perfiles(); track p.id) {
                <div class="profile-card">
                  <div class="pc-head">
                    <div>
                      <div class="pc-name">{{ p.nombre }}</div>
                      <div class="pc-zona">{{ zonaName(p.zonaId) }} · <span [class]="riskTone(zonaRisk(p.zonaId))">{{ zonaRisk(p.zonaId) }}</span></div>
                    </div>
                    <sci-badge [status]="p.activo ? 'activo' : 'inactivo'" />
                  </div>
                  <p class="pc-desc">{{ p.descripcion }}</p>
                  <div class="pc-meta">
                    <span class="chip"><sci-icon name="clock" [size]="14" /> {{ horariosLabel(p) }}</span>
                    <span class="chip"><sci-icon name="users" [size]="14" /> {{ p.asignaciones ?? 0 }} asignados</span>
                    @if (p.requiereAprobacion) {
                      <span class="chip"><sci-icon name="shield" [size]="14" /> Requiere aprobación</span>
                    }
                  </div>
                  <div class="pc-actions">
                    <button sci-btn variant="ghost" size="sm" iconName="edit" (click)="openEdit(p)">Editar</button>
                    <button sci-btn variant="secondary" size="sm" (click)="toggle(p)">
                      {{ p.activo ? 'Desactivar' : 'Activar' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </sci-card>
    </div>

    <sci-modal [open]="modalOpen()" [title]="editing() ? 'Editar perfil' : 'Nuevo perfil de acceso'" (closed)="modalOpen.set(false)">
      <form [formGroup]="form" (ngSubmit)="save()" class="modal-form">
        <sci-input formControlName="nombre" label="Nombre" [error]="f('nombre')" />
        <sci-select formControlName="zonaId" label="Zona" [options]="zonaOptions()" />
        <sci-input formControlName="descripcion" label="Descripción" />
        <div class="req-check">
          <input type="checkbox" id="req" formControlName="requiereAprobacion" />
          <label for="req">Requerir aprobación de gerencia</label>
        </div>
        <div class="hors">
          <div class="hors-label uppercase-label">Horarios de acceso</div>
          @for (row of horarioRows(); track row.dia) {
            <div class="hor-row">
              <label class="hor-day"><input type="checkbox" [checked]="row.activo" (change)="toggleDay($any($event.target).checked, row.dia)" /> {{ row.dia }}</label>
              <input type="time" [value]="row.inicio" (change)="setDayTime('inicio', row.dia, $any($event.target).value)" />
              <span class="hor-sep">–</span>
              <input type="time" [value]="row.fin" (change)="setDayTime('fin', row.dia, $any($event.target).value)" />
            </div>
          }
        </div>
        <div sci-modal-actions>
          <button sci-btn variant="ghost" size="md" (click)="modalOpen.set(false)">Cancelar</button>
          <button sci-btn variant="primary" size="md" type="submit" [loading]="saving()">{{ editing() ? 'Guardar' : 'Crear perfil' }}</button>
        </div>
      </form>
    </sci-modal>
  `,
  styles: [
    `
      .body { padding: 20px; }
      .skel-card { height: 140px; border-radius: 12px; background: linear-gradient(90deg, var(--surface-sunken) 25%, var(--surface-muted) 50%, var(--surface-sunken) 75%); background-size: 200% 100%; animation: prof-shimmer 1.2s infinite; }
      @keyframes prof-shimmer { to { background-position: -200% 0; } }
      .profile-card {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .pc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
      .pc-name { font-weight: 700; font-size: 15px; color: var(--text); }
      .pc-zona { font-size: 12px; color: var(--text-muted); }
      .pc-desc { font-size: 13px; color: var(--text-muted); }
      .pc-meta { display: flex; flex-wrap: wrap; gap: 8px; }
      .pc-actions { display: flex; gap: 8px; margin-top: 2px; }
      .modal-form { display: flex; flex-direction: column; gap: 16px; }
      .req-check { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text); }
      .hors { display: flex; flex-direction: column; gap: 8px; background: var(--surface-muted); padding: 12px; border-radius: var(--radius-sm); }
      .hors-label { color: var(--text-subtle); margin-bottom: 2px; }
      .hor-row { display: flex; align-items: center; gap: 8px; }
      .hor-day { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; width: 74px; color: var(--text); }
      .hor-row input[type='time'] { height: 30px; border-radius: 6px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); padding: 0 6px; font-size: 13px; }
      .hor-sep { color: var(--text-subtle); }
    `,
  ],
})
export class ProfilesComponent implements OnInit {
  private readonly service = inject(ProfilesService);
  private readonly zonas = inject(ZonasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly perfiles = signal<PerfilAcceso[]>([]);
  protected readonly zonasList = signal<Zona[]>([]);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<PerfilAcceso | null>(null);
  protected readonly horarioRows = signal<HorarioRow[]>(defaultRows());

  protected readonly zonaOptions = computed(() =>
    this.zonasList().map((z) => ({ value: z.id, label: z.nombre })),
  );
  protected readonly form = this.fb.group({
    id: [''],
    nombre: ['', Validators.required],
    zonaId: ['', Validators.required],
    descripcion: [''],
    requiereAprobacion: [false],
  });
  protected readonly riskTone = riskTone;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.list().subscribe((list) => {
      this.perfiles.set(list);
      this.loading.set(false);
    });
    this.zonas.list().subscribe((zs) => this.zonasList.set(zs));
  }

  protected f(name: string): string | null {
    const c = this.form.get(name);
    if (c?.touched && c.errors?.['required']) return 'Campo requerido.';
    return null;
  }

  protected zonaName(id: string): string {
    return this.zonasList().find((z) => z.id === id)?.nombre ?? '—';
  }
  protected zonaRisk(id: string): Zona['nivelRiesgo'] {
    return this.zonasList().find((z) => z.id === id)?.nivelRiesgo ?? 'BAJO';
  }

  protected horariosLabel(p: PerfilAcceso): string {
    if (!p.horarios?.length) return 'Sin horario';
    return p.horarios.map((h) => h.dia).join('·');
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.form.patchValue({ requiereAprobacion: false, zonaId: this.zonasList()[0]?.id ?? '' });
    this.horarioRows.set(defaultRows());
    this.modalOpen.set(true);
  }
  protected openEdit(p: PerfilAcceso): void {
    this.editing.set(p);
    this.form.patchValue({
      id: p.id,
      nombre: p.nombre,
      zonaId: p.zonaId,
      descripcion: p.descripcion,
      requiereAprobacion: p.requiereAprobacion,
    });
    this.horarioRows.set(
      DAYS.map((dia) => {
        const h = p.horarios.find((x) => x.dia === dia);
        return { dia, activo: !!h, inicio: h?.inicio ?? '07:00', fin: h?.fin ?? '18:00' };
      }),
    );
    this.modalOpen.set(true);
  }

  protected toggleDay(active: boolean, dia: DiaSemana): void {
    this.horarioRows.update((rows) => rows.map((r) => (r.dia === dia ? { ...r, activo: active } : r)));
  }
  protected setDayTime(kind: 'inicio' | 'fin', dia: DiaSemana, value: string): void {
    this.horarioRows.update((rows) => rows.map((r) => (r.dia === dia ? { ...r, [kind]: value } : r)));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const horarios: HorarioAcceso[] = this.horarioRows()
      .filter((r) => r.activo)
      .map((r) => ({ id: `${r.dia}-${Math.random().toString(36).slice(2, 6)}`, dia: r.dia, inicio: r.inicio, fin: r.fin }));
    const editing = this.editing();
    const payload: PerfilAcceso = {
      id: editing?.id ?? '',
      nombre: v.nombre!,
      zonaId: v.zonaId!,
      descripcion: v.descripcion ?? '',
      horarios,
      requiereAprobacion: !!v.requiereAprobacion,
      activo: editing?.activo ?? true,
      asignaciones: editing?.asignaciones ?? 0,
    };
    this.saving.set(true);
    const req = editing ? this.service.update(payload) : this.service.create(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(editing ? 'Perfil actualizado' : 'Perfil creado');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Error', 'No se guardó el perfil.');
      },
    });
  }

  protected toggle(p: PerfilAcceso): void {
    this.service.toggle(p.id).subscribe({
      next: () => {
        this.toast.info(p.activo ? 'Perfil desactivado' : 'Perfil activado');
        this.load();
      },
      error: () => this.toast.error('Error', 'No se pudo cambiar el estado.'),
    });
  }
}

function defaultRows(): HorarioRow[] {
  return DAYS.map((dia) => {
    const isWeekend = dia === 'SAB' || dia === 'DOM';
    return {
      dia,
      activo: !isWeekend,
      inicio: '07:00',
      fin: dia === 'SAB' ? '13:00' : '18:00',
    };
  });
}
