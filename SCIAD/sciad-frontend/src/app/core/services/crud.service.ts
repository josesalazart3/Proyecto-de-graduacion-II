// Servicios de dominio. Todos usan HttpClient contra `/api/**` vía el
// interceptor mock (Fase 1). En Fase 2 solo cambia la URL base.
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario } from '../models/user.model';
import { Zona, PerfilAcceso } from '../models/access.model';
import { Credencial } from '../models/credential.model';
import {
  RegistroAcceso,
  Notificacion,
} from '../models/access-log.model';
import { InconsistenciaAuditoria, HallazgoEstado } from '../models/audit.model';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private http: HttpClient) {}
  list(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${API}/users`);
  }
  create(u: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(`${API}/users`, u);
  }
  update(u: Usuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${API}/users/${u.id}`, u);
  }
  toggle(id: string): Observable<Usuario> {
    return this.http.put<Usuario>(`${API}/users/${id}/toggle`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class ZonasService {
  constructor(private http: HttpClient) {}
  list(): Observable<Zona[]> {
    return this.http.get<Zona[]>(`${API}/zonas`);
  }
}

@Injectable({ providedIn: 'root' })
export class ProfilesService {
  constructor(private http: HttpClient) {}
  list(): Observable<PerfilAcceso[]> {
    return this.http.get<PerfilAcceso[]>(`${API}/perfiles`);
  }
  create(p: PerfilAcceso): Observable<PerfilAcceso> {
    return this.http.post<PerfilAcceso>(`${API}/perfiles`, p);
  }
  update(p: PerfilAcceso): Observable<PerfilAcceso> {
    return this.http.put<PerfilAcceso>(`${API}/perfiles/${p.id}`, p);
  }
  toggle(id: string): Observable<PerfilAcceso> {
    return this.http.put<PerfilAcceso>(`${API}/perfiles/${id}/toggle`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class CredentialsService {
  constructor(private http: HttpClient) {}
  list(): Observable<Credencial[]> {
    return this.http.get<Credencial[]>(`${API}/credenciales`);
  }
  generar(payload: {
    titular: string;
    documento: string;
    zonaIdPerfil: string;
    emitidaPor: string;
  }): Observable<Credencial> {
    return this.http.post<Credencial>(`${API}/credenciales`, payload);
  }
  revocar(id: string, motivo: string): Observable<Credencial> {
    return this.http.put<Credencial>(`${API}/credenciales/${id}/revocar`, { motivo });
  }
  reemitir(id: string, emitidaPor: string): Observable<Credencial> {
    return this.http.put<Credencial>(`${API}/credenciales/${id}/reemitir`, { emitidaPor });
  }
}

@Injectable({ providedIn: 'root' })
export class AccessLogService {
  constructor(private http: HttpClient) {}
  list(): Observable<RegistroAcceso[]> {
    return this.http.get<RegistroAcceso[]>(`${API}/accesos`);
  }
  escanear(payload: {
    codigoQr: string;
    operador: string;
    estacion: string;
  }): Observable<RegistroAcceso> {
    return this.http.post<RegistroAcceso>(`${API}/accesos/escaneo`, payload);
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(private http: HttpClient) {}
  list(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${API}/notificaciones`);
  }
  marcarLeida(id: string): Observable<Notificacion> {
    return this.http.put<Notificacion>(`${API}/notificaciones/${id}/leer`, {});
  }
  marcarTodasLeidas(): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${API}/notificaciones/leer-todas`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private http: HttpClient) {}
  list(): Observable<InconsistenciaAuditoria[]> {
    return this.http.get<InconsistenciaAuditoria[]>(`${API}/auditoria`);
  }
  cambiarEstado(id: string, estado: HallazgoEstado): Observable<InconsistenciaAuditoria> {
    return this.http.put<InconsistenciaAuditoria>(`${API}/auditoria/${id}/estado`, { estado });
  }
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}
  get(): Observable<any> {
    return this.http.get<any>(`${API}/dashboard`);
  }
}
