// Entorno de PRODUCCIÓN (`ng build --configuration production`, que es el que usan Docker y el túnel).
// Sustituye a environment.ts mediante `fileReplacements` en angular.json.
export const environment = {
  production: true,
  apiUrl: '/api',
  // Las cuentas demo NO se muestran en el login. Para una demostración (defensa de tesis) ponlo en `true`
  // y vuelve a compilar; recuerda que cualquiera con la URL vería las contraseñas demo.
  showDemoAccounts: false,
};
