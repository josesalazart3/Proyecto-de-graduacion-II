// Configuración de entorno.
//
// Fase 1: apunta al interceptor mock (cualquier URL bajo /api/).
// Fase 2: cambia apiUrl a la URL del backend real y quita el interceptor mock.

export const environment = {
  production: false,
  apiUrl: '/api',
  // Muestra en el login las cuentas demo (con contraseña). Solo desarrollo (`ng serve`).
  showDemoAccounts: true,
};
