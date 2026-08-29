// Zonas y perfiles de acceso (CU-03: gestionar perfiles de acceso por zona).

export interface Zona {
  id: string;
  nombre: string;
  descripcion: string;
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  capacidad: number; // personas simultáneas estimadas
  activa: boolean;
}

export type DiaSemana = 'LUN' | 'MAR' | 'MIE' | 'JUE' | 'VIE' | 'SAB' | 'DOM';

export interface HorarioAcceso {
  id: string;
  dia: DiaSemana;
  inicio: string; // HH:mm
  fin: string; // HH:mm
}

export interface PerfilAcceso {
  id: string;
  nombre: string;
  zonaId: string;
  descripcion: string;
  horarios: HorarioAcceso[];
  requiereAprobacion: boolean;
  activo: boolean;
  // Agregación de solo lectura / UI:
  asignaciones?: number;
}
