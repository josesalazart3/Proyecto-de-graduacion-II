import { Component, inject, OnInit, signal } from '@angular/core';
import { AuditService } from '../../core/services/crud.service';
import {
  InconsistenciaAuditoria,
  HallazgoSeveridad,
  HallazgoEstado,
} from '../../core/models/audit.model';
import { Button } from '../../shared/ui/button.component';
import { Card } from '../../shared/ui/card.component';
import { Badge, StatusKey } from '../../shared/ui/badge.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

const SEV_ORDER: Record<HallazgoSeveridad, number> = {
  BAJA: 1,
  MEDIA: 2,
  ALTA: 3,
  CRITICA: 4,
};
const SEV_BADGE: Record<HallazgoSeveridad, StatusKey> = {
  BAJA: 'baja',
  MEDIA: 'media',
  ALTA: 'alta',
  CRITICA: 'critica',
};
const EST_BADGE: Record<HallazgoEstado, StatusKey> = {
  ABIERTO: 'abierto',
  EN_REVISION: 'revisando',
  RESUELTO: 'resuelto',
};

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [Button, Card, Badge, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Auditoría e integridad</h1>
          <p class="page-sub">Inconsistencias detectadas en las bitácoras (CU-08 / CU-09).</p>
        </div>
        <button sci-btn variant="secondary" size="md" iconName="refresh" (click)="load()">Re-verificar</button>
      </div>

      <sci-card>
        <div class="body">
          @if (loading()) {
            <table class="sci-table"><tbody>
              @for (i of [1,2,3]; track i) {
                <tr class="sci-skel-row">@for (c of [1,2,3,4]; track c) {<td><div class="skel"></div></td>}</tr>
              }
            </tbody></table>
          } @else if (items().length === 0) {
            <sci-empty-state icon="checkCircle" title="Sin inconsistencias" message="Todas las bitácoras verificadas sin hallazgos." />
          } @else {
            <div class="list">
              @for (a of sorted(); track a.id) {
                <div class="item">
                  <div class="item-main">
                    <div class="item-head">
                      <span class="item-type">{{ a.tipo }}</span>
                      <sci-badge [status]="SEV_BADGE[a.severidad]" />
                      <sci-badge [status]="EST_BADGE[a.estado]" />
                    </div>
                    <p class="item-desc">{{ a.descripcion }}</p>
                    <div class="item-meta">
                      @if (a.afectaBitacora && a.afectaBitacora !== '—') {
                        <span class="chip mono">{{ a.afectaBitacora }}</span>
                      }
                      <span class="muted subtle">{{ date(a.fechaDeteccion) }}</span>
                    </div>
                  </div>
                  <div class="item-actions">
                    @if (a.estado === 'ABIERTO') {
                      <button sci-btn variant="secondary" size="sm" (click)="advance(a, 'EN_REVISION')">Iniciar revisión</button>
                    }
                    @if (a.estado === 'EN_REVISION') {
                      <button sci-btn variant="primary" size="sm" iconName="check" (click)="advance(a, 'RESUELTO')">Marcar resuelto</button>
                    }
                    @if (a.estado === 'RESUELTO') {
                      <button sci-btn variant="ghost" size="sm" (click)="advance(a, 'ABIERTO')">Reabrir</button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </sci-card>
    </div>
  `,
  styles: [
    `
      .body { padding: 8px 0; }
      .list { display: flex; flex-direction: column; }
      .item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px;
        border-bottom: 1px solid var(--border);
      }
      .item:last-child { border-bottom: none; }
      .item-main { min-width: 0; }
      .item-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .item-type { font-weight: 700; font-size: 15px; color: var(--text); }
      .item-desc { font-size: 14px; color: var(--text-muted); margin-top: 6px; }
      .item-meta { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
      .item-actions { display: flex; gap: 8px; flex: none; }
      @media (max-width: 639px) {
        .item { flex-direction: column; }
      }
    `,
  ],
})
export class AuditComponent implements OnInit {
  private readonly service = inject(AuditService);
  private readonly toast = inject(ToastService);

  protected readonly SEV_BADGE = SEV_BADGE;
  protected readonly EST_BADGE = EST_BADGE;
  protected readonly loading = signal(true);
  protected readonly items = signal<InconsistenciaAuditoria[]>([]);

  protected sorted = () =>
    [...this.items()].sort((a, b) => SEV_ORDER[b.severidad] - SEV_ORDER[a.severidad]);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.toast.info('Verificación en curso', 'Analizando integridad de bitácoras…');
    this.service.list().subscribe((list) => {
      this.items.set(list);
      this.loading.set(false);
    });
  }

  protected advance(a: InconsistenciaAuditoria, estado: HallazgoEstado): void {
    this.service.cambiarEstado(a.id, estado).subscribe({
      next: () => {
        this.toast.success('Estado actualizado', a.tipo);
        this.load();
      },
      error: () => this.toast.error('Error', 'No se pudo actualizar.'),
    });
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
