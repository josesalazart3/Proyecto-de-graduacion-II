// ============================================================
// SCIAD — Base de datos en memoria (mock).
//
// Datos realistas y COHERENTES entre pantallas: las mismas
// personas/zonas/credenciales se repiten donde corresponde.
// Esta clase imita un backend REST en memoria; el interceptor
// HTTP la expone detrás de /api/**. En Fase 2 se reemplaza por
// la API real sin tocar componentes.
// ============================================================

import {
  Usuario,
  Rol,
  CredencialesLogin,
} from '../models/user.model';
import { Zona, PerfilAcceso, DiaSemana } from '../models/access.model';
import {
  Credencial,
  CredencialEstado,
} from '../models/credential.model';
import {
  RegistroAcceso,
  Notificacion,
  TipoAnomalia,
  ResultadoAcceso,
  TipoRegistro,
} from '../models/access-log.model';
import {
  InconsistenciaAuditoria,
  HallazgoSeveridad,
  HallazgoEstado,
} from '../models/audit.model';

// ---------- utilidades de fecha ----------
const DAY = 24 * 60 * 60 * 1000;

function iso(d: Date): string {
  return d.toISOString();
}

/** Timestamp con minutos/horas atrás desde hoy. */
function hoursAgo(h: number, dayOffset = 0): string {
  return iso(new Date(Date.now() - h * 60 * 60 * 1000 + dayOffset * DAY));
}

/** Quita horas para forzar zona temporal local sensata. */
function localNow(): Date {
  const now = new Date();
  return now;
}

// ---------- usuarios del sistema (login) ----------
export const dbUsers: Usuario[] = [
  {
    id: 'u-admin',
    nombre: 'Lic. Marco Antonio Ortíz',
    email: 'admin@sciad.gt',
    rol: 'ADMIN',
    puesto: 'Administrador del Sistema',
    activo: true,
    avatarInitials: 'MO',
    fechaCreacion: iso(new Date(Date.now() - 300 * DAY)),
  },
  {
    id: 'u-seguridad',
    nombre: 'Carlos Gómez Rivera',
    email: 'seguridad@sciad.gt',
    rol: 'SEGURIDAD',
    puesto: 'Jefe de Seguridad — Turno Diurno',
    activo: true,
    avatarInitials: 'CG',
    fechaCreacion: iso(new Date(Date.now() - 200 * DAY)),
  },
  {
    id: 'u-gerencia',
    nombre: 'Ing. Sofía Herrera',
    email: 'gerencia@sciad.gt',
    rol: 'GERENCIA',
    puesto: 'Gerente de Operaciones y Auditoría',
    activo: true,
    avatarInitials: 'SH',
    fechaCreacion: iso(new Date(Date.now() - 400 * DAY)),
  },
  {
    id: 'u-admin2',
    nombre: 'Javier Solórzano',
    email: 'j.solorzano@sciad.gt',
    rol: 'ADMIN',
    puesto: 'Analista de Seguridad',
    activo: true,
    avatarInitials: 'JS',
    fechaCreacion: iso(new Date(Date.now() - 90 * DAY)),
  },
  {
    id: 'u-seguridad2',
    nombre: 'René Sáenz',
    email: 'r.saenz@sciad.gt',
    rol: 'SEGURIDAD',
    puesto: 'Guardia de Acceso Principal',
    activo: false,
    avatarInitials: 'RS',
    fechaCreacion: iso(new Date(Date.now() - 150 * DAY)),
  },
  {
    id: 'u-gerencia2',
    nombre: 'Dra. Paula Escobar',
    email: 'p.escobar@sciad.gt',
    rol: 'GERENCIA',
    puesto: 'Directora de Auditoría Interna',
    activo: true,
    avatarInitials: 'PE',
    fechaCreacion: iso(new Date(Date.now() - 260 * DAY)),
  },
];

// credenciales de login simuladas (idénticas para facilidad de demo)
export const dbPasswords: Record<string, string> = {
  'admin@sciad.gt': 'sciad123',
  'seguridad@sciad.gt': 'sciad123',
  'gerencia@sciad.gt': 'sciad123',
};

