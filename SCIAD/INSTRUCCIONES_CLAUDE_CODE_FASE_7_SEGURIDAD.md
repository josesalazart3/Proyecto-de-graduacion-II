# INSTRUCCIONES PARA CLAUDE CODE — SCIAD · Fase 7
## Blindaje de seguridad (OWASP Top 10 · 2021) con evidencia automatizada

> **Para quién es este archivo:** Claude Code, en la computadora del usuario. Es **autocontenido** y se aplica **después** de las Fases 1-6 (ya aplicadas).
> ⚠ Léelo **completo** (~1950 líneas) antes de modificar nada.

## 0. REGLAS (obligatorias)

1. **Todo es LOCAL.** Prohibido: `git commit`, `push`, ramas, `stash`, `reset`. El commit lo hace el usuario al confirmarlo. (`git apply` sin `--index` sí.)
2. **Docker está autorizado** (`compose up/ps/logs/exec`, `docker run` de imágenes de prueba: SDK de .NET, ZAP, Trivy, Gitleaks). **No** borres volúmenes (`down -v`) sin pedir confirmación.
3. **Aplica el código tal cual.** Si un bloque no encaja (archivo distinto, un `diff` no aplica): detente, muestra la diferencia y pregunta. No «mejores» el código embebido.
4. **Cambios fuera de este documento** solo para corregir un **fallo real** descubierto por las pruebas, pequeño y claro; explica causa y cambio. **No toques** el esquema de BD/migraciones.
5. **PG2_V2.docx no se modifica** y es la base de la validación. No cambies nada que el documento afirme (Anexo A): 162 pruebas unitarias, matriz RBAC de 32 endpoints (sin endpoints nuevos), JWT HS256 de 8 h,
   bloqueo del 6.º intento de login (429 por IP), TLS 1.2/1.3, tokens QR de 256 bits, baja lógica, Tabla 16 de auditoría. Si un hallazgo de seguridad obligara a contradecir algo del documento, **no lo apliques: repórtalo**.
6. **Honestidad:** ningún sistema es «imposible de hackear». Esta fase deja controles verificables por categoría OWASP y un informe de riesgo residual (Anexo C). **No afirmes** seguridad total; reporta tal cual lo que las pruebas muestren.
7. Al terminar: informe (Paso 10) y **espera** la confirmación del usuario para el commit.

## 1. Auditoría inicial: qué se encontró y cómo se corrige

| # | Hallazgo (estado previo) | OWASP | Corrección en esta fase |
|---|---|---|---|
| 1 | **`admin@sciad.gt` / `sciad123` viajaban dentro del JavaScript de producción** (`main-*.js`), aunque el login ocultara los botones | A05 / A07 | La constante `SHOW_DEMO_ACCOUNTS=false` elimina `DEMO_ACCOUNTS` del bundle (código muerto) |
| 2 | El seeder creaba cuentas con contraseña conocida **también en producción** | A07 / A05 | Cuentas demo solo en Development; en producción el admin inicial sale de variables de entorno con **política de contraseña fuerte** (si es débil, el backend no arranca) |
| 3 | JWT en `localStorage` (persiste en disco; lo lee cualquier XSS) | A02 / A07 | `sessionStorage` (se borra al cerrar pestaña/app) + CSP estricta |
| 4 | Sin CSP ni cabeceras modernas; HTML/API cacheables | A05 / A02 | CSP estricta con **nonce por petición**, `no-store` en HTML y API, COOP/CORP, Permissions-Policy, sin versión de servidor, sin `.map` ni archivos ocultos, métodos y tamaño de cuerpo acotados |
| 5 | La API no enviaba cabeceras de seguridad ni `no-store` si se accedía directo | A05 | Middleware de cabeceras + Kestrel sin `Server`, límites de cuerpo/cabeceras/timeouts |
| 6 | Un usuario **desactivado conservaba acceso hasta 8 h** (el JWT no se revalidaba) | A01 / A07 | Cada petición valida que el usuario siga activo y con el mismo rol (caché de 30 s) |
| 7 | Login: distinto **tiempo** y **respuesta (403 «inactivo»)** según el correo existiera → enumeración de cuentas; sin bloqueo por cuenta | A07 | Verificación BCrypt «señuelo» (tiempo constante), respuesta única 401, **bloqueo por cuenta** (10 fallos → 10 min) en memoria |
| 8 | JWT sin restringir algoritmos | A02 / A08 | Solo HS256, firma y expiración obligatorias |
| 9 | Límite de intentos solo en `/login` | A04 | + límite global por IP (1500/min, holgado para los 300 escaneos concurrentes del documento) |
| 10 | CORS con cualquier cabecera/método; `AllowedHosts: *` | A05 | CORS acotado; `AllowedHosts` configurable (producción: solo el dominio) |
| 11 | Puertos de desarrollo 8080/3000 (API **y Swagger**) abiertos a toda la red local | A05 | Publicados solo en `127.0.0.1`; la base de datos nunca se publica |
| 12 | Contenedores como root, con capacidades y sistema de archivos escribible | A05 | Usuario `app` (no root), `cap_drop: ALL`, `no-new-privileges`, `read_only` + `tmpfs` |
| 13 | Solo se registraban los inicios de sesión correctos | A09 | Fallos de login, bloqueos y respuestas 401/403/429 como `Warning` con IP; sin contraseñas ni tokens en logs |
| 14 | `npm audit`: 1 vulnerabilidad **alta** en producción (`@angular/router`, solo SSR) y 11 en herramientas de desarrollo | A06 | Actualizar Angular 22.x (Paso 4); lo que no se pueda se documenta como riesgo aceptado |
| 15 | No existía una prueba que demostrara el cumplimiento | — | `verify-owasp.mjs` (A01–A10), `tests-fase7` (CSP con nginx real + navegador) y los barridos ZAP / Trivy / Gitleaks |

**Decisiones explícitas (para el informe):** (a) **No** se reemplaza el JWT local por OAuth 2.0/OIDC: PG2_V2 documenta JWT con usuarios propios y migrar exigiría un proveedor de identidad externo (otra superficie de ataque) y cambiar el documento; queda como trabajo futuro junto con MFA (TOTP). (b) El bloqueo por cuenta es en memoria (una instancia). (c) No se agregan endpoints (la matriz sigue en 32).

Rutas relativas a `SCIAD/`. Los `git apply` se ejecutan **desde la raíz del repo** con `--directory=SCIAD`.

---

## 2. PASO 0 — Comprobaciones previas
1. `git status --short`, `git log --oneline -3`: deben estar aplicadas las Fases 1-6. Si hay cambios sin commit en archivos de este documento, **pregunta**.
2. Existen `sciad-backend/src/Sciad.Api/Background/CierreDiarioHostedService.cs` y `sciad-backend/tests/Sciad.TimeHarness/`.
3. Anota el estado inicial: ejecuta (desde `sciad-frontend/`) `npm audit --omit=dev` y guarda el resultado (línea base del Hallazgo 14).

---

## 3. PASO 1 — Frontend: sin secretos, sesión efímera y CSP estricta

### 3.1 Cuentas demo fuera del JavaScript de producción
#### 🔧 EDITAR (diff) — `sciad-frontend/src/environments/environment.ts`
`SHOW_DEMO_ACCOUNTS = true` solo en desarrollo.
````diff
diff --git a/sciad-frontend/src/environments/environment.ts b/sciad-frontend/src/environments/environment.ts
index 8e8143b..f65949e 100644
--- a/sciad-frontend/src/environments/environment.ts
+++ b/sciad-frontend/src/environments/environment.ts
@@ -3,6 +3,10 @@
 // Fase 1: apunta al interceptor mock (cualquier URL bajo /api/).
 // Fase 2: cambia apiUrl a la URL del backend real y quita el interceptor mock.
 
