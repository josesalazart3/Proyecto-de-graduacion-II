import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/crud.service';
import { AccessLogService } from '../../core/services/crud.service';
import { NotificationsService } from '../../core/services/crud.service';
import { RegistroAcceso, ResultadoAcceso } from '../../core/models/access-log.model';
import { KpiCard } from '../../shared/ui/kpi-card.component';
import { Card } from '../../shared/ui/card.component';
import { Button } from '../../shared/ui/button.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [KpiCard, Card, Button, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Panel de control</h1>
          <p class="page-sub">Resumen de la operación de accesos de hoy.</p>
        </div>
      </div>

      <section class="grid grid-cols-4">
        <sci-kpi-card title="Accesos hoy" [value]="kpi()?.accesosHoy ?? '—'" icon="activity" tone="brand" [loading]="loading()" />
        <sci-kpi-card title="Personas activas" [value]="kpi()?.personasActivas ?? '—'" icon="users" tone="info" [loading]="loading()" />
        <sci-kpi-card title="Alertas pendientes" [value]="kpi()?.alertasPendientes ?? '—'" icon="bell" tone="danger" [loading]="loading()" />
        <sci-kpi-card title="Credenciales emitidas" [value]="kpi()?.credencialesEmitidas ?? '—'" icon="qr" tone="success" [loading]="loading()" />
      </section>

      <section class="grid grid-cols-3">
        <sci-card class="col-span-2">
          <div class="section-head">
            <span class="section-title">Actividad reciente</span>
            <button sci-btn variant="ghost" size="sm" routerLink="/admin/auditoria">Ver auditoría</button>
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
                    <span class="event-dot" [class]="'r-' + ev.resultado.toLowerCase()"></span>
                    <div class="event-main">
                      <div class="event-title">
                        {{ ev.titular }}
                        <span class="event-result" [class]="'r-' + ev.resultado.toLowerCase()">
                          {{ RESULT[ev.resultado] }}
                        </span>
                      </div>
                      <div class="event-sub">{{ ev.zona }} · {{ ev.estacion }} · {{ time(ev.timestamp) }}</div>
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
                <span class="alert-dot" [class]="'sev-' + n.severidad.toLowerCase()"></span>
                <div>
                  <div class="alert-title">{{ n.titular ?? 'Sistema' }}</div>
                  <div class="alert-sub">{{ n.mensaje }}</div>
                </div>
              </div>
            } @empty {
              <p class="muted">No hay alertas pendientes.</p>
            }
            <button sci-btn variant="ghost" size="sm" class="alert-link" routerLink="/admin/auditoria">
              Ir a auditoría
            </button>
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
      .event-dot {
        width: 9px; height: 9px; border-radius: 50%; flex: none;
        background: var(--text-subtle);
      }
      .r-autorizado { background: var(--sciad-success); }
      .r-denegado { background: var(--sciad-danger); }
      .r-pendiente { background: var(--sciad-warning); }
      .event-result {
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
      .alert-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex: none; }
      .sev-alerta { background: var(--sciad-danger); }
      .sev-warning { background: var(--sciad-warning); }
      .sev-info { background: var(--sciad-info); }
      .alert-title { font-weight: 600; font-size: 13px; color: var(--text); }
      .alert-sub { font-size: 12px; color: var(--text-muted); }
      .alert-link { align-self: flex-start; }
    `,
  ],
})
export class AdminDashboardComponent implements OnInit {
  private readonly dash = inject(DashboardService);
  private readonly logs = inject(AccessLogService);
  private readonly notif = inject(NotificationsService);

  protected readonly loading = signal(true);
  protected readonly kpi = signal<any>(null);
  protected readonly events = signal<RegistroAcceso[]>([]);
  protected readonly alerts = signal<
    { id: string; titular?: string; mensaje: string; severidad: string }[]
  >([]);
  protected readonly RESULT = { AUTORIZADO: 'Autorizado', DENEGADO: 'Denegado', PENDIENTE: 'Pendiente' };

  ngOnInit(): void {
    this.dash.get().subscribe((d) => {
      this.kpi.set(d);
      this.loading.set(false);
    });
    this.logs.list().subscribe((list) => {
      const today = new Date().toDateString();
      this.events.set(
        list
          .filter((r) => new Date(r.timestamp).toDateString() === today)
          .slice(0, 6),
      );
    });
    this.notif.list().subscribe((ns) =>
      this.alerts.set(ns.filter((n) => !n.leida).slice(0, 4)),
    );
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
