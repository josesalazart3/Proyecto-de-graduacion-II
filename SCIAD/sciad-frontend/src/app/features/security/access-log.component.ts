import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AccessLogService } from '../../core/services/crud.service';
import { RegistroAcceso } from '../../core/models/access-log.model';
import { Button } from '../../shared/ui/button.component';
import { Card } from '../../shared/ui/card.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-access-log',
  standalone: true,
  imports: [Button, Card, EmptyState],
  template: `
    <div class="log">
      <div class="log-head">
        <div class="page-heading">
          <h1>Accesos del turno</h1>
          <p class="page-sub">Registros de ingreso/egreso de hoy (CU-06).</p>
        </div>
        <button sci-btn variant="ghost" size="sm" iconName="refresh" (click)="load()">Actualizar</button>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-val ok mono">{{ counts().autorizados }}</div>
          <div class="stat-lab">Autorizados</div>
        </div>
        <div class="stat">
          <div class="stat-val bad mono">{{ counts().denegados }}</div>
          <div class="stat-lab">Denegados</div>
        </div>
        <div class="stat">
          <div class="stat-val mono">{{ counts().total }}</div>
          <div class="stat-lab">Total</div>
        </div>
      </div>

      @if (loading()) {
        <div class="skels">@for (i of [1,2,3,4,5]; track i) { <div class="skel"></div> }</div>
      } @else if (rows().length === 0) {
        <sci-card><sci-empty-state icon="clock" title="Sin accesos hoy" message="Aún no hay registros de acceso registrados hoy." /></sci-card>
      } @else {
        <div class="list">
          @for (r of rows(); track r.id) {
            <div class="row" [class]="'r-' + r.resultado.toLowerCase()">
              <span class="row-dot"></span>
              <div class="row-main">
                <div class="row-title">{{ r.titular }}</div>
                <div class="row-sub">{{ r.zona }} · {{ r.estacion }}</div>
                @if (r.motivo) {
                  <div class="row-motivo">{{ r.motivo }}</div>
                }
              </div>
              <div class="row-right">
                <span class="row-type mono">{{ r.tipo === 'INGRESO' ? 'IN' : 'OUT' }}</span>
                <span class="mono">{{ time(r.timestamp) }}</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .log { max-width: 680px; margin: 0 auto; padding: 20px 16px 40px; display: flex; flex-direction: column; gap: 18px; }
      .log-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); padding: 14px; display: flex; flex-direction: column; gap: 4px; }
      .stat-val { font-size: 26px; font-weight: 700; line-height: 1; }
      .stat-val.ok { color: var(--sciad-success); }
      .stat-val.bad { color: var(--sciad-danger); }
      .stat-lab { font-size: 12px; color: var(--text-muted); }

      .skels { display: flex; flex-direction: column; gap: 10px; }
      .skel { height: 72px; border-radius: var(--radius-md); background: linear-gradient(90deg, var(--surface-sunken) 25%, var(--surface-muted) 50%, var(--surface-sunken) 75%); background-size: 200% 100%; animation: al-shimmer 1.2s infinite; }
      @keyframes al-shimmer { to { background-position: -200% 0; } }

      .list { display: flex; flex-direction: column; gap: 10px; }
      .row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-left-width: 3px;
        border-radius: var(--radius-md);
        padding: 14px;
      }
      .r-autorizado { border-left-color: var(--sciad-success); }
      .r-denegado { border-left-color: var(--sciad-danger); }
      .r-pendiente { border-left-color: var(--sciad-warning); }
      .row-dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 6px; flex: none; }
      .r-autorizado .row-dot { background: var(--sciad-success); }
      .r-denegado .row-dot { background: var(--sciad-danger); }
      .r-pendiente .row-dot { background: var(--sciad-warning); }
      .row-main { flex: 1; min-width: 0; }
      .row-title { font-weight: 600; font-size: 14px; color: var(--text); }
      .row-sub { font-size: 12px; color: var(--text-muted); }
      .row-motivo { font-size: 12px; color: var(--sciad-danger); margin-top: 2px; }
      .row-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 12px; color: var(--text-muted); }
      .row-type { font-weight: 700; font-size: 11px; }
    `,
  ],
})
export class AccessLogComponent implements OnInit {
  private readonly service = inject(AccessLogService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly records = signal<RegistroAcceso[]>([]);

  protected readonly counts = computed(() => {
    const rows = this.rows();
    return {
      total: rows.length,
      autorizados: rows.filter((r) => r.resultado === 'AUTORIZADO').length,
      denegados: rows.filter((r) => r.resultado === 'DENEGADO').length,
    };
  });
  protected readonly rows = computed(() =>
    [...this.records()]
      .filter((r) => new Date(r.timestamp).toDateString() === new Date().toDateString())
      .slice(0, 40),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (list) => {
        this.records.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudieron cargar los accesos.');
      },
    });
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