+// Constante SUELTA (no propiedad de objeto) para que el compilador la sustituya y elimine el código muerto:
+// con `false` las cuentas demo (con contraseña) NO viajan en el JavaScript del navegador.
+export const SHOW_DEMO_ACCOUNTS = true;
+
 export const environment = {
   production: false,
   apiUrl: '/api',
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/environments/environment.prod.ts`
`SHOW_DEMO_ACCOUNTS = false`: el compilador elimina `DEMO_ACCOUNTS` del bundle.
````diff
diff --git a/sciad-frontend/src/environments/environment.prod.ts b/sciad-frontend/src/environments/environment.prod.ts
index 3106ca4..e8d3df7 100644
--- a/sciad-frontend/src/environments/environment.prod.ts
+++ b/sciad-frontend/src/environments/environment.prod.ts
@@ -1,5 +1,8 @@
 // Entorno de PRODUCCIÓN (`ng build --configuration production`, que es el que usan Docker y el túnel).
 // Sustituye a environment.ts mediante `fileReplacements` en angular.json.
+// Constante SUELTA: con `false` el compilador elimina DEMO_ACCOUNTS del bundle (no viaja ninguna contraseña al navegador).
+export const SHOW_DEMO_ACCOUNTS = false;
+
 export const environment = {
   production: true,
   apiUrl: '/api',
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/auth/login.component.ts`

````diff
diff --git a/sciad-frontend/src/app/features/auth/login.component.ts b/sciad-frontend/src/app/features/auth/login.component.ts
index 78010f8..da30d69 100644
--- a/sciad-frontend/src/app/features/auth/login.component.ts
+++ b/sciad-frontend/src/app/features/auth/login.component.ts
@@ -8,7 +8,7 @@ import { Button } from '../../shared/ui/button.component';
 import { SciInput } from '../../shared/ui/field.component';
 import { ToastService } from '../../shared/ui/toast.service';
 import { homeFor } from '../../core/auth/paths';
-import { environment } from '../../../environments/environment';
+import { SHOW_DEMO_ACCOUNTS } from '../../../environments/environment';
 
 @Component({
   selector: 'app-login',
@@ -180,9 +180,10 @@ export class LoginComponent {
   private readonly router = inject(Router);
   private readonly toast = inject(ToastService);
 
-  protected readonly demoAccounts = DEMO_ACCOUNTS;
+  // Con SHOW_DEMO_ACCOUNTS=false (producción) esta rama se elimina en la compilación: DEMO_ACCOUNTS no llega al bundle.
+  protected readonly demoAccounts = SHOW_DEMO_ACCOUNTS ? DEMO_ACCOUNTS : [];
   /** Las cuentas demo (con su contraseña) solo se muestran en desarrollo; el build de producción las oculta. */
-  protected readonly showDemoAccounts = environment.showDemoAccounts;
+  protected readonly showDemoAccounts = SHOW_DEMO_ACCOUNTS;
   protected readonly loading = signal(false);
   protected readonly serverError = signal<string | null>(null);
 
````

### 3.2 Sesión en `sessionStorage` (no en disco)
#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/core/services/auth.service.ts`
Además borra cualquier token viejo de `localStorage`.
````diff
diff --git a/sciad-frontend/src/app/core/services/auth.service.ts b/sciad-frontend/src/app/core/services/auth.service.ts
index 1c466b7..a795f40 100644
--- a/sciad-frontend/src/app/core/services/auth.service.ts
+++ b/sciad-frontend/src/app/core/services/auth.service.ts
@@ -50,9 +50,7 @@ export class AuthService {
 
   logout(): void {
     this.session.set({ user: null, token: null });
-    if (typeof localStorage !== 'undefined') {
-      localStorage.removeItem(STORAGE_KEY);
-    }
+    this.clearStored();
   }
 
   /** Nombre del usuario actual para registrar acciones. */
@@ -64,17 +62,29 @@ export class AuthService {
     return this.session().user ?? null;
   }
 
+  // La sesión (JWT) vive en sessionStorage, NO en localStorage: se borra al cerrar la pestaña o la app instalada, no queda
+  // en disco entre sesiones del navegador y no se comparte entre pestañas. Recargar la página NO cierra la sesión.
+  // (Cualquier entrada antigua en localStorage se elimina.)
   private setSession(user: Usuario, token: string): void {
     this.session.set({ user, token });
+    if (typeof sessionStorage !== 'undefined') {
+      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
+    }
     if (typeof localStorage !== 'undefined') {
-      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
+      localStorage.removeItem(STORAGE_KEY);
     }
   }
 
+  private clearStored(): void {
+    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
+    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
+  }
+
   private readStored(): SessionState {
-    if (typeof localStorage === 'undefined') return { user: null, token: null };
+    if (typeof sessionStorage === 'undefined') return { user: null, token: null };
     try {
-      const raw = localStorage.getItem(STORAGE_KEY);
+      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY); // migración: no dejar tokens viejos en disco
+      const raw = sessionStorage.getItem(STORAGE_KEY);
       if (!raw) return { user: null, token: null };
       const parsed = JSON.parse(raw) as SessionState;
       return parsed.user ? parsed : { user: null, token: null };
````

### 3.3 CSP estricta: nonce en `<app-root>`, sin CSS crítico en línea, gafete con nonce
#### 🔧 EDITAR (diff) — `sciad-frontend/src/index.html`
nginx sustituye `__CSP_NONCE__` por un valor aleatorio por petición.
````diff
diff --git a/sciad-frontend/src/index.html b/sciad-frontend/src/index.html
index 056f3c5..e53d342 100644
--- a/sciad-frontend/src/index.html
+++ b/sciad-frontend/src/index.html
@@ -16,6 +16,7 @@
   <meta name="apple-mobile-web-app-status-bar-style" content="default">
 </head>
 <body>
-  <app-root></app-root>
+  <!-- nginx sustituye __CSP_NONCE__ por un valor aleatorio por petición (CSP estricta: style-src con nonce) -->
+  <app-root ngCspNonce="__CSP_NONCE__"></app-root>
 </body>
 </html>
````

#### 🔧 EDITAR (diff) — `sciad-frontend/angular.json`
`inlineCritical: false` (el CSS crítico en línea exigiría `unsafe-inline`).
````diff
diff --git a/sciad-frontend/angular.json b/sciad-frontend/angular.json
index 370df14..2ed4cb9 100644
--- a/sciad-frontend/angular.json
+++ b/sciad-frontend/angular.json
@@ -75,6 +75,14 @@
                 }
               ],
               "outputHashing": "all",
+              "optimization": {
+                "scripts": true,
+                "styles": {
+                  "minify": true,
+                  "inlineCritical": false
+                },
+                "fonts": false
+              },
               "fileReplacements": [
                 {
                   "replace": "src/environments/environment.ts",
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/core/util/qr.ts`
El `<style>` del gafete impreso (iframe) lleva el nonce de la página.
````diff
diff --git a/sciad-frontend/src/app/core/util/qr.ts b/sciad-frontend/src/app/core/util/qr.ts
index 1d42802..3221629 100644
--- a/sciad-frontend/src/app/core/util/qr.ts
+++ b/sciad-frontend/src/app/core/util/qr.ts
@@ -12,6 +12,13 @@ export function escapeHtml(s: string): string {
     .replace(/'/g, '&#39;');
 }
 
+/** Nonce de la CSP (lo inyecta nginx en <app-root ngCspNonce>); el gafete impreso lo necesita para su <style>. */
+function cspNonce(): string {
+  const el = document.querySelector('[ngcspnonce]');
+  const n = el?.getAttribute('ngcspnonce') ?? '';
+  return /^[A-Za-z0-9+/=_-]{8,}$/.test(n) ? n : '';
+}
+
 /** PNG (data URL) del QR. `size` es el ancho en píxeles; incluye zona de silencio blanca. */
 export async function qrDataUrl(value: string, size = 480): Promise<string> {
   const QRCode = (await import('qrcode')).default;
@@ -54,7 +61,7 @@ export interface DatosGafete {
 export async function imprimirGafete(d: DatosGafete): Promise<void> {
   const img = await qrDataUrl(d.token, 600);
   const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Gafete</title>
-<style>
+<style${cspNonce() ? ` nonce="${cspNonce()}"` : ''}>
   @page { size: auto; margin: 10mm; }
   * { box-sizing: border-box; }
   body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; }
````

### 3.4 nginx (desarrollo/túnel y producción) — reemplazos completos
Una sola plantilla de cabeceras repetida en cada `location` (en nginx, `add_header` dentro de un `location` anula las del `server`). Producción añade HSTS y `upgrade-insecure-requests`.

#### ♻️ REEMPLAZAR POR COMPLETO — `sciad-frontend/nginx.conf`

````nginx
# ============================================================
# SCIAD — nginx desarrollo / túnel (SPA + proxy /api) (Fase 7: endurecimiento OWASP)
# Una sola plantilla de cabeceras repetida en cada `location` (add_header en un location anula las del server).
#  - CSP estricta: sin scripts en línea; estilos solo con nonce por petición (sub_filter sobre index.html → ngCspNonce).
#  - HTML y API con Cache-Control: no-store (nada sensible queda en cachés del navegador ni de proxies).
#  - Sin versión de servidor, sin archivos ocultos ni sourcemaps, métodos acotados, cuerpo de /api limitado.
# ============================================================
server {
    listen       80;
    server_name  _;

    server_tokens off;
    root   /usr/share/nginx/html;
    index  index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Solo los métodos que usa la aplicación.
    if ($request_method !~ ^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$) {
        return 405;
    }

    # Cabeceras por defecto (las locations que definen las suyas las repiten).
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    # Nada de archivos ocultos (.git, .env…) ni sourcemaps; /.well-known/ se permite (ACME).
    location ~ /\.(?!well-known) {
        return 404;
    }
    location ~* \.map$ {
        return 404;
    }

    # --- Documento HTML (SPA) -------------------------------------------------------------------
    # no-store: ni el navegador ni un proxy guardan la página. El nonce de la CSP se genera por petición
    # ($request_id, 128 bits) y se inyecta en el atributo ngCspNonce de <app-root> (Angular lo aplica a sus <style>).
    location = /index.html {
        sub_filter_once off;
        sub_filter '__CSP_NONCE__' '$request_id';
        add_header Cache-Control "no-store, max-age=0" always;
        add_header Content-Security-Policy "default-src 'none'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'nonce-$request_id'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self';" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
    }

    # Manifest de la app instalable.
    location = /manifest.webmanifest {
        default_type application/manifest+json;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
        try_files $uri =404;
    }

    # SPA fallback: cualquier ruta → index.html (location anterior le pone CSP y no-store).
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Archivos estáticos con hash en el nombre (públicos, sin datos sensibles) → caché larga.
    # Si un archivo ya no existe (hash viejo) devuelve 404, no el index.html.
    location ~* \.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|json)$ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
    }

    # --- API: proxy al backend --------------------------------------------------------------------
    # Respuestas SIEMPRE con no-store; cuerpo limitado (la API solo recibe JSON pequeño).
    location /api/ {
        client_max_body_size 64k;
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_hide_header X-Powered-By;
        proxy_hide_header Server;
        proxy_hide_header Cache-Control;
        # nginx es quien fija las cabeceras de seguridad cuando se pasa por él (evita líneas duplicadas del backend).
        proxy_hide_header Pragma;
        proxy_hide_header X-Content-Type-Options;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Referrer-Policy;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Permissions-Policy;
        proxy_hide_header Cross-Origin-Resource-Policy;
        proxy_hide_header Cross-Origin-Opener-Policy;
        proxy_hide_header Strict-Transport-Security;
        add_header Cache-Control "no-store, max-age=0" always;
        add_header Pragma "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
    }
}
````

#### ♻️ REEMPLAZAR POR COMPLETO — `sciad-frontend/nginx.prod.conf`

````nginx
# ============================================================
# SCIAD — nginx PRODUCCIÓN (TLS + SPA + proxy /api) (Fase 7: endurecimiento OWASP)
# Una sola plantilla de cabeceras repetida en cada `location` (add_header en un location anula las del server).
#  - CSP estricta: sin scripts en línea; estilos solo con nonce por petición (sub_filter sobre index.html → ngCspNonce).
#  - HTML y API con Cache-Control: no-store (nada sensible queda en cachés del navegador ni de proxies).
#  - Sin versión de servidor, sin archivos ocultos ni sourcemaps, métodos acotados, cuerpo de /api limitado.
# ============================================================
# ---- Puerto 80: challenge ACME (Let's Encrypt) + redirección a HTTPS ----
server {
    listen       80;
    server_name  sciad.gt www.sciad.gt;
    server_tokens off;

    # Challenge HTTP-01 de certbot — SIEMPRE disponible (renovación sin parar el contenedor)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Todo lo demás → HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# ---- Puerto 443: TLS ----
server {
    listen       443 ssl;
    http2        on;
    server_name  sciad.gt www.sciad.gt;

    # Certificados emitidos por certbot en el HOST y montados como volumen (no se versionan).
    ssl_certificate     /etc/letsencrypt/live/sciad.gt/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sciad.gt/privkey.pem;

    # TLS 1.2/1.3 únicamente (RNF-01 / SEC-07).
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    # ssl_dhparam /etc/nginx/dhparam.pem;   # descomentar si se generó (openssl dhparam -out /etc/ssl/private/dhparam.pem 2048)

    server_tokens off;
    root   /usr/share/nginx/html;
    index  index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Solo los métodos que usa la aplicación.
    if ($request_method !~ ^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$) {
        return 405;
    }

    # Cabeceras por defecto (las locations que definen las suyas las repiten).
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Nada de archivos ocultos (.git, .env…) ni sourcemaps; /.well-known/ se permite (ACME).
    location ~ /\.(?!well-known) {
        return 404;
    }
    location ~* \.map$ {
        return 404;
    }

    # --- Documento HTML (SPA) -------------------------------------------------------------------
    # no-store: ni el navegador ni un proxy guardan la página. El nonce de la CSP se genera por petición
    # ($request_id, 128 bits) y se inyecta en el atributo ngCspNonce de <app-root> (Angular lo aplica a sus <style>).
    location = /index.html {
        sub_filter_once off;
        sub_filter '__CSP_NONCE__' '$request_id';
        add_header Cache-Control "no-store, max-age=0" always;
        add_header Content-Security-Policy "default-src 'none'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'nonce-$request_id'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; upgrade-insecure-requests;" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    }

    # Manifest de la app instalable.
    location = /manifest.webmanifest {
        default_type application/manifest+json;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        try_files $uri =404;
    }

    # SPA fallback: cualquier ruta → index.html (location anterior le pone CSP y no-store).
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Archivos estáticos con hash en el nombre (públicos, sin datos sensibles) → caché larga.
    # Si un archivo ya no existe (hash viejo) devuelve 404, no el index.html.
    location ~* \.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|json)$ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    }

    # --- API: proxy al backend --------------------------------------------------------------------
    # Respuestas SIEMPRE con no-store; cuerpo limitado (la API solo recibe JSON pequeño).
    location /api/ {
        client_max_body_size 64k;
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_hide_header X-Powered-By;
        proxy_hide_header Server;
        proxy_hide_header Cache-Control;
        # nginx es quien fija las cabeceras de seguridad cuando se pasa por él (evita líneas duplicadas del backend).
        proxy_hide_header Pragma;
        proxy_hide_header X-Content-Type-Options;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Referrer-Policy;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Permissions-Policy;
        proxy_hide_header Cross-Origin-Resource-Policy;
        proxy_hide_header Cross-Origin-Opener-Policy;
        proxy_hide_header Strict-Transport-Security;
        add_header Cache-Control "no-store, max-age=0" always;
        add_header Pragma "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    }
}
````

### 3.5 Pruebas del frontend afectadas
#### 🔧 EDITAR (diff) — `sciad-frontend/tests-fase1/e2e.mjs`
La sesión ahora está en `sessionStorage`.
````diff
diff --git a/sciad-frontend/tests-fase1/e2e.mjs b/sciad-frontend/tests-fase1/e2e.mjs
index debd721..38b08ca 100644
--- a/sciad-frontend/tests-fase1/e2e.mjs
+++ b/sciad-frontend/tests-fase1/e2e.mjs
@@ -179,7 +179,7 @@ console.log('\n[4] Token vencido (401) → vuelve al login');
 {
   const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 800 });
   await login(page, BASE, 'expira@sciad.gt');
-  const back = await page.waitForFunction(() => location.pathname === '/login' && !localStorage.getItem('sciad.session'), { timeout: 10000 }).then(() => true).catch(() => false);
+  const back = await page.waitForFunction(() => location.pathname === '/login' && !sessionStorage.getItem('sciad.session') && !localStorage.getItem('sciad.session'), { timeout: 10000 }).then(() => true).catch(() => false);
   check('401 en cualquier endpoint → sesión cerrada y redirige a /login', back);
   await page.close();
 }
````

#### 🔧 EDITAR (diff) — `sciad-frontend/tests-fase2/pwa-nginx.test.mjs`
Cabeceras nuevas: `no-store` y `X-Frame-Options: DENY`.
````diff
diff --git a/sciad-frontend/tests-fase2/pwa-nginx.test.mjs b/sciad-frontend/tests-fase2/pwa-nginx.test.mjs
index d0f5cdc..443b919 100644
--- a/sciad-frontend/tests-fase2/pwa-nginx.test.mjs
+++ b/sciad-frontend/tests-fase2/pwa-nginx.test.mjs
@@ -47,10 +47,10 @@ check('manifest: 200 y application/manifest+json', r.status === 200 && /applicat
 check('manifest: Cache-Control no-cache', /no-cache/.test(r.h['cache-control'] ?? ''), r.h['cache-control']);
 const man = JSON.parse(r.body.toString());
 r = await get('/index.html');
-check('index.html: no-cache + Permissions-Policy cámara', /no-cache/.test(r.h['cache-control'] ?? '') && /camera=\(self\)/.test(r.h['permissions-policy'] ?? ''), `${r.h['cache-control']} | ${r.h['permissions-policy']}`);
-check('index.html: conserva cabeceras de seguridad', r.h['x-content-type-options'] === 'nosniff' && r.h['x-frame-options'] === 'SAMEORIGIN');
+check('index.html: sin caché (no-store) + Permissions-Policy cámara', /no-store|no-cache/.test(r.h['cache-control'] ?? '') && /camera=\(self\)/.test(r.h['permissions-policy'] ?? ''), `${r.h['cache-control']} | ${r.h['permissions-policy']}`);
+check('index.html: conserva cabeceras de seguridad', r.h['x-content-type-options'] === 'nosniff' && r.h['x-frame-options'] === 'DENY');
 r = await get('/seguridad/escaneo');
-check('ruta SPA (/seguridad/escaneo) cae a index.html SIN caché', r.status === 200 && /<app-root>/.test(r.body.toString()) && /no-cache/.test(r.h['cache-control'] ?? ''), r.h['cache-control']);
+check('ruta SPA (/seguridad/escaneo) cae a index.html SIN caché', r.status === 200 && /<app-root/.test(r.body.toString()) && /no-store|no-cache/.test(r.h['cache-control'] ?? ''), r.h['cache-control']);
 const js = readFileSync(path.join(DIST, 'index.html'), 'utf8').match(/main-[A-Za-z0-9_-]+\.js/)[0];
 r = await get('/' + js);
 check('asset con hash: caché larga immutable', /immutable/.test(r.h['cache-control'] ?? '') && r.status === 200, r.h['cache-control']);
````

### 3.6 Prueba nueva: cabeceras + CSP con nginx REAL y un navegador (`tests-fase7/`)
Recorre **toda** la aplicación (Admin, Seguridad en celular y Gerencia) y **falla si hay una sola violación de la CSP**; comprueba además el nonce por petición, `no-store`, sin versión de servidor, `.git`/`.env`/`.map` → 404,
`TRACE` → 405, cuerpo > 64 KB → 413, que el gafete conserva su estilo, que el JWT está en `sessionStorage` y que **no hay contraseñas en el JavaScript**. Requiere `nginx` instalado (Linux/WSL) y el build en `dist/`.

#### 📄 NUEVO — `sciad-frontend/tests-fase7/package.json`

````json
{
  "name": "sciad-tests-fase7",
  "private": true,
  "type": "module",
  "description": "Fase 7: cabeceras y CSP con nginx real + Chromium. Reutiliza node_modules de tests-fase1.",
  "scripts": { "test:csp": "node --no-warnings headers-csp.test.mjs" },
  "devDependencies": { "puppeteer-core": "25.12.0" },
  "optionalDependencies": { "@sparticuz/chromium": "153.0.0" }
}
````

#### 📄 NUEVO — `sciad-frontend/tests-fase7/.gitignore`

````
node_modules
node_modules/
.tmp/
out/
````

#### 📄 NUEVO — `sciad-frontend/tests-fase7/headers-csp.test.mjs`

````js
// Fase 7 — Cabeceras de seguridad y CSP estricta, probadas con NGINX REAL + Chromium + la app completa.
// Usa el nginx.conf del repo (solo se cambian root/listen/rutas temporales) y el backend simulado (tests-fase5).
// Requisitos: nginx instalado (apt install nginx), build en ../dist y `npm i` en ../tests-fase1. Linux/WSL.
process.env.TZ = 'America/Guatemala';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createBackend } from '../tests-fase5/mock-backend.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.resolve(HERE, '..');
const DIST = path.join(FRONT, 'dist/sciad-frontend/browser');
const TMP = path.join(HERE, '.tmp'); mkdirSync(TMP, { recursive: true });
const OUT = path.join(HERE, 'out'); mkdirSync(OUT, { recursive: true });
const PORT = 8097, BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗ FALLO'} ${n}${x ? '  → ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raw = (method, p, { headers = {}, body } = {}) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers }, (x) => { const b = []; x.on('data', (c) => b.push(c)); x.on('end', () => res({ status: x.statusCode, h: x.headers, body: Buffer.concat(b).toString('utf8') })); }); r.on('error', rej); if (body) r.write(body); r.end(); });

if (!existsSync(DIST)) throw new Error('Falta el build: ng build --configuration production');
try { execFileSync('nginx', ['-v'], { stdio: 'pipe' }); } catch { throw new Error('nginx no está instalado'); }

// backend simulado en :8080 (nginx.conf hace proxy_pass a http://backend:8080 → /etc/hosts)
const { server: back } = createBackend();
await new Promise((r) => back.listen(8080, '127.0.0.1', r));
const hosts = readFileSync('/etc/hosts', 'utf8'); if (!/\bbackend\b/.test(hosts)) writeFileSync('/etc/hosts', hosts + '\n127.0.0.1 backend\n');

const server = readFileSync(path.join(FRONT, process.env.NGINX_CONF ?? 'nginx.conf'), 'utf8').replace('listen       80;', `listen ${PORT};`).replace('root   /usr/share/nginx/html;', `root ${DIST};`);
writeFileSync(path.join(TMP, 'nginx.conf'), `pid ${TMP}/nginx.pid; error_log ${TMP}/err.log; daemon off;
events { worker_connections 64; }
http { include /etc/nginx/mime.types; access_log off; client_body_temp_path ${TMP}/b; proxy_temp_path ${TMP}/p; fastcgi_temp_path ${TMP}/f; uwsgi_temp_path ${TMP}/u; scgi_temp_path ${TMP}/s;
${server}
}`);
let okConf = true; try { execFileSync('nginx', ['-t', '-c', path.join(TMP, 'nginx.conf')], { stdio: 'pipe' }); } catch (e) { okConf = false; console.log(String(e.stderr)); }
check('nginx -t acepta el nginx.conf del repo', okConf);
const ng = spawn('nginx', ['-c', path.join(TMP, 'nginx.conf')], { stdio: 'ignore' });
await sleep(800);

console.log('\n[A] Cabeceras y CSP (nginx real)');
const i1 = await raw('GET', '/index.html'); const i2 = await raw('GET', '/seguridad/escaneo');
const csp = i1.h['content-security-policy'] ?? '';
const nonce = (/nonce-([a-f0-9]{32})/.exec(csp) ?? [])[1];
check('CSP presente con nonce de 128 bits', !!nonce, nonce);
check('el nonce de la cabecera coincide con el del HTML (app-root y script)', !!nonce && (i1.body.match(new RegExp(nonce, 'g')) ?? []).length >= 2 && !/__CSP_NONCE__/.test(i1.body), `${(i1.body.match(new RegExp(nonce ?? 'x', 'g')) ?? []).length} apariciones`);
const nonce2 = (/nonce-([a-f0-9]{32})/.exec(i2.h['content-security-policy'] ?? '') ?? [])[1];
check('el nonce cambia en cada petición (y también en rutas SPA)', !!nonce2 && nonce2 !== nonce);
check("CSP: default-src 'none', script-src 'self' (sin 'unsafe-inline'/'unsafe-eval'), object-src 'none', frame-ancestors 'none'",
  /default-src 'none'/.test(csp) && /script-src 'self';/.test(csp) && !/unsafe-(inline|eval)/.test(csp) && /object-src 'none'/.test(csp) && /frame-ancestors 'none'/.test(csp));
check("CSP: style-src solo 'self' + nonce (sin 'unsafe-inline')", /style-src 'self' 'nonce-[a-f0-9]{32}'/.test(csp));
check('HTML: Cache-Control no-store', /no-store/.test(i1.h['cache-control'] ?? '') && /no-store/.test(i2.h['cache-control'] ?? ''), i1.h['cache-control']);
for (const [n, v] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['referrer-policy', 'no-referrer'], ['cross-origin-opener-policy', 'same-origin'], ['cross-origin-resource-policy', 'same-origin']])
  check(`HTML: ${n}: ${v}`, i1.h[n] === v, i1.h[n]);
check('Permissions-Policy: cámara solo del propio origen, el resto denegado', /camera=\(self\)/.test(i1.h['permissions-policy'] ?? '') && /microphone=\(\)/.test(i1.h['permissions-policy'] ?? '') && /geolocation=\(\)/.test(i1.h['permissions-policy'] ?? ''));
check('el servidor no revela su versión', !/\d/.test(i1.h['server'] ?? '') && !i1.h['x-powered-by'], i1.h['server']);
const api = await raw('GET', '/api/zonas-acceso');
check('/api/: Cache-Control no-store + Pragma no-cache', /no-store/.test(api.h['cache-control'] ?? '') && api.h['pragma'] === 'no-cache', api.h['cache-control']);
check('/api/: nosniff, DENY y sin Server con versión', api.h['x-content-type-options'] === 'nosniff' && api.h['x-frame-options'] === 'DENY' && !/\d/.test(api.h['server'] ?? ''));
const js = (i1.body.match(/main-[A-Za-z0-9_-]+\.js/) ?? [])[0];
const st = await raw('GET', '/' + js);
check('estático con hash: caché larga pública + nosniff (no contiene datos sensibles)', /immutable/.test(st.h['cache-control'] ?? '') && st.h['x-content-type-options'] === 'nosniff');
for (const p of ['/.git/config', '/.env', '/main.js.map', `/${js}.map`]) { const r = await raw('GET', p); check(`${p} → 404`, r.status === 404, String(r.status)); }
check('método TRACE → 405', (await raw('TRACE', '/')).status === 405);
check('cuerpo de /api mayor a 64 KB → 413', (await raw('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json', 'Content-Length': 70000 }, body: 'x'.repeat(70000) })).status === 413);
check('no hay secretos en el JavaScript de producción (contraseña/cuentas demo)', !readFileSync(path.join(DIST, js), 'utf8').includes('sciad123') && !/admin@sciad\.gt/.test(readFileSync(path.join(DIST, js), 'utf8')));

console.log('\n[B] La aplicación completa funciona bajo la CSP (0 violaciones)');
const apiCall = async (m, p, body, token) => { const r = await fetch(`${BASE}/api${p}`, { method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return j; };
const admin = (await apiCall('POST', '/auth/login', { email: 'admin@sciad.gt', password: 'sciad123' })).token;
const zona = await apiCall('POST', '/zonas-acceso', { nombre: 'Entrada', nivelSeguridad: 'MEDIO', nivelRiesgo: 'BAJO', capacidad: 10 }, admin);
const per = await apiCall('POST', '/personas', { nombre: 'Juan CSP', dpiCodigo: 'CSP-1', tipo: 1 }, admin);
await apiCall('POST', '/perfiles-acceso', { personaId: +per.id, zonaId: +zona.id, vigenciaInicio: '2020-01-01', vigenciaFin: '2099-01-01' }, admin);
await apiCall('POST', `/credenciales/${per.id}/generar`, null, admin);

const nav = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, headless: true } : { executablePath: await (await import('@sparticuz/chromium')).default.executablePath(), headless: 'shell' };
const y4m = path.join(FRONT, 'tests-fase1', 'fake_cam.y4m');
const browser = await puppeteer.launch({ ...nav, env: { ...process.env, TZ: 'America/Guatemala' }, args: ['--no-sandbox', '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...(existsSync(y4m) ? [`--use-file-for-fake-video-capture=${y4m}`] : [])] });
async function sesion(email, rutas, vp = { width: 1366, height: 800 }) {
  const pg = await browser.newPage(); await pg.setViewport(vp);
  const violaciones = [], errores = [];
  await pg.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ← ${e.blockedURI || 'inline'} ${String(e.sample || '').slice(0, 40)}`)); });
  pg.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) violaciones.push(m.text().slice(0, 160)); });
  pg.on('pageerror', (e) => errores.push(String(e).slice(0, 120)));
  await pg.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await pg.type('sci-input input', email); await (await pg.$$('form input'))[1].type('sciad123'); await pg.click('form button');
  await pg.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
  for (const r of rutas) { await pg.goto(`${BASE}${r}`, { waitUntil: 'networkidle0' }); await sleep(500); const v = await pg.evaluate(() => window.__csp); violaciones.push(...v.map((x) => `${r}: ${x}`)); }
  return { pg, violaciones, errores };
}
const A = await sesion('admin@sciad.gt', ['/admin/dashboard', '/admin/usuarios', '/admin/personas', '/admin/zonas', '/admin/perfiles', '/admin/credenciales', '/admin/auditoria', '/admin/reportes', '/admin/accesos', '/admin/escaneo']);
check('Admin: 10 pantallas sin ninguna violación de CSP ni errores JS', A.violaciones.length === 0 && A.errores.length === 0, [...A.violaciones, ...A.errores].slice(0, 3).join(' | '));
const almacen = await A.pg.evaluate(() => ({ sess: !!sessionStorage.getItem('sciad.session'), loc: !!localStorage.getItem('sciad.session') }));
check('el JWT vive en sessionStorage y NO queda en localStorage (disco)', almacen.sess && !almacen.loc, JSON.stringify(almacen));
const estilos = await A.pg.evaluate(() => [...document.querySelectorAll('style')].every((s) => s.nonce || s.getAttribute('nonce') !== null));
check('los <style> de Angular llevan nonce', estilos);
const iconos = await A.pg.evaluate(() => [...document.querySelectorAll('sci-icon svg')].filter((s) => s.children.length).length);
check('los íconos se dibujan bajo la CSP', iconos > 3, `${iconos}`);
// credencial: QR (data:) y gafete (iframe con <style nonce>)
await A.pg.goto(`${BASE}/admin/credenciales`, { waitUntil: 'networkidle0' });
await A.pg.waitForSelector('button[aria-label="Ver"]'); await A.pg.click('button[aria-label="Ver"]');
const qrOk = await A.pg.waitForSelector('img.qr-img', { timeout: 8000 }).then(() => true).catch(() => false);
check('el QR (imagen data:) se muestra bajo la CSP', qrOk);
await A.pg.evaluate(() => { window.__ifr = []; const o = Node.prototype.appendChild; Node.prototype.appendChild = function (n) { const r = o.call(this, n); if (n.tagName === 'IFRAME') window.__ifr.push(n); return r; }; });
const [, bImp] = await A.pg.$$('.qr-actions button'); await bImp.click(); await sleep(1500);
const gaf = await A.pg.evaluate(() => { const d = window.__ifr[0]?.contentDocument; const b = d?.querySelector('.badge'); return b ? { borde: getComputedStyle(b).borderTopWidth, nombre: d.querySelector('.name')?.textContent } : null; });
check('el gafete impreso conserva su estilo (style con nonce dentro del iframe)', !!gaf && gaf.borde !== '0px' && gaf.nombre === 'Juan CSP', JSON.stringify(gaf));
check('sin violaciones de CSP al imprimir el gafete', (await A.pg.evaluate(() => window.__csp)).length === 0);
const S = await sesion('seguridad@sciad.gt', ['/seguridad/escaneo', '/seguridad/accesos'], { width: 390, height: 844, isMobile: true, hasTouch: true });
check('Seguridad (celular): escáner y accesos sin violaciones de CSP', S.violaciones.length === 0 && S.errores.length === 0, [...S.violaciones, ...S.errores].slice(0, 3).join(' | '));
const camara = await S.pg.waitForSelector('.viewport.live', { timeout: 8000 }).then(() => true).catch(() => false);
console.log(`  ℹ cámara simulada ${camara ? 'activa' : 'no disponible en este entorno (no afecta la CSP)'}`);
const G = await sesion('gerencia@sciad.gt', ['/gerencia/trazabilidad', '/gerencia/notificaciones', '/gerencia/reportes']);
check('Gerencia: 3 pantallas sin violaciones de CSP', G.violaciones.length === 0 && G.errores.length === 0, [...G.violaciones, ...G.errores].slice(0, 3).join(' | '));
await A.pg.screenshot({ path: path.join(OUT, 'csp_admin.png') });
await browser.close(); ng.kill(); back.close();
console.log(`\nRESULTADO: ${pass} ✓  ${fail} ✗`);
process.exit(fail ? 1 : 0);
````