// ---------- zonas ----------
export const dbZonas: Zona[] = [
  {
    id: 'z-01',
    nombre: 'Oficinas Generales',
    descripcion: 'Planta 1 — áreas administrativas y recepción',
    nivelRiesgo: 'BAJO',
    capacidad: 120,
    activa: true,
  },
  {
    id: 'z-02',
    nombre: 'Centro de Cómputo',
    descripcion: 'Datacenter y sala de servidores',
    nivelRiesgo: 'CRITICO',
    capacidad: 8,
    activa: true,
  },
  {
    id: 'z-03',
    nombre: 'Bodega de Suministros',
    descripcion: 'Almacén de insumos y equipos',
    nivelRiesgo: 'MEDIO',
    capacidad: 15,
    activa: true,
  },
  {
    id: 'z-04',
    nombre: 'Archivo de Documentación',
    descripcion: 'Expedientes físicos y registros legales',
    nivelRiesgo: 'ALTO',
    capacidad: 6,
    activa: true,
  },
  {
    id: 'z-05',
    nombre: 'Planta / Área Restringida',
    descripcion: 'Operación de planta y laboratorio',
    nivelRiesgo: 'CRITICO',
    capacidad: 20,
    activa: true,
  },
];

const HORARIOS = {
  dia: (
    id: string,
    dia: DiaSemana,
    inicio: string,
    fin: string,
  ): PerfilAcceso['horarios'][number] => ({ id, dia, inicio, fin }),
};

export const dbPerfiles: PerfilAcceso[] = [
  {
    id: 'p-01',
    nombre: 'Administrativo por defecto',
    zonaId: 'z-01',
    descripcion: 'Acceso a oficinas generales en horario laboral',
    horarios: [
      HORARIOS.dia('h1', 'LUN', '07:00', '19:00'),
      HORARIOS.dia('h2', 'MAR', '07:00', '19:00'),
      HORARIOS.dia('h3', 'MIE', '07:00', '19:00'),
      HORARIOS.dia('h4', 'JUE', '07:00', '19:00'),
      HORARIOS.dia('h5', 'VIE', '07:00', '19:00'),
      HORARIOS.dia('h6', 'SAB', '08:00', '13:00'),
    ],
    requiereAprobacion: false,
    activo: true,
    asignaciones: 3,
  },
  {
    id: 'p-02',
    nombre: 'Ingeniería de Sistemas',
    zonaId: 'z-02',
    descripcion: 'Acceso al centro de cómputo bajo supervisión',
    horarios: [
      HORARIOS.dia('h7', 'LUN', '07:00', '20:00'),
      HORARIOS.dia('h8', 'MAR', '07:00', '20:00'),
      HORARIOS.dia('h9', 'MIE', '07:00', '20:00'),
      HORARIOS.dia('h10', 'JUE', '07:00', '20:00'),
      HORARIOS.dia('h11', 'VIE', '07:00', '20:00'),
    ],
    requiereAprobacion: true,
    activo: true,
    asignaciones: 2,
  },
  {
    id: 'p-03',
    nombre: 'Logística y almacén',
    zonaId: 'z-03',
    descripcion: 'Acceso a bodega para entrega y recepción',
    horarios: [
      HORARIOS.dia('h12', 'LUN', '06:00', '18:00'),
      HORARIOS.dia('h13', 'MAR', '06:00', '18:00'),
      HORARIOS.dia('h14', 'MIE', '06:00', '18:00'),
      HORARIOS.dia('h15', 'JUE', '06:00', '18:00'),
      HORARIOS.dia('h16', 'VIE', '06:00', '18:00'),
      HORARIOS.dia('h17', 'SAB', '06:00', '12:00'),
    ],
    requiereAprobacion: false,
    activo: true,
    asignaciones: 2,
  },
  {
    id: 'p-04',
    nombre: 'Auditoría documental',
    zonaId: 'z-04',
    descripcion: 'Acceso al archivo, requiere aprobación de gerencia',
    horarios: [
      HORARIOS.dia('h18', 'LUN', '08:00', '17:00'),
      HORARIOS.dia('h19', 'MAR', '08:00', '17:00'),
      HORARIOS.dia('h20', 'MIE', '08:00', '17:00'),
      HORARIOS.dia('h21', 'JUE', '08:00', '17:00'),
      HORARIOS.dia('h22', 'VIE', '08:00', '17:00'),
    ],
    requiereAprobacion: true,
    activo: true,
    asignaciones: 1,
  },
  {
    id: 'p-05',
    nombre: 'Operador de planta',
    zonaId: 'z-05',
    descripcion: 'Acceso al área de planta y laboratorio',
    horarios: [
      HORARIOS.dia('h23', 'LUN', '06:00', '22:00'),
      HORARIOS.dia('h24', 'MAR', '06:00', '22:00'),
      HORARIOS.dia('h25', 'MIE', '06:00', '22:00'),
      HORARIOS.dia('h26', 'JUE', '06:00', '22:00'),
      HORARIOS.dia('h27', 'VIE', '06:00', '22:00'),
      HORARIOS.dia('h28', 'SAB', '06:00', '18:00'),
    ],
    requiereAprobacion: true,
    activo: true,
    asignaciones: 3,
  },
];

