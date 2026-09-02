// Portal de trazabilidad (CU-07): Fase 3 lo reconcilia al backend real — GET /registros-acceso
// con filtros de servidor (personaId, zonaId, desde, hasta, tipo). Tipo real: ingreso/egreso.
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AccessLogService, PersonasService, ZonasService } from '../../core/services/crud.service';
import { RegistroHistorial } from '../../core/models/access-log.model';
import { Persona } from '../../core/models/persona.model';
import { Zona } from '../../core/models/access.model';
import { Card } from '../../shared/ui/card.component';
import { Button } from '../../shared/ui/button.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { EmptyState } from '../../shared/ui/empty-state.component';

function badgeTipo(tipo: string): StatusKey {
  return tipo === 'ingreso' ? 'activo' : 'inactivo';
}

@Component({
  selector: 'app-traceability',
  standalone: true,
  imports: [Card, Button, Badge, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Portal de trazabilidad</h1>
          <p class="page-sub">Historial de accesos filtrable por persona, zona y fecha (CU-07).</p>
        </div>
      </div>

      <div class="filters">
        <select class="fselect" [value]="personaId()" (change)="onPersona($event)">
          <option value="">Todas las personas</option>
          @for (p of personas(); track p.id) {
            <option [value]="p.id">{{ p.nombre }}</option>
          }
        </select>
        <select class="fselect" [value]="zonaId()" (change)="onZona($event)">
          <option value="">Todas las zonas</option>
          @for (z of zonas(); track z.id) {
            <option [value]="z.id">{{ z.nombre }}</option>
          }
        </select>
        <input class="fselect" type="date" [value]="fecha()" (change)="onFecha($event)" />
        @if (hasFilters()) {
          <button sci-btn variant="ghost" size="sm" iconName="x" (click)="clear()">Limpiar</button>
        }
      </div>

      <sci-card>
        <div class="flush">
          @if (loading()) {
            <table class="sci-table"><tbody>
              @for (i of [1,2,3,4,5]; track i) {
                <tr class="sci-skel-row">@for (c of [1,2,3,4,5]; track c) {<td><div class="skel"></div></td>}</tr>
              }
            </tbody></table>
          } @else if (rows().length === 0) {
            <sci-empty-state icon="activity" title="Sin resultados" message="No hay accesos que coincidan con los filtros." />
          } @else {
            <table class="sci-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th class="hide-sm">Hora</th>
                  <th>Persona</th>
                  <th>Zona</th>
                  <th class="hide-sm">Tipo</th>
                  <th class="hide-md">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr>
                    <td class="cell-muted">{{ r.fecha }}</td>
                    <td class="cell-muted hide-sm">{{ r.hora.slice(0, 5) }}</td>
                    <td class="cell-strong">{{ r.personaNombre }}</td>
                    <td>{{ r.zonaNombre }}</td>
                    <td class="hide-sm"><sci-badge [status]="badgeTipo(r.tipo)" [label]="r.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'" /></td>
                    <td class="cell-muted hide-md">{{ r.registradoPor }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </sci-card>
    </div>
  `,
  styles: [
    `
      .filters { display: flex; gap: 12px; flex-wrap: wrap; }
      .fselect {
        height: 40px; padding: 0 34px 0 12px; border-radius: var(--radius-sm);
        border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 14px;
      }
      .fselect:focus { outline: none; border-color: var(--sciad-brand); box-shadow: 0 0 0 3px var(--sciad-brand-soft); }
    `,
  ],
})
export class TraceabilityComponent implements OnInit {
  private readonly service = inject(AccessLogService);
  private readonly personasSvc = inject(PersonasService);
  private readonly zonasSvc = inject(ZonasService);

  protected readonly badgeTipo = badgeTipo;
  protected readonly loading = signal(true);
  protected readonly rows = signal<RegistroHistorial[]>([]);
  protected readonly personas = signal<Persona[]>([]);
  protected readonly zonas = signal<Zona[]>([]);
  protected readonly personaId = signal('');
  protected readonly zonaId = signal('');
  protected readonly fecha = signal('');

  protected readonly hasFilters = computed(
    () => !!this.personaId() || !!this.zonaId() || !!this.fecha(),
  );

  ngOnInit(): void {
    this.load();
    this.personasSvc.list().subscribe((ps) => this.personas.set(ps));
    this.zonasSvc.list().subscribe((zs) => this.zonas.set(zs));
  }

  protected load(): void {
    this.loading.set(true);
    this.service
      .historial({
        personaId: this.personaId() ? +this.personaId() : undefined,
        zonaId: this.zonaId() ? +this.zonaId() : undefined,
        desde: this.fecha() ? this.fecha() : undefined,
        hasta: this.fecha() ? this.fecha() : undefined,
      })
      .subscribe({
        next: (list) => {
          this.rows.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected onPersona(e: Event): void {
    this.personaId.set((e.target as HTMLSelectElement).value);
    this.load();
  }
  protected onZona(e: Event): void {
    this.zonaId.set((e.target as HTMLSelectElement).value);
    this.load();
  }
  protected onFecha(e: Event): void {
    this.fecha.set((e.target as HTMLInputElement).value);
    this.load();
  }

  protected clear(): void {
    this.personaId.set('');
    this.zonaId.set('');
    this.fecha.set('');
    this.load();
  }
}