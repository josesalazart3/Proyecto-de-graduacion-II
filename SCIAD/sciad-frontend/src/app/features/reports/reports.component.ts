import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AccessLogService, AuditService } from '../../core/services/crud.service';
import { RegistroAcceso } from '../../core/models/access-log.model';
import { KpiCard } from '../../shared/ui/kpi-card.component';
import { Card } from '../../shared/ui/card.component';
import { Button } from '../../shared/ui/button.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';
import { AuthService } from '../../core/services/auth.service';

const RES_BADGE: Record<RegistroAcceso['resultado'], StatusKey> = {
  AUTORIZADO: 'autorizado',
  DENEGADO: 'denegado',
  PENDIENTE: 'pendiente',
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [KpiCard, Card, Button, Badge, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Reportes</h1>
          <p class="page-sub">Reporte consolidado de accesos y auditoría.</p>
        </div>
        <div class="page-actions">
          <button sci-btn variant="secondary" size="md" iconName="refresh" (click)="load()">Refrescar</button>
          <button sci-btn variant="primary" size="md" iconName="download" [disabled]="loading()" (click)="exportCsv()">Exportar CSV</button>
        </div>
      </div>

      <section class="grid grid-cols-4">
        <sci-kpi-card title="Registros totales" [value]="stats().total" icon="activity" tone="brand" [loading]="loading()" />
        <sci-kpi-card title="Autorizados" [value]="stats().autorizados" icon="checkCircle" tone="success" [loading]="loading()" />
        <sci-kpi-card title="Denegados" [value]="stats().denegados" icon="circle-x" tone="danger" [loading]="loading()" />
        <sci-kpi-card title="Inconsistencias" [value]="auditCount()" icon="alertTriangle" tone="warning" [loading]="loading()" />
      </section>

      <sci-card>
        <div class="section-head">
          <span class="section-title">Accesos por zona</span>
        </div>
        <div class="body">
          @if (loading()) {
            <div style="height:120px"></div>
          } @else {
            <div class="zone-grid">
              @for (z of byZone(); track z.zona) {
                <div class="zone-card">
                  <div class="zone-name">{{ z.zona }}</div>
                  <div class="zone-counts">
                    <span class="zc ok">{{ z.aut }}</span>
                    <span class="zc bad">{{ z.den }}</span>
                  </div>
                </div>
              } @empty {
                <p class="muted">Sin datos.</p>
              }
            </div>
          }
        </div>
      </sci-card>

      <sci-card>
        <div class="section-head">
          <span class="section-title">Detalle de accesos</span>
        </div>
        <div class="flush">
          @if (loading()) {
            <table class="sci-table"><tbody>
              @for (i of [1,2,3,4]; track i) {
                <tr class="sci-skel-row">@for (c of [1,2,3,4]; track c) {<td><div class="skel"></div></td>}</tr>
              }
            </tbody></table>
          } @else if (rows().length === 0) {
            <sci-empty-state icon="file" title="Sin registros" message="No hay accesos registrados." />
          } @else {
            <table class="sci-table">
              <thead><tr><th>Fecha</th><th>Titular</th><th>Zona</th><th>Estación</th><th>Resultado</th></tr></thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr>
                    <td class="cell-muted">{{ date(r.timestamp) }}</td>
                    <td class="cell-strong">{{ r.titular }}</td>
                    <td>{{ r.zona }}</td>
                    <td class="cell-muted">{{ r.estacion }}</td>
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
      .section-head { padding: 16px 20px; border-bottom: 1px solid var(--border); }
      .section-title { font-size: 16px; font-weight: 600; }
      .body { padding: 20px; }
      .flush { }
      .zone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
      .zone-card { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
      .zone-name { font-weight: 600; font-size: 13px; color: var(--text); }
      .zone-counts { display: flex; gap: 8px; }
      .zc { font-family: var(--font-mono); font-weight: 700; font-size: 14px; }
      .zc.ok { color: var(--sciad-success); }
      .zc.bad { color: var(--sciad-danger); }
    `,
  ],
})
export class ReportsComponent implements OnInit {
  private readonly logs = inject(AccessLogService);
  private readonly audit = inject(AuditService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly RES_BADGE = RES_BADGE;
  protected readonly loading = signal(true);
  protected readonly records = signal<RegistroAcceso[]>([]);
  protected readonly auditCount = signal(0);

  protected readonly stats = computed(() => {
    const rows = this.records();
    return {
      total: rows.length,
      autorizados: rows.filter((r) => r.resultado === 'AUTORIZADO').length,
      denegados: rows.filter((r) => r.resultado === 'DENEGADO').length,
    };
  });
  protected readonly byZone = computed(() => {
    const map = new Map<string, { aut: number; den: number }>();
    for (const r of this.records()) {
      const e = map.get(r.zona) ?? { aut: 0, den: 0 };
      if (r.resultado === 'AUTORIZADO') e.aut++;
      else if (r.resultado === 'DENEGADO') e.den++;
      map.set(r.zona, e);
    }
    return [...map.entries()].map(([zona, c]) => ({ zona, ...c }));
  });
  protected readonly rows = computed(() => {
    const rows = [...this.records()].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : -1,
    );
    return this.isManagement() && !this.isAdmin() ? rows.slice(0, 200) : rows;
  });

  ngOnInit(): void {
    this.load();
  }

  protected isAdmin(): boolean {
    return this.auth.role() === 'ADMIN';
  }
  protected isManagement(): boolean {
    return this.auth.role() === 'GERENCIA';
  }

  protected load(): void {
    this.loading.set(true);
    this.logs.list().subscribe((list) => {
      this.records.set(list);
      this.loading.set(false);
    });
    this.audit.list().subscribe((a) => this.auditCount.set(a.length));
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

  protected exportCsv(): void {
    const header = ['Fecha', 'Titular', 'Zona', 'Estacion', 'Tipo', 'Resultado', 'RegistradoPor'];
    const lines = this.records().map((r) =>
      [
        new Date(r.timestamp).toISOString(),
        r.titular,
        r.zona,
        r.estacion,
        r.tipo,
        r.resultado,
        r.registradoPor,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sciad-reporte-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.toast.success('Exportación lista', `CSV con ${this.records().length} registros.`);
  }
}
