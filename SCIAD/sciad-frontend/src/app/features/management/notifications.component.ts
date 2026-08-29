import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NotificationsService } from '../../core/services/crud.service';
import { Notificacion, ANOMALIA_LABELS } from '../../core/models/access-log.model';
import { Card } from '../../shared/ui/card.component';
import { Button } from '../../shared/ui/button.component';
import { Icon, IconName } from '../../shared/ui/icon.component';
import { EmptyState } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

const SEV_ICON: Record<Notificacion['severidad'], IconName> = {
  INFO: 'info',
  WARNING: 'alertTriangle',
  ALERTA: 'alertTriangle',
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [Card, Button, Icon, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-heading">
          <h1>Notificaciones</h1>
          <p class="page-sub">Eventos anómalos detectados automáticamente (CU-10).</p>
        </div>
        <button sci-btn variant="secondary" size="md" iconName="check" [disabled]="unread() === 0" (click)="markAll()">
          Marcar todas leídas
        </button>
      </div>

      @if (loading()) {
        <div class="skels">@for (i of [1,2,3,4]; track i) { <div class="skel"></div> }</div>
      } @else if (notifs().length === 0) {
        <sci-card><sci-empty-state icon="bell" title="Sin notificaciones" message="No hay eventos anómalos pendientes." /></sci-card>
      } @else {
        <div class="list">
          @for (n of notifs(); track n.id) {
            <div class="note" [class.unread]="!n.leida" [class]="'sev-' + n.severidad.toLowerCase()">
              <span class="note-icon"><sci-icon [name]="SEV_ICON[n.severidad]" [size]="20" /></span>
              <div class="note-main">
                <div class="note-head">
                  <span class="note-type">{{ ANOMALIA_LABELS[n.tipo] }}</span>
                  @if (!n.leida) {
                    <span class="unread-dot" aria-label="No leída"></span>
                  }
                </div>
                <div class="note-msg">{{ n.mensaje }}</div>
                <div class="note-meta">
                  <span class="chip uppercase-label">{{ n.severidad }}</span>
                  <span class="muted subtle">{{ date(n.timestamp) }}</span>
                </div>
              </div>
              @if (!n.leida) {
                <button class="sci-btn-ghost" aria-label="Marcar leída" (click)="mark(n)"><sci-icon name="check" [size]="17" /></button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .skels { display: flex; flex-direction: column; gap: 10px; }
      .skel { height: 84px; border-radius: var(--radius-md); background: linear-gradient(90deg, var(--surface-sunken) 25%, var(--surface-muted) 50%, var(--surface-sunken) 75%); background-size: 200% 100%; animation: nt-shimmer 1.2s infinite; }
      @keyframes nt-shimmer { to { background-position: -200% 0; } }
      .list { display: flex; flex-direction: column; gap: 10px; }
      .note {
        display: flex; align-items: flex-start; gap: 14px;
        background: var(--surface); border: 1px solid var(--border);
        border-left-width: 3px; border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm); padding: 16px;
        transition: opacity var(--dur);
      }
      .note.unread { background: color-mix(in srgb, var(--surface) 96%, var(--sciad-warning) 4%); }
      .sev-alerta { border-left-color: var(--sciad-danger); }
      .sev-warning { border-left-color: var(--sciad-warning); }
      .sev-info { border-left-color: var(--sciad-info); }
      .sev-alerta .note-icon { color: var(--sciad-danger); }
      .sev-warning .note-icon { color: var(--sciad-warning); }
      .sev-info .note-icon { color: var(--sciad-info); }
      .note-icon { margin-top: 2px; }
      .note-main { flex: 1; min-width: 0; }
      .note-head { display: flex; align-items: center; gap: 8px; }
      .note-type { font-weight: 700; font-size: 15px; color: var(--text); }
      .unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sciad-warning); }
      .note-msg { font-size: 14px; color: var(--text-muted); margin-top: 4px; }
      .note-meta { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    `,
  ],
})
export class NotificationsComponent implements OnInit {
  private readonly service = inject(NotificationsService);
  private readonly toast = inject(ToastService);

  protected readonly ANOMALIA_LABELS = ANOMALIA_LABELS;
  protected readonly SEV_ICON = SEV_ICON;
  protected readonly loading = signal(true);
  protected readonly notifs = signal<Notificacion[]>([]);
  protected readonly unread = computed(() => this.notifs().filter((n) => !n.leida).length);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().subscribe((list) => {
      this.notifs.set(list);
      this.loading.set(false);
    });
  }

  protected mark(n: Notificacion): void {
    this.service.marcarLeida(n.id).subscribe(() => {
      this.notifs.update((list) => list.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    });
  }

  protected markAll(): void {
    this.service.marcarTodasLeidas().subscribe(() => {
      this.notifs.update((list) => list.map((x) => ({ ...x, leida: true })));
      this.toast.success('Todas leídas', 'Centro de notificaciones al día.');
    });
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleString('es-GT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