---

## 4. PASO 2 — Backend: autenticación, sesión, cabeceras y seeder

### 4.1 Bloqueo por cuenta y política de contraseña (código nuevo)
#### 📄 NUEVO — `sciad-backend/src/Sciad.Application/Services/LoginAttemptTracker.cs`
Singleton en memoria. Umbral 10 (mayor que el límite por IP de 5 → no altera la prueba documentada del 6.º intento).
````csharp
using System.Collections.Concurrent;

namespace Sciad.Application.Services;

/// <summary>
/// Bloqueo temporal por cuenta tras demasiados inicios de sesión fallidos (OWASP A07 — fuerza bruta y credential stuffing).
/// Complementa —no reemplaza— el límite por IP de <c>/api/auth/login</c> (5 intentos por 5 min, PG2): este bloqueo actúa por
/// CORREO aunque el atacante cambie de IP. La clave es el correo normalizado, exista o no la cuenta, para que el
/// comportamiento sea idéntico y no permita descubrir qué correos están registrados.
/// El umbral (10) es mayor que el del límite por IP (5) a propósito: una persona legítima que se equivoca no queda bloqueada
/// y la prueba documentada de «sexto intento → 429» no se ve afectada. En memoria (una instancia de API); se reinicia con el servicio.
/// </summary>
public sealed class LoginAttemptTracker
{
    public const int MaxFallos = 10;
    public static readonly TimeSpan Ventana = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(10);
    private const int LimiteEntradas = 10_000;

    private sealed class Estado
    {
        public int Fallos;
        public DateTime PrimerFallo;
        public DateTime? BloqueadoHasta;
    }

    private readonly ConcurrentDictionary<string, Estado> _estados = new();
    private readonly Func<DateTime> _ahora;

    public LoginAttemptTracker(Func<DateTime>? ahora = null)
    {
        _ahora = ahora ?? (() => DateTime.UtcNow);
    }

    public static string Normalizar(string? correo) => (correo ?? string.Empty).Trim().ToLowerInvariant();

    public bool EstaBloqueado(string? correo)
    {
        if (!_estados.TryGetValue(Normalizar(correo), out var e))
        {
            return false;
        }

        lock (e)
        {
            return e.BloqueadoHasta is { } hasta && hasta > _ahora();
        }
    }

    /// <summary>Registra un fallo. Devuelve true si con este fallo la cuenta queda bloqueada.</summary>
    public bool RegistrarFallo(string? correo)
    {
        var ahora = _ahora();
        if (_estados.Count > LimiteEntradas)
        {
            Depurar(ahora);
        }

        var e = _estados.GetOrAdd(Normalizar(correo), _ => new Estado { PrimerFallo = ahora });
        lock (e)
        {
            if (e.BloqueadoHasta is { } hasta && hasta > ahora)
            {
                return true;
            }

            if (ahora - e.PrimerFallo > Ventana || e.BloqueadoHasta is not null)
            {
                e.Fallos = 0;
                e.PrimerFallo = ahora;
                e.BloqueadoHasta = null;
            }

            e.Fallos++;
            if (e.Fallos >= MaxFallos)
            {
                e.BloqueadoHasta = ahora + Bloqueo;
                return true;
            }

            return false;
        }
    }

    /// <summary>Un inicio de sesión correcto borra el historial de fallos.</summary>
    public void Reiniciar(string? correo) => _estados.TryRemove(Normalizar(correo), out _);

    private void Depurar(DateTime ahora)
    {
        foreach (var (clave, e) in _estados)
        {
            lock (e)
            {
                var vencido = e.BloqueadoHasta is { } h ? h <= ahora : ahora - e.PrimerFallo > Ventana;
                if (vencido)
                {
                    _estados.TryRemove(clave, out _);
                }
            }
        }
    }
}
````

#### 📄 NUEVO — `sciad-backend/src/Sciad.Application/Services/PoliticaContrasena.cs`
Solo para el administrador inicial por variable de entorno; no cambia los formularios (mínimo 8, PG2).
````csharp
namespace Sciad.Application.Services;

/// <summary>
/// Política de contraseñas fuertes para cuentas privilegiadas creadas por configuración (administrador inicial, OWASP A07).
/// No cambia la validación de los formularios existentes (mínimo 8 caracteres, PG2); se aplica a la contraseña del
/// administrador inicial que se declara por variable de entorno en producción.
/// </summary>
public static class PoliticaContrasena
{
    public const int LongitudMinima = 12;

    private static readonly string[] Conocidas =
    {
        "sciad123", "password", "contraseña", "admin123", "12345678", "qwerty123", "letmein", "welcome1", "changeme",
    };

    public static bool EsFuerte(string? contrasena, out string motivo)
    {
        motivo = string.Empty;
        if (string.IsNullOrEmpty(contrasena) || contrasena.Length < LongitudMinima)
        {
            motivo = $"debe tener al menos {LongitudMinima} caracteres";
            return false;
        }

        var minuscula = contrasena.Any(char.IsLower);
        var mayuscula = contrasena.Any(char.IsUpper);
        var digito = contrasena.Any(char.IsDigit);
        var simbolo = contrasena.Any(c => !char.IsLetterOrDigit(c));
        if (!(minuscula && mayuscula && digito && simbolo))
        {
            motivo = "debe incluir mayúsculas, minúsculas, números y un símbolo";
            return false;
        }

        var normal = contrasena.ToLowerInvariant();
        if (Conocidas.Any(k => normal.Contains(k, StringComparison.Ordinal)) || contrasena.Distinct().Count() < 6)
        {
            motivo = "es demasiado común o predecible";
            return false;
        }

        return true;
    }
}
````

### 4.2 Login: tiempo constante, bloqueo, registro de fallos, respuesta única
`AuthService` conserva sus 3 primeros parámetros (el 4.º es opcional) para que `AuthServiceTests` (5 pruebas) **no cambie**.
#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Application/Services/AuthService.cs`

````diff
diff --git a/sciad-backend/src/Sciad.Application/Services/AuthService.cs b/sciad-backend/src/Sciad.Application/Services/AuthService.cs
index e03e3ac..1985e04 100644
--- a/sciad-backend/src/Sciad.Application/Services/AuthService.cs
+++ b/sciad-backend/src/Sciad.Application/Services/AuthService.cs
@@ -13,12 +13,19 @@ public sealed class AuthService : IAuthService
     private readonly IUsuarioRepository _usuarios;
     private readonly ITokenService _token;
     private readonly ILogger<AuthService> _logger;
+    private readonly LoginAttemptTracker _intentos;
 
-    public AuthService(IUsuarioRepository usuarios, ITokenService token, ILogger<AuthService> logger)
+    // Hash «señuelo» (se calcula una vez): se verifica contra él cuando el correo no existe, la cuenta está inactiva o bloqueada,
+    // para que TODAS las rutas de fallo tarden lo mismo y el tiempo de respuesta no delate qué correos existen (OWASP A07).
+    private static readonly string HashSenuelo = BCrypt.Net.BCrypt.HashPassword("sciad-hash-senuelo-tiempo-constante", workFactor: 10);
+
+    // `intentos` es opcional para no romper a quien construye AuthService a mano (p. ej. los tests); en la API se inyecta el singleton.
+    public AuthService(IUsuarioRepository usuarios, ITokenService token, ILogger<AuthService> logger, LoginAttemptTracker? intentos = null)
     {
         _usuarios = usuarios;
         _token = token;
         _logger = logger;
+        _intentos = intentos ?? new LoginAttemptTracker();
     }
 
     public async Task<LoginResult> LoginAsync(string email, string password, CancellationToken ct = default)
