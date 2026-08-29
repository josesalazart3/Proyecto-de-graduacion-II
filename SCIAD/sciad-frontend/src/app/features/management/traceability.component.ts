import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AccessLogService } from '../../core/services/crud.service';
import { RegistroAcceso } from '../../core/models/access-log.model';
import { Card } from '../../shared/ui/card.component';
import { Button } from '../../shared/ui/button.component';
import { Icon } from '../../shared/ui/icon.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { EmptyState } from '../../shared/ui/empty-state.component';

const RES_BADGE: Record<RegistroAcceso['resultado'], StatusKey> = {
  AUTORIZADO: 'autorizado',
  DENEGADO: 'denegado',
  PENDIENTE: 'pendiente',
};

@Component({
  selector: 'app-traceability',
  standalone: true,
  imports: [Card, Button, Icon, Badge, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Portal de trazabilidad</h1>
          <p class="page-sub">Historial de accesos filtrable por persona, zona y fecha (CU-07).</p>
        </div>
      </div>

      <div class="filters">
        <div class="filter-box">
          <sci-icon name="search" [size]="16" class="fic" />
          <input class="finput" placeholder="Buscar por persona…" (input)="persona.set($any($event.target).value)" />
        </div>
        <select class="fselect" [value]="zona()" (change)="zona.set($any($event.target).value)">
          <option value="">Todas las zonas</option>
          @for (z of zonas(); track z) {
            <option [value]="z">{{ z }}</option>
          }
        </select>
        <input class="fselect" type="date" [value]="fecha()" (change)="fecha.set($any($event.target).value)" />
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
          } @else if (filtered().length === 0) {
            <sci-empty-state icon="activity" title="Sin resultados" message="No hay accesos que coincidan con los filtros." />
          } @else {
            <table class="sci-table">
              <thead>
                <tr><th>Fecha</th><th>Persona</th><th>Zona</th><th class="hide-sm">Estación</th><th class="hide-sm">Tipo</th><th>Resultado</th></tr>
              </thead>
              <tbody>
                @for (r of filtered(); track r.id) {
                  <tr>
                    <td class="cell-muted">{{ date(r.timestamp) }}</td>
                    <td class="cell-strong">{{ r.titular }}</td>
                    <td>{{ r.zona }}</td>
                    <td class="cell-muted hide-sm">{{ r.estacion }}</td>
                    <td class="cell-mono hide-sm">{{ r.tipo }}</td>
                    <td><sci-badge [status]="RES_BADGE[r.resultado]" /></td>
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
      .filter-box { position: relative; display: flex; align-items: center; }
      .fic { position: absolute; left: 12px; color: var(--text-subtle); pointer-events: none; }
      .finput {
        width: 260px; height: 40px; padding: 0 12px 0 38px;
        border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
        background: var(--surface); color: var(--text); font-size: 14px;
      }
      .fselect {
        height: 40px; padding: 0 34px 0 12px; border-radius: var(--radius-sm);
        border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 14px;
      }
      .finput:focus, .fselect:focus { outline: none; border-color: var(--sciad-brand); box-shadow: 0 0 0 3px var(--sciad-brand-soft); }
      .flush { }
    `,
  ],
})
export class TraceabilityComponent implements OnInit {
  private readonly service = inject(AccessLogService);

  protected readonly RES_BADGE = RES_BADGE;
  protected readonly loading = signal(true);
  protected readonly records = signal<RegistroAcceso[]>([]);
  protected readonly persona = signal('');
  protected readonly zona = signal('');
  protected readonly fecha = signal('');

  protected readonly zonas = computed(() =>
    [...new Set(this.records().map((r) => r.zona))].filter(Boolean).sort(),
  );
  protected readonly hasFilters = computed(
    () => !!this.persona() || !!this.zona() || !!this.fecha(),
  );
  protected readonly filtered = computed(() => {
    const q = this.persona().trim().toLowerCase();
    return [...this.records()]
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .filter((r) => {
        if (q && !r.titular.toLowerCase().includes(q)) return false;
        if (this.zona() && r.zona !== this.zona()) return false;
        if (this.fecha() && new Date(r.timestamp).toISOString().slice(0, 10) !== this.fecha())
          return false;
        return true;
      });
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().subscribe((list) => {
      this.records.set(list);
      this.loading.set(false);
    });
  }

  protected clear(): void {
    this.persona.set('');
    this.zona.set('');
    this.fecha.set('');
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleString('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