// ---------- personas controladas (colaboradores/visitantes) ----------
interface Persona {
  id: string;
  nombre: string;
  documento: string;
  zonaIdPerfil: string;
  perfilNombre: string;
}

const PERSONAS: Persona[] = [
  { id: 'pe1', nombre: 'Ana María López', documento: 'DPI 1234-56789-0101', zonaIdPerfil: 'p-01', perfilNombre: 'Administrativo por defecto' },
  { id: 'pe2', nombre: 'Carlos Eduardo Ramírez', documento: 'DPI 2345-67890-0202', zonaIdPerfil: 'p-05', perfilNombre: 'Operador de planta' },
  { id: 'pe3', nombre: 'Luis Fernando Méndez', documento: 'DPI 3456-78901-0303', zonaIdPerfil: 'p-02', perfilNombre: 'Ingeniería de Sistemas' },
  { id: 'pe4', nombre: 'Valeria Gutiérrez', documento: 'DPI 4567-89012-0404', zonaIdPerfil: 'p-03', perfilNombre: 'Logística y almacén' },
  { id: 'pe5', nombre: 'Miguel Ángel Cruz', documento: 'DPI 5678-90123-0505', zonaIdPerfil: 'p-02', perfilNombre: 'Ingeniería de Sistemas' },
  { id: 'pe6', nombre: 'Rosa María Castillo', documento: 'DPI 6789-01234-0606', zonaIdPerfil: 'p-04', perfilNombre: 'Auditoría documental' },
  { id: 'pe7', nombre: 'Pedro Antonio Fuentes', documento: 'DPI 7890-12345-0707', zonaIdPerfil: 'p-01', perfilNombre: 'Administrativo por defecto' },
  { id: 'pe8', nombre: 'Karla Ivette Rojas', documento: 'DPI 8901-23456-0808', zonaIdPerfil: 'p-05', perfilNombre: 'Operador de planta' },
  { id: 'pe9', nombre: 'Diana Paola Soto', documento: 'DPI 9012-34567-0909', zonaIdPerfil: 'p-03', perfilNombre: 'Logística y almacén' },
  { id: 'pe10', nombre: 'Héctor Gabriel Pineda', documento: 'DPI 0123-45678-1010', zonaIdPerfil: 'p-01', perfilNombre: 'Administrativo por defecto' },
];

const QR_PREFIX = 'SC1AD-';

export const dbCredenciales: Credencial[] = PERSONAS.map((p, i) => {
  const estado: CredencialEstado = i === 4 ? 'VENCIDA' : i === 8 ? 'REVOCADA' : 'ACTIVA';
  return {
    id: `cr-${i + 1}`,
    titularId: p.id,
    titular: p.nombre,
    documento: p.documento,
    zonaIdPerfil: p.zonaIdPerfil,
    perfilNombre: p.perfilNombre,
    codigoQr: `${QR_PREFIX}${(101 + i).toString().padStart(4, '0')}`,
    estado,
    emitidaEn: iso(new Date(Date.now() - 45 * DAY)),
    venceEn: iso(new Date(Date.now() + 320 * DAY)),
    emitidaPor: 'Lic. Marco Antonio Ortíz',
  };
});