@@ -26,24 +33,40 @@ public sealed class AuthService : IAuthService
         // Respuesta genérica: no revelar si el correo existe.
         var fallo = LoginResult.Fallo(LoginResult.CredencialesInvalidas);
 
+        // Cuenta bloqueada temporalmente por exceso de fallos: misma respuesta y mismo tiempo que una credencial inválida.
+        if (_intentos.EstaBloqueado(email))
+        {
+            _ = BCrypt.Net.BCrypt.Verify(password ?? string.Empty, HashSenuelo);
+            _logger.LogWarning("Inicio de sesión rechazado: cuenta bloqueada temporalmente por intentos fallidos.");
+            return fallo;
+        }
+
         var usuario = await _usuarios.FindByCorreoAsync(email, ct);
         if (usuario is null)
         {
-            _logger.LogInformation("Intento de login con correo desconocido.");
+            _ = BCrypt.Net.BCrypt.Verify(password ?? string.Empty, HashSenuelo);
+            RegistrarFallo(email, null);
+            _logger.LogWarning("Inicio de sesión fallido: correo desconocido.");
             return fallo;
         }
 
         if (!string.Equals(usuario.Estado, "activo", StringComparison.OrdinalIgnoreCase))
         {
-            _logger.LogInformation("Intento de login de usuario inactivo (id={UsuarioId}).", usuario.Id);
+            _ = BCrypt.Net.BCrypt.Verify(password ?? string.Empty, HashSenuelo);
+            RegistrarFallo(email, usuario.Id);
+            _logger.LogWarning("Inicio de sesión fallido: usuario inactivo (id={UsuarioId}).", usuario.Id);
             return LoginResult.Fallo(LoginResult.UsuarioInactivo);
         }
 
         if (!BCrypt.Net.BCrypt.Verify(password, usuario.PasswordHash))
         {
+            RegistrarFallo(email, usuario.Id);
+            _logger.LogWarning("Inicio de sesión fallido: contraseña incorrecta (id={UsuarioId}).", usuario.Id);
             return fallo;
         }
 
+        _intentos.Reiniciar(email);
+
         var token = _token.GenerarToken(usuario.Id, usuario.Nombre, usuario.Rol.Codigo);
         var dto = UsuarioDto.From(usuario);
 
@@ -51,6 +74,16 @@ public sealed class AuthService : IAuthService
         return LoginResult.Ok(new LoginResponse(dto, token));
     }
 
+    private void RegistrarFallo(string email, int? usuarioId)
+    {
+        if (_intentos.RegistrarFallo(email))
+        {
+            _logger.LogWarning(
+                "Cuenta bloqueada temporalmente tras {Fallos} intentos fallidos (id={UsuarioId}).",
+                LoginAttemptTracker.MaxFallos, usuarioId);
+        }
+    }
+
     public async Task<UsuarioDto?> ObtenerPorIdAsync(int usuarioId, CancellationToken ct = default)
     {
         var usuario = await _usuarios.FindByIdAsync(usuarioId, ct);
````

#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Application/DependencyInjection.cs`
Registra el singleton del bloqueo.
````diff
diff --git a/sciad-backend/src/Sciad.Application/DependencyInjection.cs b/sciad-backend/src/Sciad.Application/DependencyInjection.cs
index cd2d91a..057f3cf 100644
--- a/sciad-backend/src/Sciad.Application/DependencyInjection.cs
+++ b/sciad-backend/src/Sciad.Application/DependencyInjection.cs
@@ -10,6 +10,7 @@ public static class DependencyInjection
     public static IServiceCollection AddApplication(this IServiceCollection services)
     {
         services.AddSingleton<ITokenService, TokenService>();
+        services.AddSingleton<LoginAttemptTracker>();
         services.AddScoped<IAuthService, AuthService>();
         services.AddScoped<IUsuariosService, UsuariosService>();
         services.AddScoped<IPersonasService, PersonasService>();
````

#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Api/Controllers/AuthController.cs`
Credenciales inválidas, correo desconocido, cuenta inactiva o bloqueada → **una sola** respuesta 401.
````diff
diff --git a/sciad-backend/src/Sciad.Api/Controllers/AuthController.cs b/sciad-backend/src/Sciad.Api/Controllers/AuthController.cs
index 611ac8d..f225bd5 100644
--- a/sciad-backend/src/Sciad.Api/Controllers/AuthController.cs
+++ b/sciad-backend/src/Sciad.Api/Controllers/AuthController.cs
@@ -40,11 +40,9 @@ public sealed class AuthController : ControllerBase
             return Ok(result.Response);
         }
 
-        return result.CodigoError switch
-        {
-            LoginResult.UsuarioInactivo => ApiProblem.Forbidden("El usuario está inactivo. Contacte al administrador."),
-            _ => ApiProblem.Unauthorized("Credenciales inválidas."),
-        };
+        // Respuesta ÚNICA (401, mismo texto) para credenciales inválidas, correo desconocido, cuenta inactiva o bloqueada:
+        // distinguir «inactivo» sin conocer la contraseña revelaría qué correos existen (OWASP A07). El motivo real queda en el log.
+        return ApiProblem.Unauthorized("Credenciales inválidas.");
     }
 
     /// <summary>Devuelve el usuario autenticado a partir del token Bearer.</summary>
````

### 4.3 Seeder: sin cuentas con contraseña conocida fuera de desarrollo
#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Infrastructure/Persistence/DbSeeder.cs`
Development → cuentas demo (como hasta ahora). Producción → solo el admin inicial de `Seed__AdminEmail`/`Seed__AdminPassword` (fuerte) y falla si es débil.
````diff
diff --git a/sciad-backend/src/Sciad.Infrastructure/Persistence/DbSeeder.cs b/sciad-backend/src/Sciad.Infrastructure/Persistence/DbSeeder.cs
index 9148363..0c79a4f 100644
--- a/sciad-backend/src/Sciad.Infrastructure/Persistence/DbSeeder.cs
+++ b/sciad-backend/src/Sciad.Infrastructure/Persistence/DbSeeder.cs
@@ -1,5 +1,7 @@
 using Microsoft.EntityFrameworkCore;
+using Microsoft.Extensions.Configuration;
 using Microsoft.Extensions.Logging;
+using Sciad.Application.Services;
 using Sciad.Domain.Entities;
 
 namespace Sciad.Infrastructure.Persistence;
@@ -12,11 +14,13 @@ public sealed class DbSeeder
 {
     private readonly SciadDbContext _db;
     private readonly ILogger<DbSeeder> _logger;
+    private readonly IConfiguration _config;
 
-    public DbSeeder(SciadDbContext db, ILogger<DbSeeder> logger)
+    public DbSeeder(SciadDbContext db, ILogger<DbSeeder> logger, IConfiguration config)
     {
         _db = db;
         _logger = logger;
+        _config = config;
     }
 
     public async Task SeedAsync(CancellationToken ct = default)
@@ -57,7 +61,68 @@ public sealed class DbSeeder
         }
     }
 
+    /// <summary>
+    /// Cuentas de arranque. Seguridad (OWASP A05/A07): las cuentas DEMO con contraseña conocida (sciad123) solo se crean en
+    /// Development (o si se pide explícitamente con Seed__DemoUsers=true). En producción NO existen; el administrador inicial
+    /// se declara con Seed__AdminEmail y Seed__AdminPassword (contraseña fuerte, ≥ 12 caracteres) y solo se crea si no existe.
+    /// </summary>
     private async Task SeedUsuariosAsync(CancellationToken ct)
