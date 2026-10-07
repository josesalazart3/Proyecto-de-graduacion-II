# SCIAD — Guía de uso: escanear con el celular y con la computadora

## 1. Arrancar todo (una vez)
```bash
cd SCIAD
cp .env.example .env                 # solo la primera vez (revisa las contraseñas)
docker compose up --build -d         # base de datos + API + frontend
node sciad-backend/seed-demo.mjs     # crea zonas, personas, perfiles y credenciales de demostración
```
- Aplicación: **http://localhost:8080** · API directa: http://localhost:3000 (Swagger: `/swagger`).
- Cuentas del sistema (creadas por el seeder de la API): `admin@sciad.gt`, `seguridad@sciad.gt`, `gerencia@sciad.gt` — contraseña `sciad123`.
  (Cámbialas antes de exponer el sistema fuera de tu equipo; el build de producción **no** muestra estas cuentas en el login.)

## 2. Escanear desde la computadora (webcam)
1. Abre `http://localhost:8080` (en `localhost` la cámara funciona sin HTTPS) y entra como **seguridad@sciad.gt**
   (o como Admin: menú **Punto de acceso**).
2. Elige la **zona**; el navegador pedirá permiso para la cámara → *Permitir*.
3. Abre `demo-gafetes.html` (lo genera el script de datos demo) en **otra pantalla o en tu celular** y acerca el QR a la cámara.
   También puedes imprimir un gafete desde **Credenciales QR → Ver → Imprimir gafete**.

## 3. Escanear desde el celular (necesita HTTPS)
La cámara del navegador **solo funciona en HTTPS** (o localhost). Para probar en un celular sin dominio:
```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
./scripts/url-celular.sh             # Windows: .\scripts\url-celular.ps1   → imprime https://….trycloudflare.com
```
1. Abre esa URL en el celular, entra como **seguridad@sciad.gt** y permite la cámara.
2. Muestra a la cámara el QR de `demo-gafetes.html` abierto en tu computadora.
3. Instalar como app: Android/Chrome → ⋮ → *Agregar a la pantalla principal* · iPhone/Safari → Compartir → *Agregar a inicio*.
4. Al terminar: `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop tunnel`.

⚠ Mientras el túnel esté encendido la URL es pública. Úsalo solo para pruebas y no compartas la URL. Para uso real: VPS con dominio y TLS (`DESPLIEGUE.md`).

## 4. Qué debe pasar con cada persona de la demostración
| Persona | Escenario | Resultado al escanear |
|---|---|---|
| Juan Pérez López | Entrada Principal y Oficinas, vigente | ✅ verde: INGRESO; 2.º escaneo: EGRESO |
| María Fernanda Ruiz | Las 3 zonas, vigente | ✅ verde en cualquier zona |
| Carlos Méndez Soto | Perfil vencido | ❌ rojo «Fuera de vigencia» (avisa a Gerencia) |
| Ana Lucía Castillo | Credencial revocada | ❌ rojo «Credencial revocada» (avisa a Gerencia) |
| Roberto Aguilar (visitante) | Solo Entrada Principal | ✅ en Entrada · ❌ «Zona no autorizada» en otras zonas |
| Sofía Morales (visitante) | Sin perfil | ❌ rojo «Zona no autorizada» |

## 5. Reglas que conviene conocer
- **El servidor alterna ingreso/egreso** en cada escaneo válido. La app no reenvía el mismo QR mientras siga frente a la cámara
  (hay que retirarlo y volver a presentarlo; además hay una espera de 15 s para el mismo código).
- **Un solo ingreso por persona y día** (regla del DERCAS, CU-04): el 3.er escaneo del día devuelve «Ingreso ya registrado» (409) hasta mañana.
  Quien entra a una 2.ª zona el mismo día, o sale y vuelve a entrar, también recibe ese aviso. Para repetir pruebas el mismo día usa otra persona.
- **Horas**: el sistema trabaja en **hora de Guatemala (UTC-6)**; el día cambia a medianoche local, no a las 18:00.
- Las listas (historial, notificaciones, auditoría, reportes) muestran hasta **100** filas; usa los filtros para acotar.

## 6. Si algo no funciona
| Síntoma | Causa y solución |
|---|---|
| «La cámara solo funciona en HTTPS» | Abriste `http://192.168.x.x`. Usa `localhost` en la PC o el túnel HTTPS en el celular. |
| «Se bloqueó el permiso de la cámara» | Candado de la barra de direcciones → Cámara → Permitir; recarga. En iPhone: Ajustes → Safari → Cámara. |
| No lee el QR | Más luz, acércalo/aléjalo, evita reflejos; usa la linterna (🔦) o «Leer desde foto». |
| «Sin conexión» | El celular perdió red o el stack está apagado: `docker compose ps`. |
| Login bloqueado (429) | Límite de intentos; espera 5 min. |
| La URL del túnel no aparece | `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs tunnel`. |
