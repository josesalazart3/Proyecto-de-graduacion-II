// ============================================================
// SCIAD — Interceptor HTTP Mock.
//
// Intercepta solicitudes a /api/** y las sirve desde la base en
// memoria (see mock-db.ts) con una latencia simulada, emulando un
// backend REST real. En Fase 2 solo se elimina este interceptor y
// se apunta el environment a la API real — los servicios NO cambian.
// ============================================================

import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { MockDb } from './mock-db';

const MOCK_DELAY_MS = 350;

export const mockInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const db = new MockDb();
  const path = req.url.replace('/api', '').replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  const method = req.method;
  const body = (req.body ?? {}) as any;

  try {
    const data = handle(db, method, segments, body);
    return of(
      new HttpResponse({
        status: 200,
        body: data,
      }),
    ).pipe(delay(MOCK_DELAY_MS));
  } catch (err: any) {
    const status = err?.message === 'CREDENCIALES_INVALIDAS' ? 401 : 404;
    return throwError(
      () =>
        new HttpErrorResponse({
          status,
          statusText: err?.message ?? 'Mock error',
          error: { message: err?.message ?? 'Recurso no encontrado' },
        }),
    ).pipe(delay(MOCK_DELAY_MS));
  }
};

function handle(db: MockDb, method: string, s: string[], body: any): unknown {
  switch (s[0]) {
    case 'auth':
      if (method === 'POST' && s[1] === 'login') return db.login(body);
      break;

    case 'users':
      return users(db, method, s.slice(1), body);

    case 'zonas':
      return db.listZonas();

    case 'perfiles':
      return perfiles(db, method, s.slice(1), body);

    case 'credenciales':
      return credenciales(db, method, s.slice(1), body);

    case 'accesos':
      return accesos(db, method, s.slice(1), body);

    case 'notificaciones':
      return notificaciones(db, method, s.slice(1), body);

    case 'auditoria':
      return auditoria(db, method, s.slice(1), body);

    case 'dashboard':
      return dashboard(db);

    default:
      throw new Error('NOT_FOUND');
  }
  throw new Error('NOT_FOUND');
}

function users(db: MockDb, method: string, s: string[], body: any): unknown {
  if (method === 'GET') return db.listUsers();
  if (method === 'POST') return db.createUser(body);
  if (method === 'PUT' && s[1] === 'toggle') return db.toggleUser(s[0]);
  if (method === 'PUT') return db.updateUser(body);
  throw new Error('NOT_FOUND');
}

function perfiles(db: MockDb, method: string, s: string[], body: any): unknown {
  if (method === 'GET') return db.listPerfiles();
  if (method === 'POST') return db.createPerfil(body);
  if (method === 'PUT' && s[1] === 'toggle') return db.togglePerfil(s[0]);
  if (method === 'PUT') return db.updatePerfil(body);
  throw new Error('NOT_FOUND');
}

function credenciales(db: MockDb, method: string, s: string[], body: any): unknown {
  if (method === 'GET') return db.listCredenciales();
  if (method === 'POST') return db.generarCredencial(body);
  if (method === 'PUT' && s[1] === 'revocar') return db.revocarCredencial(s[0], body.motivo);
  if (method === 'PUT' && s[1] === 'reemitir') return db.reemitirCredencial(s[0], body.emitidaPor);
  throw new Error('NOT_FOUND');
}

function accesos(db: MockDb, method: string, s: string[], body: any): unknown {
  if (method === 'GET') return db.listRegistros();
  if (method === 'POST' && s[0] === 'escaneo') {
    return db.escanear(body.codigoQr, body.operador, body.estacion);
  }
  throw new Error('NOT_FOUND');
}

function notificaciones(db: MockDb, method: string, s: string[], body: any): unknown {
  if (method === 'GET') return db.listNotificaciones();
  if (method === 'PUT' && s[0] === 'leer-todas') {
    db.marcarTodasLeidas();
    return { ok: true };
  }
  if (method === 'PUT' && s[1] === 'leer') return db.marcarLeida(s[0]);
  throw new Error('NOT_FOUND');
}

function auditoria(db: MockDb, method: string, s: string[], body: any): unknown {
  if (method === 'GET') return db.listAuditoria();
  if (method === 'PUT' && s[1] === 'estado') return db.cambiarEstadoAuditoria(s[0], body.estado);
  throw new Error('NOT_FOUND');
}

function dashboard(db: MockDb): unknown {
  const now = Date.now();
  const todayRegs = db.registros.filter((r) => {
    const d = new Date(r.timestamp).getTime();
    return now - d < 24 * 60 * 60 * 1000;
  });
  const autorizados = todayRegs.filter((r) => r.resultado === 'AUTORIZADO').length;
  const denegados = todayRegs.filter((r) => r.resultado === 'DENEGADO').length;
  const pendientes = todayRegs.filter((r) => r.resultado === 'PENDIENTE').length;
  const personasActivas = new Set(db.registros.map((r) => r.titular)).size;
  const alertasPendientes = db.notificaciones.filter((n) => !n.leida && n.severidad === 'ALERTA').length;

  return {
    accesosHoy: todayRegs.length,
    autorizados,
    denegados,
    pendientes,
    personasActivas,
    credencialesEmitidas: db.credenciales.length,
    credencialesActivas: db.credenciales.filter((c) => c.estado === 'ACTIVA').length,
    alertasPendientes,
    zonasActivas: db.zonas.filter((z) => z.activa).length,
  };
}
