import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { mockInterceptor } from './core/data/mock.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Nota Fase 2: para conectar la API real, quita `withInterceptors([mockInterceptor])`
    // y apunta `environment.apiUrl` al backend. Nada más cambia.
    provideHttpClient(withInterceptors([mockInterceptor])),
  ],
};
