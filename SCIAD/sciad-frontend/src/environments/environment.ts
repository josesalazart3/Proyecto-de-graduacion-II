// Configuración de entorno.
//
// Fase 1: apunta al interceptor mock (cualquier URL bajo /api/).
// Fase 2: cambia apiUrl a la URL del backend real y quita el interceptor mock.

// Constante SUELTA (no propiedad de objeto) para que el compilador la sustituya y elimine el código muerto:
// con `false` las cuentas demo (con contraseña) NO viajan en el JavaScript del navegador.
export const SHOW_DEMO_ACCOUNTS = true;

export const environment = {
  production: false,
  apiUrl: '/api',
  // Muestra en el login las cuentas demo (con contraseña). Solo desarrollo (`ng serve`).
  showDemoAccounts: true,
};
