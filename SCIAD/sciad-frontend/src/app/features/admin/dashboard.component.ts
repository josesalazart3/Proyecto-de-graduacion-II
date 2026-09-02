// Panel de control: Fase 3 lo reconcilia al backend real. Los KPI se componen en el cliente
// (decisión aprobada en INTEGRACION_FASE3_PLAN.md §5.3): históricos de hoy, personas activas,
// notificaciones no leídas y credenciales emitidas. No existe endpoint "dashboard" en el backend.
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AccessLogService,
  CredentialsService,
  NotificationsService,
  PersonasService,
} from '../../core/services/crud.service';
import { RegistroHistorial } from '../../core/models/access-log.model';
import { KpiCard } from '../../shared/ui/kpi-card.component';
import { Card } from '../../shared/ui/card.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [KpiCard, Card, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Panel de control</h1>
          <p class="page-sub">Resumen de la operación de accesos de hoy.</p>
        </div>
      </div>

      <section class="grid grid-cols-4">
        <sci-kpi-card title="Accesos hoy" [value]="accesosHoy()" icon="activity" tone="brand" [loading]="loading()" />
        <sci-kpi-card title="Personas activas" [value]="personasActivas()" icon="users" tone="info" [loading]="loading()" />
        <sci-kpi-card title="Alertas pendientes" [value]="alertasPendientes()" icon="bell" tone="danger" [loading]="loading()" />
        <sci-kpi-card title="Credenciales emitidas" [value]="credencialesEmitidas()" icon="qr" tone="success" [loading]="loading()" />
      </section>

      <section class="grid grid-cols-3">
        <sci-card class="col-span-2">
          <div class="section-head">
            <span class="section-title">Actividad reciente</span>
            <a routerLink="/traza" class="ghost-link">Ver trazabilidad</a>
          </div>
          <div class="section-body--flush">
            @if (loading()) {
              @for (i of [1,2,3,4]; track i) {
                <div class="skel-row"><div class="skel"></div></div>
              }
            } @else {
              <div class="event-list">
                @for (ev of events(); track ev.id) {
                  <div class="event">
                    <span class="event-dot" [class]="'t-' + ev.tipo"></span>
                    <div class="event-main">
                      <div class="event-title">
                        {{ ev.personaNombre }}
                        <span class="event-tag" [class]="'t-' + ev.tipo">
                          {{ ev.tipo === 'ingreso' ? 'Ingreso' : 'Egreso' }}
                        </span>
                      </div>
                      <div class="event-sub">{{ ev.zonaNombre }} · {{ ev.hora.slice(0, 5) }}</div>
                    </div>
                  </div>
                } @empty {
                  <div class="event-empty">Sin actividad registrada hoy.</div>
                }
              </div>
            }
          </div>
        </sci-card>

        <sci-card>
          <div class="section-head">
            <span class="section-title">Alertas recientes</span>
          </div>
          <div class="section-body">
            @for (n of alerts(); track n.id) {
              <div class="alert">
                <span class="alert-dot"></span>
                <div>
                  <div class="alert-title">{{ n.personaNombre ?? 'Sistema' }}</div>
                  <div class="alert-sub">{{ n.mensaje }}</div>
                  <div class="alert-when">{{ time(n.fecha) }}</div>
                </div>
              </div>
            } @empty {
              <p class="muted">No hay alertas pendientes.</p>
            }
            <a routerLink="/admin/auditoria" class="ghost-link">Ir a auditoría</a>
          </div>
        </sci-card>
      </section>
    </div>
  `,
  styles: [
    `
      .col-span-2 { grid-column: span 2; }
      @media (max-width: 1023px) { .col-span-2 { grid-column: span 2; } }
      @media (max-width: 639px) { .col-span-2 { grid-column: span 1; } }
      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
      }
      .section-title { font-size: 16px; font-weight: 600; }
      .ghost-link { font-size: 13px; color: var(--sciad-brand); text-decoration: none; font-weight: 600; }
      .section-body--flush { padding: 4px 0; }
      .section-body {
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .event-list { display: flex; flex-direction: column; }
      .event {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        border-bottom: 1px solid var(--border);
      }
      .event:last-child { border-bottom: none; }
      .event-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--text-subtle); }
      .t-ingreso { background: var(--sciad-success); }
      .t-egreso { background: var(--sciad-info); }
      .event-tag {
        display: inline-block;
        font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
        margin-left: 8px;
      }
      .event-main { min-width: 0; }
      .event-title { font-weight: 600; font-size: 14px; color: var(--text); }
      .event-sub { font-size: 12px; color: var(--text-subtle); }
      .event-empty { padding: 24px; color: var(--text-muted); text-align: center; font-size: 14px; }
      .skel-row { padding: 16px 20px; border-bottom: 1px solid var(--border); }
      .skel {
        height: 34px; border-radius: 6px;
        background: linear-gradient(90deg, var(--surface-sunken) 25%, var(--surface-muted) 50%, var(--surface-sunken) 75%);
        background-size: 200% 100%; animation: dash-shimmer 1.2s infinite;
      }
      @keyframes dash-shimmer { to { background-position: -200% 0; } }
      .alert { display: flex; gap: 10px; align-items: flex-start; }
      .alert-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex: none; background: var(--sciad-danger); }
      .alert-title { font-weight: 600; font-size: 13px; color: var(--text); }
      .alert-sub { font-size: 12px; color: var(--text-muted); }
      .alert-when { font-size: 11px; color: var(--text-subtle); margin-top: 2px; }
      .section-body a.ghost-link { align-self: flex-start; }
    `,
  ],
})
export class AdminDashboardComponent implements OnInit {
  private readonly logs = inject(AccessLogService);
  private readonly personasSvc = inject(PersonasService);
  private readonly cred = inject(CredentialsService);
  private readonly notif = inject(NotificationsService);

  protected readonly loading = signal(true);
  protected readonly accesosHoy = signal('—');
  protected readonly personasActivas = signal('—');
  protected readonly alertasPendientes = signal('—');
  protected readonly credencialesEmitidas = signal('—');
  protected readonly events = signal<RegistroHistorial[]>([]);
  protected readonly alerts = signal<{ id: string; personaNombre?: string; mensaje: string; fecha: string }[]>([]);

  ngOnInit(): void {
    const hoy = new Date().toISOString().slice(0, 10);
    const done = () => {
      if (
        this.accesosHoy() !== '—' &&
        this.personasActivas() !== '—' &&
        this.alertasPendientes() !== '—' &&
        this.credencialesEmitidas() !== '—'
      ) {
        this.loading.set(false);
      }
    };

    this.logs.historial({ desde: hoy, hasta: hoy }).subscribe((list) => {
      const rows = list.sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? 1 : -1));
      this.accesosHoy.set(String(rows.length));
      this.events.set(rows.slice(0, 6));
      done();
    });
    this.personasSvc.list().subscribe((ps) => {
      this.personasActivas.set(String(ps.filter((p) => p.estado === 'activo').length));
      done();
    });
    this.cred.list().subscribe((cs) => {
      this.credencialesEmitidas.set(String(cs.length));
      done();
    });
    this.notif.list().subscribe((ns) => {
      const noLeidas = ns.filter((n) => !n.leida);
      this.alertasPendientes.set(String(noLeidas.length));
      this.alerts.set(
        noLeidas.slice(0, 4).map((n) => ({
          id: n.id,
          personaNombre: n.personaNombre ?? undefined,
          mensaje: n.mensaje,
          fecha: n.fecha,
        })),
      );
      done();
    });
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleString('es-GT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}