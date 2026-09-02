import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Fase 3 (§4.4): interceptor JWT activo para todas las peticiones.
    // El interceptor mock se retiró al reconciliar las pantallas contra el backend real.
    provideHttpClient(withInterceptors([jwtInterceptor])),
  ],
};