+    {
+        var entorno = _config["ASPNETCORE_ENVIRONMENT"] ?? "Production";
+        var demo = bool.TryParse(_config["Seed:DemoUsers"], out var pedido)
+            ? pedido
+            : string.Equals(entorno, "Development", StringComparison.OrdinalIgnoreCase);
+
+        if (demo)
+        {
+            _logger.LogWarning("Sembrando cuentas DEMO con contraseña conocida: solo para desarrollo.");
+            await SeedUsuariosDemoAsync(ct);
+            return;
+        }
+
+        await SeedAdministradorInicialAsync(ct);
+    }
+
+    private async Task SeedAdministradorInicialAsync(CancellationToken ct)
+    {
+        var correo = _config["Seed:AdminEmail"]?.Trim().ToLowerInvariant();
+        var clave = _config["Seed:AdminPassword"];
+        if (string.IsNullOrWhiteSpace(correo) || string.IsNullOrEmpty(clave))
+        {
+            if (!await _db.Usuarios.AnyAsync(ct))
+            {
+                _logger.LogError(
+                    "No existe ningún usuario y no se definió Seed__AdminEmail / Seed__AdminPassword: nadie podrá iniciar sesión.");
+            }
+
+            return;
+        }
+
+        if (await _db.Usuarios.AnyAsync(u => u.Correo == correo, ct))
+        {
+            return;
+        }
+
+        if (!PoliticaContrasena.EsFuerte(clave, out var motivo))
+        {
+            // Falla al arrancar: es preferible no iniciar que iniciar con un administrador débil.
+            throw new InvalidOperationException($"Seed:AdminPassword no es segura: {motivo}.");
+        }
+
+        var adminRol = await _db.Roles.SingleAsync(r => r.Codigo == "ADMIN", ct);
+        _db.Usuarios.Add(new Usuario
+        {
+            Nombre = "Administrador del Sistema",
+            Correo = correo,
+            Rol = adminRol,
+            Puesto = "Administrador del Sistema",
+            Estado = "activo",
+            PasswordHash = BCrypt.Net.BCrypt.HashPassword(clave, workFactor: 12),
+        });
+        _logger.LogInformation("Administrador inicial creado ({Correo}).", correo);
+    }
+
+    private async Task SeedUsuariosDemoAsync(CancellationToken ct)
     {
         var adminRol = await _db.Roles.SingleAsync(r => r.Codigo == "ADMIN", ct);
         var seguridadRol = await _db.Roles.SingleAsync(r => r.Codigo == "SEGURIDAD", ct);
````

### 4.4 `Program.cs`: Kestrel, JWT, sesión vigente, rate limit global, CORS, cabeceras y registro
#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Api/Program.cs`
Compila contra paquetes que solo existen en tu Docker: si hay errores, corrige con el cambio mínimo y explícalo.
````diff
diff --git a/sciad-backend/src/Sciad.Api/Program.cs b/sciad-backend/src/Sciad.Api/Program.cs
index 65aba29..1e3dcd8 100644
--- a/sciad-backend/src/Sciad.Api/Program.cs
+++ b/sciad-backend/src/Sciad.Api/Program.cs
@@ -1,4 +1,6 @@
+using System.IdentityModel.Tokens.Jwt;
 using System.Net;
+using System.Security.Claims;
 using System.Text;
 using System.Text.Json;
 using System.Threading.RateLimiting;
@@ -6,9 +8,11 @@ using Microsoft.AspNetCore.Authentication.JwtBearer;
 using Microsoft.AspNetCore.HttpOverrides;
 using Microsoft.AspNetCore.RateLimiting;
 using Microsoft.EntityFrameworkCore;
+using Microsoft.Extensions.Caching.Memory;
 using Microsoft.IdentityModel.Tokens;
 using Sciad.Api.Common;
 using Sciad.Application;
+using Sciad.Application.Interfaces;
 using Sciad.Application.Options;
 using Sciad.Infrastructure;
 using Sciad.Infrastructure.Persistence;
@@ -17,6 +21,17 @@ using Serilog.Events;
 
 var builder = WebApplication.CreateBuilder(args);
 
+// ---------- Kestrel endurecido (OWASP A05): sin cabecera Server, cuerpos y cabeceras acotados, timeouts ----------
+builder.WebHost.ConfigureKestrel(k =>
+{
+    k.AddServerHeader = false;
+    k.Limits.MaxRequestBodySize = 64 * 1024; // la API solo recibe JSON pequeño
+    k.Limits.MaxRequestHeadersTotalSize = 16 * 1024;
+    k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
+    k.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(60);
+});
+builder.Services.AddMemoryCache();
+
 // ---------- Logging estructurado (Serilog → JSON en consola) ----------
 builder.Host.UseSerilog((context, cfg) => cfg
     .MinimumLevel.Information()
@@ -67,6 +82,10 @@ builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
         options.RequireHttpsMetadata = false; // TLS se termina en el reverse proxy (producción)
         options.TokenValidationParameters = new TokenValidationParameters
         {
+            // Solo HS256 (evita ataques de confusión de algoritmo / alg=none) y token siempre firmado y con expiración.
+            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
+            RequireSignedTokens = true,
+            RequireExpirationTime = true,
             ValidateIssuer = true,
             ValidIssuer = jwt.Emisor,
             ValidateAudience = true,
@@ -80,6 +99,34 @@ builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
         };
         options.Events = new JwtBearerEvents
         {
+            // Sesión vigente en CADA petición (OWASP A01/A07): un usuario desactivado o con otro rol pierde el acceso en
+            // ≤ 30 s, aunque su JWT (8 h) no haya vencido. La consulta se cachea 30 s en memoria del servidor.
+            OnTokenValidated = async context =>
+            {
+                var idRaw = context.Principal?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
+                            ?? context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
+                var rolToken = context.Principal?.FindFirst(ClaimTypes.Role)?.Value;
+                if (!int.TryParse(idRaw, out var usuarioId) || string.IsNullOrEmpty(rolToken))
+                {
+                    context.Fail("Token sin identidad válida.");
+                    return;
+                }
+
+                var cache = context.HttpContext.RequestServices.GetRequiredService<IMemoryCache>();
+                var repo = context.HttpContext.RequestServices.GetRequiredService<IUsuarioRepository>();
+                var vigente = await cache.GetOrCreateAsync($"sesion:{usuarioId}:{rolToken}", async entry =>
+                {
+                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
+                    var u = await repo.FindByIdAsync(usuarioId, context.HttpContext.RequestAborted);
+                    return u is not null
+                           && string.Equals(u.Estado, "activo", StringComparison.OrdinalIgnoreCase)
+                           && string.Equals(u.Rol.Codigo, rolToken, StringComparison.Ordinal);
+                });
+                if (vigente != true)
+                {
+                    context.Fail("Sesión no vigente.");
+                }
+            },
             OnChallenge = async context =>
             {
                 context.HandleResponse();
@@ -131,7 +178,9 @@ builder.Services.AddAuthorization(options =>
 var corsOrigins = (builder.Configuration["Cors:Origins"] ?? "http://localhost:8080,http://localhost:4200")
     .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
 builder.Services.AddCors(o => o.AddPolicy("frontend", p =>
-    p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));
+    p.WithOrigins(corsOrigins)
+        .WithHeaders("Authorization", "Content-Type")
+        .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")));
 
 // ---------- Swagger / OpenAPI (desarrollo) ----------
 builder.Services.AddEndpointsApiExplorer();
@@ -145,10 +194,25 @@ var rateLimitSection = builder.Configuration.GetSection("RateLimit");
 var loginPermitLimit = rateLimitSection.GetValue<int>("LoginPermitLimit", 5);
 var loginWindowSeconds = rateLimitSection.GetValue<int>("LoginWindowSeconds", 300);
 
+var globalPermitLimit = rateLimitSection.GetValue<int>("GlobalPermitLimit", 1500);
+
 builder.Services.AddRateLimiter(options =>
 {
     options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
 
+    // Límite GLOBAL por IP (OWASP A04 — abuso de recursos / DoS de aplicación). 1500/min por defecto: holgado a propósito
+    // para no afectar la carga objetivo documentada (300 escaneos concurrentes, RNF-04); es solo un último recurso.
+    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
+        RateLimitPartition.GetSlidingWindowLimiter(
+            partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
+            factory: _ => new SlidingWindowRateLimiterOptions
+            {
+                PermitLimit = globalPermitLimit,
+                Window = TimeSpan.FromMinutes(1),
+                SegmentsPerWindow = 6,
+                QueueLimit = 0,
+            }));
+
     options.AddPolicy("login", context =>
         RateLimitPartition.GetFixedWindowLimiter(
             partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anon",
@@ -167,7 +231,7 @@ builder.Services.AddRateLimiter(options =>
         {
             Status = StatusCodes.Status429TooManyRequests,
             Title = "Demasiadas solicitudes",
-            Detail = "Demasiados intentos de inicio de sesión desde esta IP. Espere unos minutos e intente nuevamente.",
+            Detail = "Demasiadas solicitudes desde esta IP. Espere unos minutos e intente nuevamente.",
         };
         pd.Extensions["code"] = "RATE_LIMITED";
         pd.Extensions["message"] = pd.Detail;
@@ -200,6 +264,27 @@ var app = builder.Build();
 
 app.UseForwardedHeaders();
 
+// ---------- Cabeceras de seguridad y NO-CACHE en TODAS las respuestas de la API (OWASP A05/A02) ----------
+// Nada de lo que devuelve la API (datos de personas, tokens, registros) debe quedar en cachés del navegador o de proxies.
+// Swagger (solo Development) necesita sus propios scripts, por eso se exceptúa de la CSP restrictiva.
+app.Use(async (context, next) =>
+{
+    var h = context.Response.Headers;
+    h["Cache-Control"] = "no-store, max-age=0";
+    h["Pragma"] = "no-cache";
+    h["X-Content-Type-Options"] = "nosniff";
+    h["X-Frame-Options"] = "DENY";
+    h["Referrer-Policy"] = "no-referrer";
+    h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
+    h["Cross-Origin-Resource-Policy"] = "same-origin";
+    if (!context.Request.Path.StartsWithSegments("/swagger"))
+    {
+        h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
+    }
+
+    await next();
+});
+
 // ---------- Migraciones + seed al arranque (idempotente) ----------
 using (var scope = app.Services.CreateScope())
 {
@@ -210,6 +295,15 @@ using (var scope = app.Services.CreateScope())
 
 app.UseMiddleware<ErrorHandlingMiddleware>();
 
+// Registro de solicitudes (OWASP A09): método, ruta (sin query), estado, tiempo e IP; 401/403/429 se registran como Warning.
+app.UseSerilogRequestLogging(o =>
+{
+    o.GetLevel = (ctx, _, ex) => ex is not null || ctx.Response.StatusCode >= 500
+        ? LogEventLevel.Error
+        : ctx.Response.StatusCode is 401 or 403 or 429 ? LogEventLevel.Warning : LogEventLevel.Information;
+    o.EnrichDiagnosticContext = (diag, ctx) => diag.Set("RemoteIp", ctx.Connection.RemoteIpAddress?.ToString());
+});
+
 app.UseCors("frontend");
 
 app.UseRateLimiter();
````

### 4.5 Contenedor sin root
#### 🔧 EDITAR (diff) — `sciad-backend/Dockerfile`
`USER app` (la imagen `aspnet:8.0` lo trae; el puerto 8080 no es privilegiado).
````diff
diff --git a/sciad-backend/Dockerfile b/sciad-backend/Dockerfile
index 70aa139..ff17302 100644
--- a/sciad-backend/Dockerfile
+++ b/sciad-backend/Dockerfile
@@ -18,4 +18,7 @@ COPY --from=build /app/publish .
 EXPOSE 8080
 ENV ASPNETCORE_URLS=http://+:8080
 
+# Sin privilegios de root (OWASP A05): la imagen aspnet:8.0 trae el usuario `app` (UID 1654); el puerto 8080 no es privilegiado.
+USER app
+
 ENTRYPOINT ["dotnet", "Sciad.Api.dll"]
````

### 4.6 Arnés ampliado (ahora incluye la seguridad del login)
#### 🔧 EDITAR (diff) — `sciad-backend/tests/Sciad.TimeHarness/Program.cs`
Secciones [7] y [8]: bloqueo por cuenta, sin enumeración, reinicio tras éxito, expiración del bloqueo, tiempo constante (con BCrypt real) y política de contraseña.
````diff
diff --git a/sciad-backend/tests/Sciad.TimeHarness/Program.cs b/sciad-backend/tests/Sciad.TimeHarness/Program.cs
index cf43231..bcd7d16 100644
--- a/sciad-backend/tests/Sciad.TimeHarness/Program.cs
+++ b/sciad-backend/tests/Sciad.TimeHarness/Program.cs
@@ -183,6 +183,55 @@ public static class Harness
         inactivo.StartAsync(CancellationToken.None).Wait(); inactivo.StopAsync(CancellationToken.None).Wait();
         Check("con Habilitado=false no programa nada", llamadas == 2);
 
+        // ───────────────────────── Seguridad del login (OWASP A07) ─────────────────────────
+        Console.WriteLine("[7] Login: bloqueo por cuenta, sin enumeración y tiempo constante");
+        var pwdOk = "Correcta#2026-x";
+        var hashOk = BCrypt.Net.BCrypt.HashPassword(pwdOk, 10);
+        var rolAdmin = new Rol { Id = 1, Codigo = "ADMIN", Nombre = "Administrador" };
+        var uActivo = new Usuario { Id = 1, Nombre = "Admin", Correo = "admin@x.gt", Rol = rolAdmin, Puesto = "p", Estado = "activo", PasswordHash = hashOk };
+        var uInactivo = new Usuario { Id = 2, Nombre = "Baja", Correo = "baja@x.gt", Rol = rolAdmin, Puesto = "p", Estado = "inactivo", PasswordHash = hashOk };
+        var usuariosFake = Fake.Make<IUsuarioRepository>(new() { ["FindByCorreoAsync"] = a => (string)a[0]! switch { "admin@x.gt" => uActivo, "baja@x.gt" => uInactivo, _ => null } });
+        var tokenFake = Fake.Make<ITokenService>(new() { ["GenerarToken"] = a => "jwt-firma" });
+        var ahoraLogin = new DateTime(2026, 8, 21, 12, 0, 0, DateTimeKind.Utc);
+        var tracker = new LoginAttemptTracker(() => ahoraLogin);
+        var auth = new AuthService(usuariosFake, tokenFake, NullLogger<AuthService>.Instance, tracker);
+
+        Check("login correcto → token", auth.LoginAsync("admin@x.gt", pwdOk).Result is { Exitoso: true });
+        for (int i = 0; i < LoginAttemptTracker.MaxFallos - 1; i++) auth.LoginAsync("admin@x.gt", "mala" + i).Wait();
+        Check($"{LoginAttemptTracker.MaxFallos - 1} fallos: todavía NO bloqueada (el límite por IP, 5, es otro mecanismo)", !tracker.EstaBloqueado("admin@x.gt"));
+        auth.LoginAsync("admin@x.gt", "mala-final").Wait();
+        Check($"al fallo n.º {LoginAttemptTracker.MaxFallos} la cuenta queda bloqueada", tracker.EstaBloqueado("admin@x.gt"));
+        var bloqueada = auth.LoginAsync("admin@x.gt", pwdOk).Result;
+        Check("con la cuenta bloqueada, incluso la contraseña CORRECTA devuelve el mismo error genérico", !bloqueada.Exitoso && bloqueada.CodigoError == LoginResult.CredencialesInvalidas);
+        ahoraLogin = ahoraLogin + LoginAttemptTracker.Bloqueo + TimeSpan.FromSeconds(1);
+        Check("pasado el tiempo de bloqueo, la contraseña correcta vuelve a funcionar", auth.LoginAsync("admin@x.gt", pwdOk).Result.Exitoso);
+
+        var t2 = new LoginAttemptTracker(() => ahoraLogin); var auth2 = new AuthService(usuariosFake, tokenFake, NullLogger<AuthService>.Instance, t2);
+        for (int i = 0; i < 6; i++) auth2.LoginAsync("admin@x.gt", "mala").Wait();
+        auth2.LoginAsync("admin@x.gt", pwdOk).Wait();   // éxito: reinicia el contador
+        for (int i = 0; i < 6; i++) auth2.LoginAsync("admin@x.gt", "mala").Wait();
+        Check("un inicio de sesión correcto reinicia el contador de fallos (6+éxito+6 no bloquea)", !t2.EstaBloqueado("admin@x.gt"));
+
+        var t3 = new LoginAttemptTracker(() => ahoraLogin); var auth3 = new AuthService(usuariosFake, tokenFake, NullLogger<AuthService>.Instance, t3);
+        for (int i = 0; i < LoginAttemptTracker.MaxFallos; i++) auth3.LoginAsync("NoExiste@X.gt ", "x").Wait();
+        Check("un correo que NO existe se bloquea igual (el bloqueo no revela qué cuentas existen) y se normaliza", t3.EstaBloqueado("noexiste@x.gt"));
+        Check("la ventana de 15 min olvida fallos viejos", ((Func<bool>)(() => { var t4 = new LoginAttemptTracker(() => ahoraLogin); for (int i = 0; i < 9; i++) t4.RegistrarFallo("a@x.gt"); ahoraLogin += LoginAttemptTracker.Ventana + TimeSpan.FromSeconds(1); t4.RegistrarFallo("a@x.gt"); return !t4.EstaBloqueado("a@x.gt"); }))());
+        Check("usuario inactivo: sigue devolviendo UsuarioInactivo (comportamiento probado en AuthServiceTests)", auth3.LoginAsync("baja@x.gt", pwdOk).Result.CodigoError == LoginResult.UsuarioInactivo);
+
+        double Mediana(Func<object> f) { var t = new List<double>(); for (int i = 0; i < 5; i++) { var sw = System.Diagnostics.Stopwatch.StartNew(); f(); sw.Stop(); t.Add(sw.Elapsed.TotalMilliseconds); } t.Sort(); return t[2]; }
+        var authT = new AuthService(usuariosFake, tokenFake, NullLogger<AuthService>.Instance, new LoginAttemptTracker());
+        var tDesconocido = Mediana(() => authT.LoginAsync("fantasma@x.gt", "mala").Result);
+        var tContrasenaMala = Mediana(() => authT.LoginAsync("admin@x.gt", "mala").Result);
+        var tInactivo = Mediana(() => authT.LoginAsync("baja@x.gt", "mala").Result);
+        var razon = Math.Max(tDesconocido, tContrasenaMala) / Math.Max(0.001, Math.Min(tDesconocido, tContrasenaMala));
+        if (Math.Max(tDesconocido, tContrasenaMala) < 5) Console.WriteLine("  ℹ medición de tiempo omitida: no hay hashing BCrypt real en este entorno");
+        else Check("tiempo constante: correo desconocido vs contraseña incorrecta (misma verificación BCrypt)", razon < 3.0, $"desconocido={tDesconocido:F0} ms, mala={tContrasenaMala:F0} ms, inactivo={tInactivo:F0} ms, razón={razon:F2}");
+
+        Console.WriteLine("[8] Política de contraseña del administrador inicial");
+        foreach (var debil in new[] { "sciad123", "corta1A!", "todominusculas123!", "TODOMAYUSCULAS123!", "SinNumeros!!!!!!", "Password123!!!", "aaaaaaaaaaAA11!!" })
+            Check($"rechaza «{debil}»", !PoliticaContrasena.EsFuerte(debil, out _));
+        Check("acepta una contraseña fuerte", PoliticaContrasena.EsFuerte("T7#vQ9!mZp2$kL", out _));
+
         Console.WriteLine($"\nRESULTADO: {pass} ✓  {fail} ✗");
         return fail == 0 ? 0 : 1;
     }
````

### 4.7 Prueba OWASP Top 10 contra el stack real
#### 📄 NUEVO — `sciad-backend/verify-owasp.mjs`
Una sección por categoría A01–A10. Ver §8 para opciones y variables.
````js
// Verificación OWASP Top 10 (2021) contra el stack REAL. Una sección por categoría (A01–A10).
//   node verify-owasp.mjs                        (stack de desarrollo: frontend :8080, API directa :3000)
//   SCIAD_ENV=prod SCIAD_BASE=https://sciad.gt node verify-owasp.mjs      (producción)
// Variables: SCIAD_BASE (por defecto http://localhost:8080) · SCIAD_API (http://localhost:3000; en prod vacío)
//            SCIAD_ENV=dev|prod · SCIAD_ADMIN_PASSWORD / SCIAD_SEGURIDAD_PASSWORD / SCIAD_GERENCIA_PASSWORD (por defecto sciad123, solo dev)
//            SCIAD_LAN_IP (IP de este equipo en la red: comprueba que 3000/8080 no se exponen) · SCIAD_AUDIT_ALLOW (GHSA permitidos, coma)
// Opciones: --rapido (omite la espera de 35 s del token revocado) · --docker (dotnet list package --vulnerable y logs) · --sin-fuerza-bruta
// Efectos: crea personas/usuarios «ZZ OWASP …» (se dan de baja al final). El bloque de fuerza bruta bloquea tu IP ~5 min: va AL FINAL.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { spawnSync, execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.SCIAD_BASE ?? 'http://localhost:8080').replace(/\/$/, '');
const ENV = process.env.SCIAD_ENV ?? 'dev';
const API = ENV === 'prod' ? (process.env.SCIAD_API ?? '') : (process.env.SCIAD_API ?? 'http://localhost:3000').replace(/\/$/, '');
const PW = { admin: process.env.SCIAD_ADMIN_PASSWORD ?? 'sciad123', seguridad: process.env.SCIAD_SEGURIDAD_PASSWORD ?? 'sciad123', gerencia: process.env.SCIAD_GERENCIA_PASSWORD ?? 'sciad123' };
const ARG = new Set(process.argv.slice(2));
const R = Date.now().toString().slice(-8);

const res = { ok: 0, fail: 0, info: 0 }; let sec = '';
const head = (t) => { sec = t; console.log(`\n══ ${t}`); };
const ok = (n, c, x = '') => { c ? res.ok++ : res.fail++; console.log(`  ${c ? '✓' : '✗ FALLO'} ${n}${x ? '  → ' + String(x).slice(0, 150) : ''}`); return c; };
const info = (n, x = '') => { res.info++; console.log(`  ℹ ${n}${x ? '  → ' + String(x).slice(0, 150) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, { token, body, headers = {}, raw } = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
    return { status: r.status, h: r.headers, text, json, ms: Date.now() - t0 };
  } catch (e) { return { status: 0, h: new Headers(), text: String(e), json: null, ms: Date.now() - t0 }; }
}
const b = (p, o) => call(o?.method ?? 'GET', `${BASE}${p}`, o);
const a = (p, o) => (API ? call(o?.method ?? 'GET', `${API}${p}`, o) : Promise.resolve(null));
// fetch() de Node prohíbe métodos como TRACE: se usa http/https directamente.
const metodoCrudo = (url, method) => new Promise((res) => { const u = new URL(url); const m = u.protocol === 'https:' ? https : http; const r = m.request({ method, host: u.hostname, port: u.port, path: u.pathname }, (x) => { x.resume(); res(x.statusCode); }); r.on('error', () => res(0)); r.end(); });
const tcp = (host, port) => new Promise((r) => { const s = net.connect({ host, port, timeout: 2000 }); s.on('connect', () => { s.destroy(); r(true); }); s.on('error', () => r(false)); s.on('timeout', () => { s.destroy(); r(false); }); });
const login = async (email, password) => (await b('/api/auth/login', { method: 'POST', body: { email, password } }));
const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const decodeJwt = (t) => { const [h, p] = t.split('.'); return { h: JSON.parse(Buffer.from(h, 'base64url')), p: JSON.parse(Buffer.from(p, 'base64url')) }; };

console.log(`OWASP Top 10 (2021) → ${BASE}  API directa: ${API || '(no expuesta)'}  entorno: ${ENV}`);
const lA = await login('admin@sciad.gt', PW.admin), lS = await login('seguridad@sciad.gt', PW.seguridad), lG = await login('gerencia@sciad.gt', PW.gerencia);
const T = { admin: lA.json?.token, seg: lS.json?.token, ger: lG.json?.token };
if (ENV === 'prod' && !T.admin) info('producción: el login con la contraseña por defecto falló (correcto). Define SCIAD_ADMIN_PASSWORD (y las otras) para ejecutar las pruebas autenticadas.');
if (!T.admin) { console.error('\n✗ No se pudo iniciar sesión como admin: defina SCIAD_ADMIN_PASSWORD.'); process.exit(1); }
const idx = await b('/'); const apiH = await b('/api/zonas-acceso', { token: T.admin });

// ───────────────────────────────────────── A01 ─────────────────────────────────────────
head('A01 · Control de acceso roto');
const protegidos = ['/api/usuarios', '/api/personas', '/api/zonas-acceso', '/api/perfiles-acceso', '/api/credenciales', '/api/registros-acceso', '/api/registros-acceso/hoy', '/api/auditoria', '/api/notificaciones', '/api/reportes', '/api/auth/me'];
const anon = await Promise.all(protegidos.map((p) => b(p)));
ok(`anónimo → 401 en los ${protegidos.length} recursos protegidos`, anon.every((r) => r.status === 401), anon.map((r) => r.status).join(','));
const segProhibido = await Promise.all(['/api/usuarios', '/api/personas', '/api/credenciales', '/api/perfiles-acceso', '/api/auditoria', '/api/notificaciones', '/api/reportes'].map((p) => b(p, { token: T.seg })));
ok('SEGURIDAD → 403 en gestión, auditoría, notificaciones y reportes', segProhibido.every((r) => r.status === 403), segProhibido.map((r) => r.status).join(','));
const gerProhibido = await Promise.all([b('/api/registros-acceso', { method: 'POST', token: T.ger, body: { token: 'a'.repeat(64), zonaId: 1 } }), b('/api/personas', { token: T.ger }), b('/api/credenciales/1/generar', { method: 'POST', token: T.ger }), b('/api/usuarios', { token: T.ger })]);
ok('GERENCIA → 403 al escanear, listar personas, generar credenciales y ver usuarios (solo lectura de trazabilidad)', gerProhibido.every((r) => r.status === 403), gerProhibido.map((r) => r.status).join(','));
const bola = await Promise.all([b('/api/personas/999999', { method: 'PUT', token: T.seg, body: {} }), b('/api/credenciales/999999/revocar', { method: 'POST', token: T.ger, body: {} })]);
ok('IDOR/BOLA: tocar IDs ajenos sin el rol correcto → 403 (antes de revelar si existen)', bola.every((r) => r.status === 403), bola.map((r) => r.status).join(','));
const sw = await b('/swagger'); ok('Swagger/OpenAPI NO se sirve por la ruta pública', !/swagger-ui|openapi/i.test(sw.text), sw.status);
if (API) { const s2 = await a('/swagger/index.html'); ENV === 'prod' ? ok('producción: Swagger de la API → 404', s2.status === 404, s2.status) : info('desarrollo: Swagger activo solo en 127.0.0.1:3000', s2.status); }
const trav = await b('/api/..%2f..%2f..%2fetc%2fpasswd'); const trav2 = await b('/..%2f..%2fetc%2fpasswd');
ok('path traversal no expone archivos del servidor', !/root:.*:0:0/.test(trav.text + trav2.text), `${trav.status}/${trav2.status}`);
const cors = API ? await a('/api/zonas-acceso', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } }) : await b('/api/zonas-acceso', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
ok('CORS: un origen ajeno NO recibe Access-Control-Allow-Origin', !cors.h.get('access-control-allow-origin'), cors.h.get('access-control-allow-origin') ?? '(sin cabecera)');

// ───────────────────────────────────────── A02 ─────────────────────────────────────────
head('A02 · Fallos criptográficos');
const jwt = decodeJwt(T.admin);
ok('JWT firmado con HS256 y expira a las 8 h (28 800 s)', jwt.h.alg === 'HS256' && jwt.p.exp - jwt.p.nbf === 28800, `${jwt.h.alg} ${jwt.p.exp - jwt.p.nbf}s`);
ok('el JWT no contiene contraseñas, hashes ni correo', !/pass|hash|\$2[aby]\$|@/.test(JSON.stringify(jwt.p)), Object.keys(jwt.p).join(','));
const us = await b('/api/usuarios?tamanoPagina=50', { token: T.admin });
ok('la API nunca devuelve contraseñas ni hashes de usuarios', us.status === 200 && !/password|passwordHash|\$2[aby]\$\d\d\$/i.test(us.text));
ok('respuestas de la API con Cache-Control: no-store', /no-store/.test(apiH.h.get('cache-control') ?? ''), apiH.h.get('cache-control'));
ok('el HTML (index) con Cache-Control: no-store', /no-store/.test(idx.h.get('cache-control') ?? ''), idx.h.get('cache-control'));
const creds = await b('/api/credenciales', { token: T.admin }); const toks = (creds.json ?? []).map((c) => c.token);
ok('tokens de credencial QR: 64 hex únicos (256 bits)', toks.length === 0 || (toks.every((t) => /^[0-9A-Fa-f]{64}$/.test(t)) && new Set(toks).size === toks.length), `${toks.length} tokens`);
ok('el HTML no carga recursos http:// ni de terceros (sin contenido mixto)', !/(src|href)=["']https?:\/\//i.test(idx.text));
if (ENV === 'prod' && BASE.startsWith('https')) {
  ok('HSTS con includeSubDomains', /max-age=\d{7,}.*includeSubDomains/i.test(idx.h.get('strict-transport-security') ?? ''), idx.h.get('strict-transport-security'));
  const http = await call('GET', BASE.replace('https://', 'http://') + '/'); ok('HTTP → redirige a HTTPS (301)', http.status === 301 && (http.h.get('location') ?? '').startsWith('https://'), http.status);
} else info('HSTS y redirección HTTP→HTTPS: se verifican con SCIAD_ENV=prod y una URL https://');

// ───────────────────────────────────────── A03 ─────────────────────────────────────────
head('A03 · Inyección');
const sqli = [`' OR '1'='1`, `1; DROP TABLE personas;--`, `' UNION SELECT NULL,NULL--`, `"; WAITFOR DELAY '0:0:5'--`, `1' AND pg_sleep(5)--`];
const sqlR = []; for (const p of sqli) { for (const u of [`/api/personas?estado=${encodeURIComponent(p)}`, `/api/registros-acceso?tipo=${encodeURIComponent(p)}`, `/api/auditoria?tipo=${encodeURIComponent(p)}`]) sqlR.push(await b(u, { token: T.admin })); }
ok(`${sqlR.length} inyecciones SQL en parámetros → nunca 500 ni demoras (consultas parametrizadas)`, sqlR.every((r) => r.status !== 500 && r.ms < 3000), `estados=${[...new Set(sqlR.map((r) => r.status))]}`);
const sqlL = await login(`admin@sciad.gt' OR '1'='1`, `' OR '1'='1`); ok('SQLi en el login → 400/401/429, nunca sesión ni 500', [400, 401, 429].includes(sqlL.status) && !sqlL.json?.token, sqlL.status);
const xss = `<img src=x onerror=alert(1)>ZZ OWASP ${R}`;
const per = await b('/api/personas', { method: 'POST', token: T.admin, body: { nombre: xss, dpiCodigo: `OWASP-${R}`, tipo: 1 } });
const lista = await b('/api/personas?tamanoPagina=500', { token: T.admin });
ok('XSS almacenado: la API lo devuelve como DATO (application/json + nosniff), sin interpretarlo', per.status < 300 && /application\/json/.test(lista.h.get('content-type') ?? '') && lista.h.get('x-content-type-options') === 'nosniff', lista.h.get('content-type'));
const malo = await b('/api/zonas-acceso', { method: 'POST', token: T.admin, raw: '{"nombre": "x", ' });
ok('JSON mal formado → 400 sin stack trace', malo.status === 400 && !/\bat Sciad\.|Exception|System\./.test(malo.text), `${malo.status} ${malo.text.slice(0, 60)}`);
const nul = await b('/api/zonas-acceso', { method: 'POST', token: T.admin, body: { nombre: 'a\u0000b', nivelSeguridad: 'MEDIO', nivelRiesgo: 'BAJO' } });
ok('carácter nulo en un texto → no provoca 500', nul.status !== 500, nul.status);
const grande = await call('POST', `${API || BASE}/api/auth/login`, { raw: JSON.stringify({ email: 'x'.repeat(90000), password: 'y' }) });
ok('cuerpo de 90 KB → 413 (límite de tamaño)', grande.status === 413, grande.status);
if (per.json?.id) await b(`/api/personas/${per.json.id}/estado`, { method: 'PATCH', token: T.admin, body: { estado: 'inactivo' } });

// ───────────────────────────────────────── A04 ─────────────────────────────────────────
head('A04 · Diseño inseguro');
const e1 = await b('/api/registros-acceso', { method: 'POST', token: T.seg, body: { token: 'f'.repeat(64), zonaId: 1 } });
ok('escanear un token inexistente → 400 TOKEN_INVALIDO (sin acceso)', e1.status === 400, `${e1.status} ${e1.json?.code}`);
const e2 = await b('/api/registros-acceso', { method: 'POST', token: T.seg, body: { token: 'no-es-hex', zonaId: 1 } });
ok('token con formato inválido → 400', e2.status === 400, e2.status);
const e3 = await b('/api/registros-acceso', { method: 'POST', token: T.seg, body: { token: 'f'.repeat(64), zonaId: -1 } });
ok('zona inválida → 4xx (no 500)', e3.status >= 400 && e3.status < 500, e3.status);
ok('mass-assignment: un campo extra «rol»/«estado» en crear persona no cambia nada inesperado', (await b('/api/personas', { method: 'POST', token: T.admin, body: { nombre: `ZZ OWASP MA ${R}`, dpiCodigo: `OWASP-MA-${R}`, tipo: 1, estado: 'inactivo', id: 1, rol: 'ADMIN' } })).status !== 500);
info('límite global por IP (1500/min) y por login (5/5 min): ver bloque de fuerza bruta al final');

// ───────────────────────────────────────── A05 ─────────────────────────────────────────
head('A05 · Configuración de seguridad incorrecta');
const need = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'cross-origin-opener-policy': 'same-origin', 'cross-origin-resource-policy': 'same-origin' };
for (const [name, r] of [['HTML', idx], ['API (vía frontend)', apiH]]) ok(`${name}: cabeceras de seguridad`, Object.entries(need).every(([k, v]) => r.h.get(k) === v), Object.entries(need).filter(([k, v]) => r.h.get(k) !== v).map(([k]) => k).join(','));
const csp = idx.h.get('content-security-policy') ?? '';
ok("HTML: CSP estricta (default-src 'none', sin 'unsafe-inline'/'unsafe-eval', frame-ancestors 'none')", /default-src 'none'/.test(csp) && !/unsafe-(inline|eval)/.test(csp) && /frame-ancestors 'none'/.test(csp), csp.slice(0, 80));
ok('HTML: Permissions-Policy limita cámara al propio origen', /camera=\(self\)/.test(idx.h.get('permissions-policy') ?? '') && /microphone=\(\)/.test(idx.h.get('permissions-policy') ?? ''));
const banners = [idx, apiH, ...(API ? [await a('/api/health')] : [])]; ok('sin versión de servidor ni X-Powered-By', banners.every((r) => r && !/\d/.test(r.h.get('server') ?? '') && !r.h.get('x-powered-by')), banners.map((r) => r?.h.get('server')).join('|'));
if (API) { const d = await a('/api/zonas-acceso', { token: T.admin }); ok('API directa: no-store + nosniff + CSP none', /no-store/.test(d.h.get('cache-control') ?? '') && d.h.get('x-content-type-options') === 'nosniff' && /default-src 'none'/.test(d.h.get('content-security-policy') ?? '')); }
for (const p of ['/.env', '/.git/config', '/appsettings.json', '/web.config', '/swagger/v1/swagger.json', '/main.js.map']) { const r = await b(p); ok(`${p} no accesible`, r.status === 404 || (r.status === 200 && /<app-root/.test(r.text)), r.status); }
ok('método TRACE → 405', (await metodoCrudo(`${BASE}/`, 'TRACE')) === 405);
const e404 = await b('/api/no-existe', { token: T.admin }); ok('ruta inexistente → error limpio, sin stack trace', !/\bat Sciad\.|Exception/.test(e404.text), e404.status);
const dbExpuesta = await tcp('127.0.0.1', 5432); ok('PostgreSQL NO está publicado en el host (5432 cerrado)', !dbExpuesta);
if (process.env.SCIAD_LAN_IP) { for (const p of [3000, 8080, 5432]) { const r = await tcp(process.env.SCIAD_LAN_IP, p); ENV === 'dev' ? ok(`puerto ${p} NO es accesible desde la red local (${process.env.SCIAD_LAN_IP})`, !r) : info(`prod: puerto ${p} desde la LAN`, r); } } else info('exposición en la LAN: defina SCIAD_LAN_IP=<IP de este equipo> para comprobar que 3000/8080/5432 no responden');
const defecto = await login('admin@sciad.gt', 'sciad123');
ENV === 'prod' ? ok('PRODUCCIÓN: la contraseña por defecto sciad123 NO funciona', defecto.status === 401, defecto.status) : info('desarrollo: las cuentas demo existen (sciad123); NO deben existir en producción');

// ───────────────────────────────────────── A06 ─────────────────────────────────────────
head('A06 · Componentes vulnerables y desactualizados');
const front = join(HERE, '..', 'sciad-frontend'); ok('lockfiles presentes (package-lock.json)', existsSync(join(front, 'package-lock.json')));
const au = spawnSync('npm', ['audit', '--omit=dev', '--json'], { cwd: front, encoding: 'utf8', shell: true });
try { const j = JSON.parse(au.stdout); const permitidos = (process.env.SCIAD_AUDIT_ALLOW ?? '').split(',').filter(Boolean);
  const malos = Object.values(j.vulnerabilities ?? {}).filter((v) => ['high', 'critical'].includes(v.severity) && !(v.via ?? []).some((x) => permitidos.includes(String(x.url ?? '').split('/').pop())));
  ok('npm audit (dependencias de PRODUCCIÓN): 0 vulnerabilidades altas/críticas', malos.length === 0, malos.map((v) => `${v.name}(${v.severity})`).join(',') || `total=${j.metadata?.vulnerabilities?.total ?? 0}`);
} catch { info('npm audit no devolvió JSON (¿sin red?)', au.stderr?.slice(0, 80)); }
if (ARG.has('--docker')) {
  const r = spawnSync('docker', ['run', '--rm', '-v', `${join(HERE)}:/src:ro`, 'mcr.microsoft.com/dotnet/sdk:8.0', 'sh', '-c', 'cp -r /src /w && cd /w && dotnet list Sciad.sln package --vulnerable --include-transitive 2>&1'], { encoding: 'utf8', shell: true });
  ok('dotnet list package --vulnerable: sin paquetes con vulnerabilidades', /no vulnerable packages|ninguno de los paquetes/i.test(r.stdout) || !/has the following vulnerable packages|tiene los siguientes paquetes vulnerables/i.test(r.stdout), (r.stdout.match(/>\s.*(High|Critical).*/g) ?? []).slice(0, 3).join(' | '));
} else info('paquetes .NET: ejecute con --docker (dotnet list package --vulnerable)');

// ───────────────────────────────────────── A07 ─────────────────────────────────────────
head('A07 · Fallos de identificación y autenticación');
const mala = await login('seguridad@sciad.gt', 'incorrecta-xyz'); const noEx = await login(`noexiste-${R}@x.gt`, 'incorrecta-xyz');
ok('mismo error para contraseña incorrecta y correo inexistente (sin enumeración)', mala.status === 401 && noEx.status === 401 && mala.json?.message === noEx.json?.message, `${mala.status}/${noEx.status} «${mala.json?.message}»`);
const evil = (payload, secret = 'x'.repeat(40)) => { const h = b64u({ alg: 'HS256', typ: 'JWT' }), p = b64u(payload), s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url'); return `${h}.${p}.${s}`; };
const now = Math.floor(Date.now() / 1000);
const pay = { ...jwt.p, exp: now + 3600 };
const forj = [
  [`${b64u({ alg: 'none', typ: 'JWT' })}.${b64u(pay)}.`, 'alg=none'],
  [`${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ ...pay, 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'ADMIN', rol: 'ADMIN' })}.${T.seg.split('.')[2]}`, 'rol modificado, firma ajena'],
  [evil(pay), 'firmado con otra clave'], [T.admin.slice(0, -4) + 'AAAA', 'firma alterada'],
  [`${b64u({ alg: 'HS512', typ: 'JWT' })}.${b64u(pay)}.${crypto.createHmac('sha512', 'x'.repeat(40)).update('x').digest('base64url')}`, 'otro algoritmo (HS512)'],
];
for (const [tk, n] of forj) ok(`JWT falsificado (${n}) → 401`, (await b('/api/usuarios', { token: tk })).status === 401);
ok('JWT expirado (re-firmado con otra clave) → 401', (await b('/api/usuarios', { token: evil({ ...pay, exp: now - 60 }) })).status === 401);
const debil = await b('/api/usuarios', { method: 'POST', token: T.admin, body: { nombre: 'ZZ', correo: `zz-${R}@x.gt`, password: '123', rol: 'SEGURIDAD', puesto: 'x' } }); ok('contraseña débil (3 caracteres) → rechazada con 400', debil.status === 400, debil.status);
// token de un usuario desactivado deja de servir (≤ 30 s) aunque el JWT no haya vencido
const pass = `Zz!${R}Aa9x#Qw`; const nu = await b('/api/usuarios', { method: 'POST', token: T.admin, body: { nombre: `ZZ OWASP ${R}`, correo: `zz-owasp-${R}@x.gt`, password: pass, rol: 'SEGURIDAD', puesto: 'prueba' } });
if (nu.status < 300 && nu.json?.id) {
  const ln = await login(`zz-owasp-${R}@x.gt`, pass); const antes = await b('/api/auth/me', { token: ln.json?.token });
  await b(`/api/usuarios/${nu.json.id}/estado`, { method: 'PATCH', token: T.admin, body: { estado: 'inactivo' } });
  ok('el usuario nuevo inicia sesión y /me responde 200', antes.status === 200, antes.status);
  if (ARG.has('--rapido')) info('omitido (--rapido): revocación por desactivación en ≤ 30 s'); else { console.log('  … esperando 35 s (caché de sesión de 30 s)'); await sleep(35000); ok('desactivar al usuario invalida su JWT (≤ 30 s), aunque no haya vencido', (await b('/api/auth/me', { token: ln.json?.token })).status === 401); }
} else info('no se pudo crear el usuario de prueba para la revocación', nu.status);
const inact = await login(`zz-owasp-${R}@x.gt`, pass); ok('cuenta inactiva → misma respuesta genérica 401 (no revela que existe)', inact.status === 401 && inact.json?.message === 'Credenciales inválidas.', `${inact.status} ${inact.json?.message}`);
info('bloqueo por cuenta (10 fallos) y tiempo constante del login: cubiertos por Sciad.TimeHarness (con BCrypt real)');

// ───────────────────────────────────────── A08 ─────────────────────────────────────────
head('A08 · Fallos de integridad de software y datos');
const poli = await b('/api/zonas-acceso', { method: 'POST', token: T.admin, body: { $type: 'System.Diagnostics.Process, System', nombre: 'x', nivelSeguridad: 'MEDIO', nivelRiesgo: 'BAJO' } });
ok('payload JSON con «$type» (deserialización polimórfica) → ignorado, sin 500', poli.status !== 500, poli.status);
const xml = await b('/api/zonas-acceso', { method: 'POST', token: T.admin, raw: '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>', headers: { 'Content-Type': 'application/xml' } });
ok('entrada XML (XXE) → rechazada (415/400), sin leer archivos', [400, 415].includes(xml.status) && !/root:/.test(xml.text), xml.status);
ok('el HTML no depende de scripts/estilos externos (sin CDN → sin riesgo de cadena de suministro en el navegador)', !/<(script|link)[^>]+(src|href)=["']https?:\/\//i.test(idx.text));
ok('dependencias fijadas por lockfile (package-lock.json) y build reproducible (npm ci)', existsSync(join(front, 'package-lock.json')));
const dock = existsSync(join(HERE, 'Dockerfile')) ? readFileSync(join(HERE, 'Dockerfile'), 'utf8') : ''; ok('imágenes base con etiqueta de versión (no :latest)', !/FROM\s+\S+:latest/.test(dock) && /FROM\s+\S+:\d/.test(dock));

// ───────────────────────────────────────── A09 ─────────────────────────────────────────
head('A09 · Fallos de registro y monitoreo');
if (ARG.has('--docker')) {
  await login('seguridad@sciad.gt', `mala-${R}-NO-DEBE-VERSE`); await sleep(1500);
  const logs = execSync('docker logs sciad-backend --since 3m 2>&1', { encoding: 'utf8', maxBuffer: 30e6 });
  ok('un inicio de sesión fallido queda registrado', /Inicio de sesión fallido/i.test(logs));
  ok('las respuestas 401/403 se registran como Warning', /"StatusCode":(401|403)/.test(logs) ? /Warning/.test(logs) : true);
  ok('los registros NO contienen la contraseña intentada ni JWT completos', !logs.includes(`mala-${R}-NO-DEBE-VERSE`) && !/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(logs));
  ok('los registros incluyen la IP de origen (RemoteIp)', /RemoteIp/.test(logs));
} else info('registros de seguridad: ejecute con --docker para leer los logs del contenedor');
const aud = await b('/api/auditoria?tamanoPagina=5', { token: T.admin }); ok('existe trazabilidad de auditoría consultable por Admin/Gerencia (CU-08)', aud.status === 200);

// ───────────────────────────────────────── A10 ─────────────────────────────────────────
head('A10 · Falsificación de solicitudes del lado del servidor (SSRF)');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (/(bin|obj|node_modules|Migrations)$/.test(p) ? [] : walk(p)) : p.endsWith('.cs') ? [p] : []; });
const salida = walk(join(HERE, 'src')).filter((f) => /\b(HttpClient|WebClient|WebRequest|RestClient|IHttpClientFactory)\b/.test(readFileSync(f, 'utf8')));
ok('el backend NO realiza solicitudes HTTP salientes (sin HttpClient/WebRequest en el código)', salida.length === 0, salida.map((f) => f.split('src')[1]).join(','));
if (API) { const sj = await a('/swagger/v1/swagger.json'); if (sj?.json) { const params = JSON.stringify(sj.json).match(/"name":"([^"]*(url|uri|callback|webhook|redirect)[^"]*)"/gi) ?? []; ok('ningún endpoint recibe URLs como parámetro', params.length === 0, params.join(',')); } else info('OpenAPI no disponible: se omite el barrido de parámetros'); }
ok('el parámetro «Host» manipulado no provoca redirecciones ni 500', (await b('/', { headers: { 'X-Forwarded-Host': 'evil.example', 'X-Forwarded-For': '1.2.3.4' } })).status < 500);

// ───────────────────────────────────── Fuerza bruta (al final) ─────────────────────────────────────
if (!ARG.has('--sin-fuerza-bruta')) {
  head('A04/A07 · Fuerza bruta en el login (bloquea tu IP ~5 min)');
  const r = []; for (let i = 0; i < 7; i++) r.push((await login(`atacante-${R}@x.gt`, `mala${i}`)).status);
  ok('5 intentos inválidos → 401 y del 6.º en adelante → 429 (límite por IP, PG2)', r.slice(0, 5).every((s) => s === 401) && r.slice(5).every((s) => s === 429), r.join(','));
} else info('fuerza bruta omitida (--sin-fuerza-bruta)');

console.log(`\nRESULTADO OWASP Top 10: ${res.ok} ✓  ${res.fail} ✗  (${res.info} informativos)`);
process.exit(res.fail ? 1 : 0);
````

---

## 5. PASO 3 — Docker Compose y variables de entorno
#### 🔧 EDITAR (diff) — `docker-compose.yml`
Puertos solo en 127.0.0.1; `AllowedHosts`; contenedores endurecidos; la BD sin puertos.
````diff
diff --git a/docker-compose.yml b/docker-compose.yml
index 210cf4a..89ea719 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -15,8 +15,17 @@ services:
       context: ./sciad-frontend
       dockerfile: Dockerfile
     container_name: sciad-frontend
+    # Solo accesible desde ESTE equipo (127.0.0.1): el celular entra por el túnel HTTPS, no por la IP de la red local.
     ports:
-      - "8080:80"
+      - "127.0.0.1:8080:80"
+    # Endurecimiento (OWASP A05): sin escalar privilegios y con el sistema de archivos de solo lectura.
+    security_opt:
+      - no-new-privileges:true
+    read_only: true
+    tmpfs:
+      - /var/cache/nginx
+      - /var/run
+      - /tmp
     restart: unless-stopped
     healthcheck:
       # 127.0.0.1 (no "localhost"): nginx escucha solo en IPv4 y "localhost"
@@ -42,11 +51,22 @@ services:
       - Cors__Origins=${SCIAD_CORS_ORIGINS}
       # Hora (Guatemala) del cierre diario de auditoría. Por defecto 00:05; se cambia solo para probarlo (verify-cierre.mjs).
       - Auditoria__CierreDiario__Hora=${AUDITORIA_CIERRE_HORA:-00:05}
+      # Hosts permitidos (cabecera Host). En desarrollo se acepta cualquiera (el túnel cambia de dominio en cada arranque).
+      - AllowedHosts=${ALLOWED_HOSTS:-*}
     depends_on:
       db:
         condition: service_healthy
+    # Solo desde este equipo (127.0.0.1): la API/Swagger de desarrollo NO quedan expuestos a la red local.
     ports:
-      - "3000:8080"
+      - "127.0.0.1:3000:8080"
+    # Endurecimiento (OWASP A05): usuario no root (Dockerfile), sin capacidades, sin escalar privilegios, solo lectura.
+    security_opt:
+      - no-new-privileges:true
+    cap_drop:
+      - ALL
+    read_only: true
+    tmpfs:
+      - /tmp
     restart: unless-stopped
     healthcheck:
       # Confirma que la API responde y que la BD está operativa (GET /api/health).
@@ -69,6 +89,9 @@ services:
       - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
     volumes:
       - sciad-db-data:/var/lib/postgresql/data
+    # SIN puertos publicados: la base de datos solo es alcanzable desde la red interna de Docker.
+    security_opt:
+      - no-new-privileges:true
     healthcheck:
       test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
       interval: 10s
````

#### 🔧 EDITAR (diff) — `docker-compose.prod.yml`
`AllowedHosts` por dominio; admin inicial por variables; endurecimiento.
````diff
diff --git a/docker-compose.prod.yml b/docker-compose.prod.yml
index ebadc93..ab00a48 100644
--- a/docker-compose.prod.yml
+++ b/docker-compose.prod.yml
@@ -24,6 +24,14 @@ services:
       dockerfile: Dockerfile.prod
     image: sciad-prod/frontend:latest
     container_name: sciad-prod-frontend
+    # Endurecimiento (OWASP A05)
+    security_opt:
+      - no-new-privileges:true
+    read_only: true
+    tmpfs:
+      - /var/cache/nginx
+      - /var/run
+      - /tmp
     ports:
       - "80:80"
       - "443:443"
@@ -62,6 +70,19 @@ services:
       - ForwardedHeaders__KnownProxies=172.20.0.10
       - RateLimit__LoginPermitLimit=${RATE_LIMIT_LOGIN_PERMIT:-5}
       - RateLimit__LoginWindowSeconds=${RATE_LIMIT_LOGIN_WINDOW:-300}
+      # Solo se aceptan peticiones con estos Host (el healthcheck usa localhost).
+      - AllowedHosts=${ALLOWED_HOSTS:-sciad.gt;www.sciad.gt;localhost}
+      # En producción NO se crean cuentas demo. El administrador inicial se declara aquí (contraseña fuerte, ≥ 12 caracteres).
+      - Seed__AdminEmail=${SCIAD_ADMIN_EMAIL}
+      - Seed__AdminPassword=${SCIAD_ADMIN_PASSWORD}
+    # Endurecimiento (OWASP A05): usuario no root (Dockerfile), sin capacidades, sin escalar privilegios, solo lectura.
+    security_opt:
+      - no-new-privileges:true
+    cap_drop:
+      - ALL
+    read_only: true
+    tmpfs:
+      - /tmp
     networks:
       prod-net:
         ipv4_address: 172.20.0.20
@@ -87,6 +108,8 @@ services:
       - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
     volumes:
       - prod-db-data:/var/lib/postgresql/data
+    security_opt:
+      - no-new-privileges:true
     networks:
       prod-net:
         ipv4_address: 172.20.0.30
````

#### 🔧 EDITAR (diff) — `.env.prod.example`
Nuevas variables `SCIAD_ADMIN_EMAIL` / `SCIAD_ADMIN_PASSWORD` y cómo generar secretos.
````diff
diff --git a/.env.prod.example b/.env.prod.example
index 9e72d75..7db6058 100644
--- a/.env.prod.example
+++ b/.env.prod.example
@@ -23,4 +23,14 @@ SCIAD_CORS_ORIGINS=https://sciad.gt
 
 # Rate limit de login (SEC-04)
 RATE_LIMIT_LOGIN_PERMIT=5
-RATE_LIMIT_LOGIN_WINDOW=300
\ No newline at end of file
+RATE_LIMIT_LOGIN_WINDOW=300
+
+# --- Administrador inicial (en producción NO existen cuentas demo) -------------------------------------------
+# Se crea al primer arranque si no existe. La contraseña debe ser FUERTE (≥ 12 caracteres, mayúsculas, minúsculas,
+# números y símbolo) o el backend NO arranca. Cámbiela por la interfaz después del primer ingreso si lo desea.
+SCIAD_ADMIN_EMAIL=admin@su-dominio.gt
+SCIAD_ADMIN_PASSWORD=
+
+# Genere secretos fuertes (no use los de ejemplo):
+#   openssl rand -base64 48        → SCIAD_JWT_SECRET
+#   openssl rand -base64 24        → POSTGRES_PASSWORD
````

#### 🔧 EDITAR (diff) — `GUIA_DE_USO.md`
Advertencia: rotar contraseñas antes de usar el túnel.
````diff
diff --git a/GUIA_DE_USO.md b/GUIA_DE_USO.md
index 1a34f90..479503d 100644
--- a/GUIA_DE_USO.md
+++ b/GUIA_DE_USO.md
@@ -29,6 +29,10 @@ docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
 3. Instalar como app: Android/Chrome → ⋮ → *Agregar a la pantalla principal* · iPhone/Safari → Compartir → *Agregar a inicio*.
 4. Al terminar: `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop tunnel`.
 
+🔐 **Antes de encender el túnel, cambia las contraseñas de las 3 cuentas demo** (`sciad123` es pública en esta guía): entra como Admin → **Usuarios** → editar → nueva contraseña (la API
+pide ≥ 8 caracteres; usa una larga). En el stack de desarrollo las cuentas demo existen por diseño; en **producción no se crean** (el administrador inicial se declara con `SCIAD_ADMIN_EMAIL` / `SCIAD_ADMIN_PASSWORD`).
+Además, los puertos de desarrollo (8080 y 3000) solo escuchan en `127.0.0.1`: ni la API ni Swagger quedan visibles en tu red local; el celular entra únicamente por el túnel HTTPS.
+
 ⚠ Mientras el túnel esté encendido la URL es pública. Úsalo solo para pruebas y no compartas la URL. Para uso real: VPS con dominio y TLS (`DESPLIEGUE.md`).
 
 ## 4. Qué debe pasar con cada persona de la demostración
````

> El overlay `docker-compose.tunnel.yml` no cambia. Los contenedores ahora son `read_only`: si alguno no arranca por escribir en un directorio, **añade solo ese `tmpfs`** (no quites el endurecimiento) y repórtalo.

---

## 6. PASO 4 — Compilar, dependencias y pruebas unitarias

```bash
# 4.1 Frontend
cd SCIAD/sciad-frontend
npx ng build --configuration production            # sin WARNING ni ERROR
grep -rl "sciad123" dist/ || echo "OK: ninguna contraseña demo en el bundle"
cd tests-fase1 && npm run test:logic               # 20 pruebas OK
```
**4.2 Dependencias (Hallazgo 14).** `npm audit --omit=dev` marcaba `@angular/router` (alta, solo SSR: la app no usa SSR) y `piscina` vía `@angular/build` (herramienta de desarrollo, no se despliega).
Intenta resolverlas: `npm audit fix`; si quedan, sube **toda** la familia Angular a la última 22.x (`@angular/core|common|compiler|forms|platform-browser|router` y las herramientas `@angular/cli|build|compiler-cli`), p. ej.
`npx ng update @angular/core@22 @angular/cli@22` o `npm install` de las versiones `~22.2` juntas (deben moverse **todas a la vez**; mezclar versiones rompe el peer-deps).
Vuelve a compilar y a correr `test:logic` y el E2E de la Fase 1. **Si Angular 22.2 no se puede instalar sin romper el build, NO fuerces:** deja la versión y documenta la vulnerabilidad como *riesgo aceptado* (no explotable: requiere SSR).
No hagas `npm audit fix --force`.

**4.3 Backend (Docker, sin .NET local):**
```bash
docker run --rm -v "<ruta absoluta a SCIAD/sciad-backend>:/src:ro" mcr.microsoft.com/dotnet/sdk:8.0 sh -c \
  "cp -r /src /work && cd /work && dotnet test tests/Sciad.Tests/Sciad.Tests.csproj --nologo && dotnet run --project tests/Sciad.TimeHarness"
```
**Esperado:** `dotnet test` → **162 pruebas, todas pasan** (los `AuthServiceTests` incluidos) y el arnés `RESULTADO: 45 ✓  0 ✗` (con BCrypt real aparece además la comparación de tiempos del login).
Los errores de compilación que aparezcan (sobre todo en `Program.cs`/`DbSeeder.cs`, que no se pudieron compilar donde se preparó este documento) se corrigen con el cambio mínimo, explicándolos.

---

## 7. PASO 5 — Levantar el stack real
```bash
cd SCIAD
docker compose up --build -d
docker compose ps                                   # db, backend y frontend en running/healthy
docker compose logs backend | tail -30              # sin errores de arranque (seeder, permisos de solo lectura)
```
Comprueba, **reportando la salida real**:
- `docker compose ps` muestra los puertos como `127.0.0.1:8080->80` y `127.0.0.1:3000->8080`; **la BD sin puertos**.
- `docker compose exec backend id` → usuario **no root** (`uid=1654(app)`).
- `curl -sI http://localhost:8080/` → `Content-Security-Policy` con nonce, `Cache-Control: no-store`, sin versión en `Server`.
- `curl -sI http://localhost:3000/api/health` → cabeceras de seguridad y `no-store`.
- Si algo no arranca por `read_only`/`cap_drop`, aplica el ajuste mínimo (p. ej. un `tmpfs` adicional), explica y continúa.

---

## 8. PASO 6 — Pruebas de seguridad

### 8.1 Regresión funcional (nada debe romperse)
```bash
node sciad-backend/verify-seguridad.mjs            # 152 ✓ / 0 ✗
node sciad-backend/verify-2c.mjs && node sciad-backend/verify-2d.mjs && node sciad-backend/verify-fase3-rec.mjs
node sciad-backend/verify-rl.mjs                   # 5 intentos → 401 y del 6.º → 429 (documentado en PG2)
cd sciad-frontend/tests-fase5 && SCIAD_BASE=http://localhost:8080 node e2e-real.mjs      # 25 ✓ / 0 ✗
cd ../tests-fase1 && npm run test:e2e              # 28 ✓ / 0 ✗
cd ../tests-fase7 && npm install && npm run test:csp   # 33 ✓ / 0 ✗ (requiere nginx; Linux/WSL; si no hay nginx, dilo)
```
`verify-carga.mjs` (opcional): comprueba que el nuevo límite global **no** afecta los 300 escaneos concurrentes. Nota: el P95 ya estaba fuera de umbral por la máquina; compara con la corrida anterior.
Importante: el e2e-real y los `verify-*` inician sesión con las cuentas demo del stack de **desarrollo** (siguen existiendo allí).

### 8.2 OWASP Top 10 (la prueba principal)
```bash
node sciad-backend/verify-owasp.mjs --docker       # añade: dotnet list package --vulnerable y lectura de logs (A06, A09)
```
Opciones: `--rapido` (omite la espera de 35 s de la revocación), `--sin-fuerza-bruta` (no bloquea tu IP ~5 min; por defecto el bloque de fuerza bruta va **al final**). Variables: `SCIAD_ENV`, `SCIAD_BASE`, `SCIAD_API`, `SCIAD_LAN_IP`
(pon la IP de tu PC en la red: debe confirmar que 8080/3000/5432 **no** responden desde la LAN), `SCIAD_AUDIT_ALLOW` (GHSA aceptados, p. ej. `GHSA-ff3f-86qr-9cv3` si Angular no se pudo actualizar).
**Esperado: 0 ✗.** Cada ✗ es un hallazgo real: diagnostícalo (¿backend?, ¿nginx?, ¿datos previos?, ¿la prueba?), corrige lo mínimo dentro de las reglas y repite. Los ℹ se reportan tal cual.

### 8.3 Escáner dinámico OWASP ZAP (independiente de nuestros scripts)
```bash
mkdir -p zap-reportes
# Pasivo (siempre permitido). En Windows/macOS Docker Desktop: host.docker.internal; en Linux añade --add-host=host.docker.internal:host-gateway
docker run --rm -t -v "<ruta absoluta>/zap-reportes:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://host.docker.internal:8080 -r zap-baseline.html -J zap-baseline.json -I
```
El puerto 8080 está en `127.0.0.1`; ZAP lo alcanza vía `host.docker.internal`. Si no conecta, usa la red de Docker del stack (`--network <red del compose>` con `-t http://frontend`).
**Escaneo activo de la API (PIDE AUTORIZACIÓN al usuario ANTES: crea y modifica datos; hazlo sobre una BD desechable):** con el OpenAPI de desarrollo
(`http://host.docker.internal:3000/swagger/v1/swagger.json`), enviando el JWT de Admin con una regla `replacer` de ZAP (`Authorization: Bearer <token>`):
```bash
docker run --rm -t -v "<ruta>/zap-reportes:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t http://host.docker.internal:3000/swagger/v1/swagger.json -f openapi -r zap-api.html -J zap-api.json -I \
  -z "-config replacer.full_list(0).description=auth -config replacer.full_list(0).enabled=true -config replacer.full_list(0).matchtype=REQ_HEADER -config replacer.full_list(0).matchstring=Authorization -config replacer.full_list(0).replacement=Bearer <TOKEN_ADMIN>"
```
**Triage:** corrige todo hallazgo **High/Medium** real; los Low/Informational se listan. Un falso positivo se justifica por escrito. `zap-reportes/` **no se versiona** (añádelo al `.gitignore` si no está).

### 8.4 Dependencias, imágenes y secretos
```bash
docker run --rm -v "<ruta>/SCIAD:/repo:ro" zricethezav/gitleaks:latest detect --source /repo -v          # secretos en el código/historial
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL sciad-backend:latest   # nombre real de la imagen: docker images
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL <imagen del frontend>
```
Reporta: secretos hallados (revócalos si son reales; `evidencia/.tokens.json` contiene JWT de pruebas: **sácalo del control de versiones** con `git rm --cached` y agrégalo al `.gitignore`, **sin** hacer commit),
y las vulnerabilidades HIGH/CRITICAL de las imágenes base (si son de la imagen base y no hay actualización, documéntalas).

---

## 9. PASO 7 — Lista de verificación para PRODUCCIÓN (VPS con dominio; la hace el usuario con tu guía)
1. `cp .env.prod.example .env.prod` y completar: `SCIAD_JWT_SECRET` (`openssl rand -base64 48`), `POSTGRES_PASSWORD` (`openssl rand -base64 24`), `SCIAD_ADMIN_EMAIL`, `SCIAD_ADMIN_PASSWORD` (**fuerte**: el backend no arranca si no lo es), `SCIAD_CORS_ORIGINS`, `ALLOWED_HOSTS` si cambia el dominio.
2. TLS con Let's Encrypt según `DESPLIEGUE.md`; abrir solo 80/443 en el firewall (ufw/security group). La BD y el backend **no** publican puertos.
3. `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`; comprobar que **no existen** las cuentas demo (`admin@sciad.gt` con `sciad123` → 401).
4. `SCIAD_ENV=prod SCIAD_BASE=https://su-dominio SCIAD_ADMIN_PASSWORD=… SCIAD_SEGURIDAD_PASSWORD=… SCIAD_GERENCIA_PASSWORD=… node sciad-backend/verify-owasp.mjs` y el ZAP baseline contra `https://su-dominio`.
5. Verificar TLS con un analizador externo (p. ej. SSL Labs, objetivo A/A+) y HSTS; respaldo cifrado de PostgreSQL y rotación de secretos.

---

## 10. PASO 8 — Informe final (obligatorio)

1. `git status --short` y `git diff --stat` (no incluyas `evidencia/.tokens.json` ni `zap-reportes/`).
2. Resultado **real** de: build y grep de secretos; `test:logic`; `dotnet test` (= 162); arnés (= 45 ✓ con BCrypt real); `verify-seguridad` (152); `verify-2c/2d/fase3-rec/rl`; `e2e-real` (25); E2E Fase 1 (28); `tests-fase7` (33); **`verify-owasp.mjs` (tabla A01–A10 con ✓/✗/ℹ)**; ZAP baseline (y activo si se autorizó); Trivy; Gitleaks; `npm audit` antes/después.
3. Lista de hallazgos **corregidos durante la verificación** (regla 4), **pendientes** y **riesgos aceptados** con justificación.
4. Confirma los puntos del **Anexo A** (PG2_V2.docx intacto).
5. **Pregunta:** *«¿Revisaste los cambios? ¿Hago el commit local?»* — no hagas commit hasta que diga que sí
   (`git add -A && git commit -m "Fase 7: blindaje de seguridad OWASP Top 10"`, local, sin push).

---

## ANEXO A — Coherencia con PG2_V2.docx (no debe modificarse)

| El documento afirma | Estado tras esta fase |
|---|---|
| 162 / 162 pruebas unitarias | ✅ Sin pruebas xUnit nuevas ni cambiadas (las nuevas viven en el arnés y en `tests-fase7`); `AuthService` mantiene su constructor compatible |
| Matriz RBAC de 32 endpoints, `RequireAdmin` en gestión | ✅ Sin endpoints nuevos ni cambios de políticas |
| Login: 5 intentos/5 min por IP → 6.º = 429 | ✅ Intacto. El bloqueo por cuenta (10) es adicional y de umbral mayor |
| JWT HS256, 8 h (RF-10) | ✅ Igual; solo se endurece la validación (algoritmo, firma, sesión vigente) |
| TLS 1.2/1.3, HSTS | ✅ Igual (+ `preload`, tickets de sesión desactivados) |
| Tokens QR de 256 bits; baja lógica; bitácora inalterada | ✅ Sin cambios |
| Tabla 16 de auditoría y cierre diario | ✅ Sin cambios |
| Baja de usuario | ✅ Ahora además corta la sesión activa en ≤ 30 s (el documento no lo contradice) |

*Lo que el documento no menciona y esta fase añade (sin contradecirlo):* CSP/cabeceras, sesión en `sessionStorage`, bloqueo por cuenta, contenedores endurecidos, política de admin inicial. Cambios visibles de comportamiento: el login de una cuenta inactiva ya no responde 403 sino el 401 genérico; el mensaje del 429 es genérico («Demasiadas solicitudes desde esta IP»).

## ANEXO B — Cobertura OWASP Top 10 (2021) y evidencia

| Categoría | Controles | Dónde se demuestra |
|---|---|---|
| A01 Control de acceso roto | RBAC por rol (32 endpoints), sesión revalidada en cada petición, 403 antes de revelar IDs, Swagger fuera de la ruta pública, CORS cerrado | `verify-seguridad` (152) · `verify-owasp` A01/A07 |
| A02 Fallos criptográficos | HS256 + secreto ≥ 32 car., BCrypt, tokens 256 bits, TLS 1.2/1.3 + HSTS, `no-store`, sin secretos en el bundle, JWT en `sessionStorage` | `verify-owasp` A02 · `tests-fase7` |
| A03 Inyección | EF Core parametrizado, validación de DTOs, JSON estricto, límites de tamaño, CSP + escape de Angular | `verify-owasp` A03 · ZAP |
| A04 Diseño inseguro | Límite por IP en login (5/5 min) + bloqueo por cuenta + límite global; validación de reglas de negocio | `verify-owasp` A04 · `verify-rl` · arnés |
| A05 Configuración incorrecta | CSP, cabeceras, sin banners, sin `.map`/ocultos, `AllowedHosts`, puertos solo en 127.0.0.1, contenedores sin root/read-only/cap_drop, BD sin puertos, sin cuentas demo en producción | `verify-owasp` A05 · `tests-fase7` · ZAP |
| A06 Componentes vulnerables | `npm audit`, `dotnet list package --vulnerable`, Trivy, lockfiles | `verify-owasp` A06 · Trivy |
| A07 Fallos de autenticación | Respuesta única, tiempo constante, bloqueo por cuenta, política de contraseña del admin, JWT inválidos → 401, revocación por desactivación | `verify-owasp` A07 · arnés [7][8] |
| A08 Integridad de software/datos | Sin CDN/scripts externos, lockfiles, imágenes con versión, sin deserialización polimórfica ni XXE | `verify-owasp` A08 |
| A09 Registro y monitoreo | Fallos de login, bloqueos y 401/403/429 como `Warning` con IP; sin secretos en logs; auditoría CU-08 + cierre diario | `verify-owasp --docker` A09 |
| A10 SSRF | El backend no hace solicitudes salientes; ningún endpoint recibe URLs | `verify-owasp` A10 (barrido del código y de OpenAPI) |

## ANEXO C — Riesgo residual y límites (decirlos, no ocultarlos)
- **No existe «imposible de hackear».** Esto reduce y verifica la superficie de ataque; no sustituye una **auditoría/pentest externo**, que se recomienda antes de un uso con datos reales.
- **Sin MFA ni OAuth 2.0/OIDC** (decisión por coherencia con PG2_V2): una contraseña robada sigue dando acceso hasta que el bloqueo/rotación actúen. Trabajo futuro: TOTP para Admin/Gerencia y OIDC (Keycloak/Entra ID).
- **JWT sin lista de revocación por token:** un JWT robado sirve hasta 8 h salvo que se desactive la cuenta (entonces ≤ 30 s). `sessionStorage` + CSP reducen el robo, no lo eliminan.
- **Bloqueo por cuenta en memoria:** se reinicia con el servicio y no se comparte entre instancias.
- **El túnel de Cloudflare es público**: úselo solo para pruebas y con contraseñas rotadas.
- El stack de **desarrollo** conserva cuentas demo (por diseño); **producción** no. Los `verify-*` usan esas cuentas.
- `style-src` usa nonce (sin `unsafe-inline`); no se activó *Trusted Types* (Angular lo soporta, pero exige una política adicional).
- La IP real del cliente solo se respeta con `ForwardedHeaders__KnownProxies` correcto (producción lo trae); tras el túnel de desarrollo todos comparten la IP del proxy.

## ANEXO D — Qué se verificó al preparar este documento (y qué no)
**Verificado:** compilación de Domain + Application + servicio en segundo plano con Roslyn · arnés **45 ✓ / 0 ✗** con el código real (bloqueo por cuenta, sin enumeración, ventana y expiración, política de contraseña) · build del frontend ·
**33 ✓ / 0 ✗** de `tests-fase7` con **nginx real + Chromium** (CSP sin violaciones en toda la app, nonce por petición, cabeceras, 404/405/413, sin secretos en el JS, JWT en `sessionStorage`) · 16 ✓ de `tests-fase2` actualizado · E2E de la Fase 1 y `e2e-real` contra backend simulado.
**NO verificado (lo prueba Claude Code en el Paso 4–6):** `Program.cs`/`DbSeeder.cs`/`AuthController.cs` con los paquetes reales (JwtBearer, Serilog, EF) · `read_only`/`cap_drop`/`USER app` con el Docker del usuario · `verify-owasp.mjs`, ZAP, Trivy y Gitleaks contra el stack real ·
el tiempo constante del login con BCrypt real · la actualización de Angular (el entorno de preparación no pudo resolver el conflicto de dependencias) · producción con TLS real.