// Credenciales revocadas con motivo
dbCredenciales[8] = {
  ...dbCredenciales[8],
  motivo: 'Pérdida de documento / extravío reportado',
  emitidaEn: iso(new Date(Date.now() - 60 * DAY)),
  venceEn: iso(new Date(Date.now() - 50 * DAY)),
};

// ---------- registros de acceso ----------
const ESTACIONES = ['Acceso Principal', 'Acceso Nivel 2', 'Acceso Datacenter', 'Acceso Bodega', 'Control Planta'];

function buildRegistros(): RegistroAcceso[] {
  const rows: RegistroAcceso[] = [];
  // Hoy: una mezcla autorizado / denegado para el dashboard y pantalla de personal
  const hoy = [
    { i: 2, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 0.4, est: 'Acceso Datacenter' },
    { i: 0, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 0.8, est: 'Acceso Principal' },
    { i: 7, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 1.1, est: 'Acceso Principal' },
    { i: 1, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 1.5, est: 'Control Planta' },
    { i: 4, tipo: 'INGRESO' as TipoRegistro, res: 'DENEGADO' as ResultadoAcceso, h: 2, est: 'Acceso Datacenter', motivo: 'Credencial vencida' },
    { i: 3, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 2.4, est: 'Acceso Bodega' },
    { i: 5, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 2.9, est: 'Acceso Principal' },
    { i: 0, tipo: 'INGRESO' as TipoRegistro, res: 'DENEGADO' as ResultadoAcceso, h: 3.3, est: 'Acceso Nivel 2', motivo: 'Reintento de ingreso detectado' },
    { i: 9, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 3.8, est: 'Acceso Principal' },
    { i: 1, tipo: 'EGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 4.5, est: 'Control Planta' },
    { i: 6, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 5, est: 'Acceso Principal' },
    { i: 8, tipo: 'INGRESO' as TipoRegistro, res: 'DENEGADO' as ResultadoAcceso, h: 5.6, est: 'Acceso Bodega', motivo: 'Credencial revocada' },
    { i: 2, tipo: 'INGRESO' as TipoRegistro, res: 'AUTORIZADO' as ResultadoAcceso, h: 6.2, est: 'Acceso Datacenter' },
  ];
  for (const r of hoy) {
    const p = PERSONAS[r.i - 1] ?? PERSONAS[r.i];
    const persona = PERSONAS[r.i];
    const zona = dbZonas.find((z) => z.id === dbPerfiles.find((pf) => pf.id === persona.zonaIdPerfil)?.zonaId);
    rows.push({
      id: `ac-t${rows.length + 1}`,
      credentialId: dbCredenciales.find((c) => c.titularId === persona.id)?.id ?? 'cr-1',
      titular: persona.nombre,
      zona: zona?.nombre ?? '—',
      tipo: r.tipo,
      resultado: r.res,
      motivo: r.motivo,
      timestamp: hoursAgo(r.h, 0),
      registradoPor: 'Carlos Gómez Rivera',
      estacion: r.est,
    });
  }

  // Días previos: un par de días con eventos para el historial
  for (let d = 1; d <= 6; d++) {
    const n = 5 + (d % 4);
    for (let k = 0; k < n; k++) {
      const idx = ((d * 3 + k) % PERSONAS.length);
      const persona = PERSONAS[idx];
      const zona = dbZonas.find((z) => z.id === dbPerfiles.find((pf) => pf.id === persona.zonaIdPerfil)?.zonaId);
      const denied = k === 2;
      const tipo: TipoRegistro = k % 2 === 0 ? 'INGRESO' : 'EGRESO';
      rows.push({
        id: `ac-h${d}-${k}`,
        credentialId: dbCredenciales.find((c) => c.titularId === persona.id)?.id ?? 'cr-1',
        titular: persona.nombre,
        zona: zona?.nombre ?? '—',
        tipo,
        resultado: denied ? 'DENEGADO' : 'AUTORIZADO',
        motivo: denied ? (idx === 4 ? 'Credencial vencida' : 'Fuera de horario permitido') : undefined,
        timestamp: hoursAgo(6 + k * 0.9, d),
        registradoPor: d % 2 === 0 ? 'Carlos Gómez Rivera' : 'René Sáenz',
        estacion: ESTACIONES[(d + k) % ESTACIONES.length],
      });
    }
  }

  return rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export const dbRegistros: RegistroAcceso[] = buildRegistros();

// ---------- notificaciones ----------
export const dbNotificaciones: Notificacion[] = [
  {
    id: 'n-1',
    tipo: 'INGRESO_NO_AUTORIZADO',
    titular: 'Miguel Ángel Cruz',
    zona: 'Centro de Cómputo',
    mensaje: 'Intento de ingreso con credencial vencida en el Centro de Cómputo.',
    timestamp: hoursAgo(2),
    leida: false,
    severidad: 'ALERTA',
  },
  {
    id: 'n-2',
    tipo: 'REINTENTO_DE_INGRESO',
    titular: 'Ana María López',
    zona: 'Oficinas Generales',
    mensaje: 'Reintento de ingreso consecutivo en menos de 2 minutos.',
    timestamp: hoursAgo(3.3),
    leida: false,
    severidad: 'WARNING',
  },
  {
    id: 'n-3',
    tipo: 'CREDENCIAL_REVOCADA',
    titular: 'Diana Paola Soto',
    zona: 'Bodega de Suministros',
    mensaje: 'Se intentó usar una credencial revocada. Revisar la persona.',
    timestamp: hoursAgo(5.6),
    leida: false,
    severidad: 'ALERTA',
  },
  {
    id: 'n-4',
    tipo: 'ACCESO_FUERA_HORARIO',
    titular: 'Carlos Eduardo Ramírez',
    zona: 'Planta / Área Restringida',
    mensaje: 'Acceso registrado fuera del horario permitido del perfil.',
    timestamp: hoursAgo(26),
    leida: true,
    severidad: 'WARNING',
  },
  {
    id: 'n-5',
    tipo: 'CREDENCIAL_VENCIDA',
    titular: 'Diana Paola Soto',
    zona: 'Bodega de Suministros',
    mensaje: 'La credencial ha vencido y requiere reemisión.',
    timestamp: hoursAgo(50),
    leida: true,
    severidad: 'INFO',
  },
];

// ---------- inconistencias de auditoría ----------
export const dbAuditoria: InconsistenciaAuditoria[] = [
  {
    id: 'a-1',
    tipo: 'Desincronización de bitácora',
    descripcion: 'Bitácora de ingreso presenta un salto de ~14 min entre registros consecutivos sin evento de egreso.',
    severidad: 'MEDIA',
    estado: 'ABIERTO',
    fechaDeteccion: hoursAgo(30),
    afectaBitacora: 'BLC-88231',
  },
  {
    id: 'a-2',
    tipo: 'Registro sin titular asociado',
    descripcion: 'Existe un registro de acceso sin credencial válida vinculada en el punto de acceso Datacenter.',
    severidad: 'ALTA',
    estado: 'EN_REVISION',
    fechaDeteccion: hoursAgo(26),
    afectaBitacora: 'BLC-88240',
  },
  {
    id: 'a-3',
    tipo: 'Integridad de hash comprometida',
    descripcion: 'El hash de encadenamiento de la bitácora no coincide con el bloque anterior (posible manipulación).',
    severidad: 'CRITICA',
    estado: 'ABIERTO',
    fechaDeteccion: hoursAgo(50),
    afectaBitacora: 'BLC-88199',
  },
  {
    id: 'a-4',
    tipo: 'Duplicidad de credencial',
    descripcion: 'Se detectaron dos credenciales activas con el mismo documento de identidad.',
    severidad: 'MEDIA',
    estado: 'RESUELTO',
    fechaDeteccion: hoursAgo(120),
    afectaBitacora: '—',
  },
  {
    id: 'a-5',
    tipo: 'Acceso no autorizado',
    descripcion: 'Evento de acceso denegado marcado como resuelto sin que se revise el antecedente de la persona.',
    severidad: 'BAJA',
    estado: 'ABIERTO',
    fechaDeteccion: hoursAgo(20),
    afectaBitacora: 'BLC-88252',
  },
];

// ---------- fábrica / API ----------
export class MockDb {
  usuarios = structuredClone(dbUsers);
  zonas = structuredClone(dbZonas);
  perfiles = structuredClone(dbPerfiles);
  credenciales = structuredClone(dbCredenciales);
  registros = structuredClone(dbRegistros);
  notificaciones = structuredClone(dbNotificaciones);
  auditoria = structuredClone(dbAuditoria);

  private uid(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // --- autenticación ---
  login(c: CredencialesLogin): { user: Usuario; token: string } {
    const user = this.usuarios.find(
      (u) => u.email.toLowerCase() === c.email.toLowerCase() && u.activo,
    );
    if (!user || dbPasswords[c.email] !== c.password) {
      throw new Error('CREDENCIALES_INVALIDAS');
    }
    return { user: structuredClone(user), token: `mock-token-${user.id}` };
  }

  // --- usuarios ---
  listUsers(): Usuario[] {
    return structuredClone(this.usuarios);
  }
  createUser(u: Usuario): Usuario {
    const created: Usuario = { ...u, id: this.uid('u'), fechaCreacion: iso(localNow()) };
    this.usuarios.unshift(created);
    return structuredClone(created);
  }
  updateUser(u: Usuario): Usuario {
    const idx = this.usuarios.findIndex((x) => x.id === u.id);
    if (idx === -1) throw new Error('NOT_FOUND');
    this.usuarios[idx] = { ...this.usuarios[idx], ...u };
    return structuredClone(this.usuarios[idx]);
  }
  toggleUser(id: string): Usuario {
    const idx = this.usuarios.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error('NOT_FOUND');
    this.usuarios[idx] = { ...this.usuarios[idx], activo: !this.usuarios[idx].activo };
    return structuredClone(this.usuarios[idx]);
  }

  // --- zonas / perfiles ---
  listZonas(): Zona[] {
    return structuredClone(this.zonas);
  }
  listPerfiles(): PerfilAcceso[] {
    return structuredClone(this.perfiles);
  }
  createPerfil(p: PerfilAcceso): PerfilAcceso {
    const created: PerfilAcceso = {
      ...p,
      id: this.uid('p'),
      horarios: p.horarios ?? [],
      asignaciones: 0,
    };
    this.perfiles.push(created);
    return structuredClone(created);
  }
  updatePerfil(p: PerfilAcceso): PerfilAcceso {
    const idx = this.perfiles.findIndex((x) => x.id === p.id);
    if (idx === -1) throw new Error('NOT_FOUND');
    const merged = { ...this.perfiles[idx], ...p, asignaciones: this.perfiles[idx].asignaciones };
    this.perfiles[idx] = merged;
    return structuredClone(merged);
  }
  togglePerfil(id: string): PerfilAcceso {
    const idx = this.perfiles.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error('NOT_FOUND');
    this.perfiles[idx] = { ...this.perfiles[idx], activo: !this.perfiles[idx].activo };
    return structuredClone(this.perfiles[idx]);
  }

  // --- credenciales ---
  listCredenciales(): Credencial[] {
    return structuredClone(this.credenciales);
  }
  generarCredencial(c: {
    titular: string;
    documento: string;
    zonaIdPerfil: string;
    emitidaPor: string;
  }): Credencial {
    const perfil = this.perfiles.find((p) => p.id === c.zonaIdPerfil);
    const cred: Credencial = {
      id: this.uid('cr'),
      titularId: this.uid('pe'),
      titular: c.titular,
      documento: c.documento,
      zonaIdPerfil: c.zonaIdPerfil,
      perfilNombre: perfil?.nombre ?? 'Sin perfil',
      codigoQr: `${QR_PREFIX}${Math.floor(1000 + Math.random() * 9000)}`,
      estado: 'ACTIVA',
      emitidaEn: iso(localNow()),
      venceEn: iso(new Date(Date.now() + 365 * DAY)),
      emitidaPor: c.emitidaPor,
    };
    this.credenciales.unshift(cred);
    return structuredClone(cred);
  }
  revocarCredencial(id: string, motivo: string): Credencial {
    const idx = this.credenciales.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('NOT_FOUND');
    this.credenciales[idx] = { ...this.credenciales[idx], estado: 'REVOCADA', motivo };
    return structuredClone(this.credenciales[idx]);
  }
  reemitirCredencial(id: string, emitidaPor: string): Credencial {
    const idx = this.credenciales.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('NOT_FOUND');
    this.credenciales[idx] = {
      ...this.credenciales[idx],
      estado: 'ACTIVA',
      motivo: undefined,
      codigoQr: `${QR_PREFIX}${Math.floor(1000 + Math.random() * 9000)}`,
      emitidaEn: iso(localNow()),
      venceEn: iso(new Date(Date.now() + 365 * DAY)),
      emitidaPor,
    };
    return structuredClone(this.credenciales[idx]);
  }

  // --- registro de acceso ---
  listRegistros(): RegistroAcceso[] {
    return structuredClone(this.registros);
  }
  /** Valida un QR contra las credenciales y registra el evento. */
  escanear(codigoQr: string, operador: string, estacion: string): RegistroAcceso {
    const qr = codigoQr.trim().toUpperCase();
    const cred = this.credenciales.find((c) => c.codigoQr.toUpperCase() === qr);
    const zona = cred
      ? this.zonas.find((z) => z.id === this.perfiles.find((p) => p.id === cred.zonaIdPerfil)?.zonaId)
      : undefined;

    // Credencial inexistente → DENEGADO
    if (!cred) {
      const reg: RegistroAcceso = {
        id: this.uid('ac'),
        credentialId: 'unknown',
        titular: 'Desconocido',
        zona: '—',
        tipo: 'INGRESO',
        resultado: 'DENEGADO',
        motivo: 'Credencial no registrada',
        timestamp: iso(localNow()),
        registradoPor: operador,
        estacion,
      };
      this.registros.unshift(reg);
      return structuredClone(reg);
    }

    // Credencial revocada / vencida → DENEGADO
    if (cred.estado === 'REVOCADA' || cred.estado === 'VENCIDA') {
      const motivo = cred.estado === 'REVOCADA' ? 'Credencial revocada' : 'Credencial vencida';
      const reg: RegistroAcceso = {
        id: this.uid('ac'),
        credentialId: cred.id,
        titular: cred.titular,
        zona: zona?.nombre ?? '—',
        tipo: cred.estado === 'REVOCADA' ? 'EGRESO' : 'INGRESO',
        resultado: 'DENEGADO',
        motivo,
        timestamp: iso(localNow()),
        registradoPor: operador,
        estacion,
      };
      this.registros.unshift(reg);
      return structuredClone(reg);
    }

    // Válida → AUTORIZADO
    const reg: RegistroAcceso = {
      id: this.uid('ac'),
      credentialId: cred.id,
      titular: cred.titular,
      zona: zona?.nombre ?? '—',
      tipo: 'INGRESO',
      resultado: 'AUTORIZADO',
      timestamp: iso(localNow()),
      registradoPor: operador,
      estacion,
    };
    this.registros.unshift(reg);
    return structuredClone(reg);
  }

  // --- notificaciones ---
  listNotificaciones(): Notificacion[] {
    return structuredClone(this.notificaciones);
  }
  marcarLeida(id: string): Notificacion {
    const idx = this.notificaciones.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error('NOT_FOUND');
    this.notificaciones[idx] = { ...this.notificaciones[idx], leida: true };
    return structuredClone(this.notificaciones[idx]);
  }
  marcarTodasLeidas(): void {
    this.notificaciones = this.notificaciones.map((n) => ({ ...n, leida: true }));
  }

  // --- auditoría ---
  listAuditoria(): InconsistenciaAuditoria[] {
    return structuredClone(this.auditoria);
  }
  cambiarEstadoAuditoria(id: string, estado: HallazgoEstado): InconsistenciaAuditoria {
    const idx = this.auditoria.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('NOT_FOUND');
    this.auditoria[idx] = { ...this.auditoria[idx], estado };
    return structuredClone(this.auditoria[idx]);
  }
}
