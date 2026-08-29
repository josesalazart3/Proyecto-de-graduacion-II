// Configuración de entorno.
//
// Fase 1: apunta al interceptor mock (cualquier URL bajo /api/).
// Fase 2: cambia apiUrl a la URL del backend real y quita el interceptor mock.

export const environment = {
  production: false,
  apiUrl: '/api',
};
