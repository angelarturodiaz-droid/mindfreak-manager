# CHANGELOG — Mindfreak Manager

## Fix: cambiar el correo de un usuario (Configuración → Usuarios) no mandaba ningún correo

Reporte del usuario: al editar el correo de un usuario desde
`/settings/users`, el cambio se guardaba pero nunca llegaba el correo de
verificación esperado a la dirección nueva.

**Causa:** el código llamaba a `supabase.auth.resend({ type: "signup",
email })` después de `adminClient.auth.admin.updateUserById(userId,
{email, email_confirm: false})`, asumiendo que eso reenviaría un correo de
confirmación. Pero la API de administración de Supabase **no** es el mismo
flujo que usa un usuario para cambiar su propio correo:
- El flujo normal (`supabase.auth.updateUser({email})`, llamado por el
  propio usuario con su sesión) crea un token de "cambio de correo"
  pendiente y dispara el template "Change email address" para
  confirmarlo.
- La API de administración, en cambio, escribe el correo nuevo
  **directo** en la base de datos — de inmediato y ya "confirmado" —
  sin importar qué se le pase en `email_confirm`. Comprobado con una
  consulta directa a `auth.users`: tras decenas de cambios de correo por
  este camino, `email_change_sent_at` y `confirmation_sent_at` seguían en
  `null` — nunca se generó nada que reenviar.

Por eso `resend({type: "signup", ...})` no hacía nada: no había ninguna
confirmación de signup pendiente que reenviar, así que Supabase
simplemente no mandaba el correo — y como no devolvía error, pasaba
desapercibido (el código ni siquiera revisaba el resultado).

**Fix (código):**
- Se quitó esa llamada inútil y se dejó `email_confirm: true` (para que
  el estado en la base de datos refleje lo que realmente pasa: el correo
  ya queda confirmado de inmediato, no "pendiente").
- El botón "Reenviar" y el ícono de correo sin verificar en
  `/settings/users` siguen funcionando igual, pero ahora solo aplican al
  flujo real donde sí tiene sentido (un usuario recién creado que aún no
  hizo clic en su correo de confirmación — `createUserAction`, que sí usa
  correctamente `type: "signup"`).

**Falta un paso en el dashboard de Supabase (no es código):** el correo
pensado para este caso — "admin cambia el correo de otra persona" — es la
notificación de seguridad **"Email address changed"**. Se dispara sola
cada vez que cambia el correo de un usuario (lo haga el propio usuario o
un admin), pero solo si está **activada a nivel de proyecto**. Ir a
Supabase Dashboard → Authentication → Emails, buscar la sección de
notificaciones de seguridad ("Security notification emails" /
"Email address changed") y activarla — usa el mismo SMTP de Hostinger ya
configurado, no requiere credenciales nuevas. Si esa sección no aparece
donde se espera, revisar con un screenshot para confirmar la ubicación
exacta (igual que se hizo con el template de "Reset password").

## Fix: "recordar este equipo" (90 días) no evitaba que volviera a pedir el MFA

Reporte del usuario: marcaba "recordar este equipo" al verificar el código
del autenticador, pero en el siguiente login volvía a pedirle el MFA de
todas formas — confirmado que no era un problema de ventana de incógnito.

**Causa:** el equipo de confianza (cookie + fila en `mfa_trusted_devices`)
solo se revisaba dentro de `signIn()` para decidir si mandaba directo a
`/mfa-challenge` justo después de meter la contraseña. Pero
`app/(dashboard)/layout.tsx` — que envuelve TODAS las páginas del
dashboard — tiene su **propio** chequeo independiente de
`getAuthenticatorAssuranceLevel()`, y ese chequeo no sabía nada de equipos
de confianza. Como Supabase nunca eleva la sesión a `aal2` real cuando se
salta el challenge (no hay forma de "fingir" esa verificación ante
Supabase), `currentLevel` se queda en `aal1` incluso en un equipo
confiable. Resultado:
1. `signIn()` reconoce el equipo de confianza y deja pasar a `/dashboard`.
2. La primera carga del layout del dashboard ve `nextLevel: "aal2"` !=
   `currentLevel: "aal1"` (sesión real, sin "fingir") → redirige igual a
   `/mfa-challenge`, deshaciendo el "recordar" un instante después de
   haber entrado.
3. Al completar el MFA ahí, se crea una fila NUEVA en
   `mfa_trusted_devices` en vez de reusar la existente — lo que explicaba
   las filas duplicadas vistas en la base de datos, cada una usada
   exactamente una vez.

**Fix:** se movió `isCurrentDeviceTrusted()` de `features/auth/actions.ts`
a `lib/mfa/trusted-devices.ts` (módulo compartido, sin `"use server"`) y
ahora `app/(dashboard)/layout.tsx` también la consulta antes de redirigir
a `/mfa-challenge` — solo redirige si el equipo NO está marcado como
confiable. El acceso a acciones sensibles (cambiar contraseña, etc.) sigue
sin verse afectado: esas siguen exigiendo la verificación real de
Supabase aparte, sin importar el equipo.

## Fix: usar un código de recuperación dejaba la cuenta en bucle infinito de redirects

Reporte del usuario: tras poner un código de recuperación válido, la
pantalla se quedaba "pensando" en `/profile?mfa_reset=1` sin cargar nunca.

**Causa:** `getAuthenticatorAssuranceLevel()` (lo que usa el layout del
dashboard para exigir el paso de MFA) lee la sesión **en caché** de la
cookie, no vuelve a consultar el servidor en cada llamada. Al borrar el
factor MFA vía la API admin, esa caché seguía "recordando" el factor
viejo, así que:
1. El usuario entra a `/profile?mfa_reset=1`.
2. El layout del dashboard (que envuelve `/profile`) sigue viendo
   `nextLevel: "aal2"` en la sesión cacheada → redirige a
   `/mfa-challenge`.
3. El middleware ve `mfa_reset_pending = true` y esa ruta no es
   `/profile` → redirige de vuelta a `/profile?mfa_reset=1`.
4. Vuelve al paso 1 — bucle infinito, nunca llega a renderizar nada.

**Solución:** `verifyRecoveryCodeAction` (en `features/auth/actions.ts`)
ahora llama a `supabase.auth.refreshSession()` justo después de borrar
el factor MFA — esto fuerza una sesión nueva cuyo `session.user.factors`
sí refleja que ya no hay ningún factor, así `nextLevel` pasa a `"aal1"`
y el layout deja de exigir el paso de MFA.

## Recuperación de MFA (códigos de respaldo) y "equipos de confianza" (90 días)

Pedido del usuario: un flujo aparte para cuando se pierde el acceso al
autenticador, y poder "recordar" un equipo para no pedir el código de MFA
en cada login. Antes de construir, se confirmaron con el usuario 3
decisiones de diseño (todas las recomendadas):

1. Un código de recuperación usado **desactiva el MFA de la cuenta y
   obliga a reconfigurarlo** antes de seguir usando el sistema — no es una
   preferencia de UX, es la única salida técnica: Supabase no tiene forma
   de "fingir" que el autenticador se verificó, así que la única manera de
   bajar el nivel de autenticación exigido (AAL2 → AAL1) es quitando el
   factor MFA, y eso requiere la Secret Key (ni con sesión activa el
   propio usuario puede quitarse su MFA sin AAL2).
2. "Recordar este equipo" solo evita el código en el **login normal**, por
   90 días. Supabase sigue exigiendo AAL2 aparte en acciones sensibles
   (cambiar contraseña) sin importar el equipo — no se puede evitar, y no
   se intentó evitar.
3. Se generan 10 códigos de un solo uso cada vez (estándar de la
   industria).

**Nuevas tablas** (`supabase/migrations/052_mfa_recovery_codes_and_trusted_devices.sql`,
aplicada directamente vía MCP de Supabase — revisados los advisors de
seguridad después, sin hallazgos nuevos):
- `mfa_recovery_codes` — hash (sha256) de cada código, nunca el código en
  texto plano. RLS: cada quien solo ve/gestiona los suyos.
- `mfa_trusted_devices` — hash del token del equipo (el token real vive
  solo en una cookie httpOnly del navegador, nunca en la base de datos).
  RLS igual, por `user_id = auth.uid()`.

**Código nuevo:**
- `lib/mfa/recovery-codes.ts` — genera códigos legibles tipo `XXXX-XXXX`
  (alfabeto sin 0/O/1/I/L) y su hash.
- `lib/mfa/trusted-devices.ts` — token aleatorio de 32 bytes y su hash;
  `TRUSTED_DEVICE_DAYS = 90`.
- `features/auth/actions.ts`:
  - `signIn()` ahora chequea si el equipo actual es "de confianza" antes
    de exigir el paso de `/mfa-challenge`.
  - `verifyMfaChallengeAction` acepta un checkbox "recordar este equipo"
    (marca el equipo de confianza tras verificar el código real).
  - `verifyRecoveryCodeAction` (nueva) — valida el código de recuperación,
    lo marca usado, borra el/los factor(es) MFA vía Secret Key, marca
    `user_metadata.mfa_reset_pending = true` (con lectura-mezcla-escritura
    para no pisar otras claves como `full_name`), y redirige a
    `/profile?mfa_reset=1`.
- `lib/supabase/proxy.ts` — si `mfa_reset_pending` está activo, redirige
  cualquier navegación (GET) que no sea `/profile` de vuelta a `/profile`
  — deja pasar las Server Actions (POST) para no bloquear, por ejemplo,
  cerrar sesión desde otra página.
- `features/profile/actions.ts` — `verifyMfaEnrollmentAction` limpia el
  flag al reconfigurar con éxito; nuevas acciones
  `generateRecoveryCodesAction`, `getRecoveryCodesStatusAction`,
  `listTrustedDevicesAction`, `revokeTrustedDeviceAction`,
  `revokeAllTrustedDevicesAction`.
- `app/(dashboard)/profile/recovery-codes-setup.tsx` y
  `trusted-devices-list.tsx` (nuevos) — UI en el perfil, filas nuevas
  "Códigos de recuperación" y "Equipos de confianza" junto al
  autenticador. El aviso de "MFA desactivado, reconfigúralo" aparece en
  `/profile` cuando corresponde.
- `app/(auth)/mfa-challenge/page.tsx` — agrega el checkbox "recordar este
  equipo" y un enlace "¿Perdiste el acceso a tu autenticador?" que cambia
  el formulario al de código de recuperación.

## Fix: recuperar contraseña fallaba con "AAL2 session is required..." en cuentas con MFA

Tras el fix anterior (link de recuperación llevando a `/update-password`),
en una cuenta con el autenticador (MFA/TOTP) activado el guardar la
contraseña nueva fallaba con el error de Supabase "AAL2 session is
required to update email or password when MFA is enabled." — la sesión
que crea el link de recuperación solo llega a AAL1, y Supabase exige
AAL2 (código de 6 dígitos verificado) para dejar cambiar la contraseña
si la cuenta tiene MFA, sin importar que el link en sí sea válido.

**Solución:** se le enseñó a `/mfa-challenge` a seguir a una ruta
distinta de `/dashboard` cuando se le indica con `?next=...` (antes
solo sabía volver al dashboard tras el login normal):
- `app/auth/confirm/route.ts` — tras canjear el token, si la cuenta
  tiene MFA y la sesión sigue en AAL1, redirige a
  `/mfa-challenge?next=/update-password` en vez de directo a
  `/update-password`.
- `app/(auth)/mfa-challenge/page.tsx` — lee `next` de la URL
  (`useSearchParams`, con `Suspense`) y lo manda como campo oculto del
  formulario.
- `features/auth/actions.ts` — `verifyMfaChallengeAction` redirige a
  `next` en vez de siempre a `/dashboard` (con chequeo de que sea una
  ruta interna, para no abrir un redirect arbitrario).

Con esto, recuperar contraseña en una cuenta con MFA pide el código de
6 dígitos como paso intermedio y luego sí deja guardar la contraseña
nueva — mismo comportamiento de seguridad que ya tenía el login
normal, solo que ahora también cubre este flujo.

## Fix: el link de "recuperar contraseña" llevaba al login en vez de a poner contraseña nueva

Reporte del usuario: tras configurar SMTP propio (Hostinger) y confirmar que
el correo de recuperación sí llega, el link del correo lo llevaba de vuelta
a la pantalla de usuario/clave en vez de a un formulario para poner una
contraseña nueva.

**Causa:** `requestPasswordReset` llamaba a
`supabase.auth.resetPasswordForEmail(email)` sin `redirectTo`, así que
Supabase usaba el Site URL por defecto del proyecto (no una pantalla
para poner contraseña nueva) — y esa pantalla, `/update-password`,
tampoco existía todavía en la app.

**Solución:**
- `features/auth/actions.ts` — `requestPasswordReset` ahora arma el
  `redirectTo` con el origen de la request:
  `${origin}/auth/confirm?next=/update-password`. Se agregó
  `updatePasswordAction`, que exige una sesión activa (la que crea el
  canje del token) y llama a `supabase.auth.updateUser({ password })`.
- `app/auth/confirm/route.ts` (nuevo) — Route Handler al que debe
  apuntar la plantilla de correo "Reset Password" en el dashboard de
  Supabase (Authentication → Emails → Templates), con
  `token_hash`/`type` en vez del `{{ .ConfirmationURL }}` por defecto.
  Canjea el token por una sesión real vía cookies (patrón SSR) y sigue
  a `next`.
- `app/(auth)/update-password/page.tsx` (nuevo) — formulario de
  contraseña nueva + confirmación, mismo `AuthShell` que login/MFA/
  recuperar contraseña, para que las 4 pantallas del flujo de auth se
  vean como un mismo sistema.
- `lib/supabase/proxy.ts` — `/auth/confirm` se agregó como ruta pública
  (no hay sesión todavía la primera vez que se visita).

**Pendiente en el dashboard de Supabase (no se puede hacer por código):**
editar la plantilla "Reset Password" (Authentication → Emails →
Templates) para que el link use
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`
en vez del `{{ .ConfirmationURL }}` por defecto, y agregar el dominio
de la app a Authentication → URL Configuration → Redirect URLs.

## Unificación visual de las 3 pantallas de autenticación (login, recuperar contraseña, verificación en dos pasos)

Pedido del usuario tras ver la pantalla de MFA: "esta parte de mfa no
esta alineada con la primera parte ni con toda la linea grafica del
sistema" — el rediseño anterior solo se había aplicado a `/login`, y
`/recover-password` y `/mfa-challenge` seguían con la tarjeta blanca
centrada de antes, con lo que las 3 pantallas del flujo de auth se
sentían como sistemas distintos.

**`components/auth/auth-shell.tsx` (nuevo):** se extrajo del login el
panel de marca compartido (degradado oscuro, textura de puntos, glow,
logo `mindfreak-logo-on-dark.png`, franja compacta en mobile) a un
componente `AuthShell` reutilizable, con slots para el contenido de
marca (`brandContent`) y la nota de pie (`footerNote`) de cada pantalla,
más una variante `alert` (degradado rojo) para el estado de captcha del
login.

**Las 3 pantallas ahora usan `AuthShell`:**
- `app/(auth)/login/page.tsx` — refactor sin cambios de comportamiento,
  ahora consume `AuthShell` en vez de tener el panel embebido inline.
- `app/(auth)/mfa-challenge/page.tsx` — mismo panel de marca oscuro, con
  badge "VERIFICACIÓN EN DOS PASOS" y copy sobre el código de la app
  autenticadora; el campo de código ahora tiene ícono y placeholder
  `000000`, mismo estilo de inputs/botones que el login.
- `app/(auth)/recover-password/page.tsx` — mismo panel, badge
  "RECUPERAR ACCESO" y copy sobre el enlace de restablecimiento; el
  mensaje de "enlace enviado" ahora se muestra como un aviso de éxito
  (fondo verde) en vez de texto suelto.

No se tocó lógica de negocio, RLS ni las server actions
(`verifyMfaChallengeAction`, `requestPasswordReset`) — solo el layout
visual de las 3 páginas.

## Rediseño de la pantalla de login — visual SaaS, logo real de Mindfreak Events

Pedido del usuario: mejorar el login (más UX/UI, más visual, más
"SaaS profesional") y usar el logo real de Mindfreak Events. Diseñado
primero como canvas en Claude Design (3 estados: escritorio, verificación
de seguridad, móvil) y luego llevado 1:1 al código.

**Layout nuevo — `app/(auth)/login/page.tsx`:** panel partido en pantallas
grandes (`lg:`): a la izquierda un panel de marca oscuro (degradado navy +
textura de puntos sutil) con el logo, un titular de valor y 3 bullets de
funcionalidades reales del sistema (NCF electrónico, pagos/conciliación,
reportes); a la derecha el formulario (correo con ícono de sobre,
contraseña con ícono de candado + el "ojito" ya existente, link de
"¿Olvidaste tu contraseña?", botón de ingresar, y la nota de "protegido con
verificación en dos pasos..." que ya existía). En mobile/tablet el panel
de marca se colapsa a una franja compacta arriba del formulario. Cuando
`signIn` marca `requiresCaptcha: true` (ver feature de captcha, entrada
anterior), el panel de marca cambia a un estado de alerta (degradado rojo,
badge "ALERTA DE SEGURIDAD", copy explicando por qué se pide el captcha) —
mismo mecanismo de antes, solo mejor comunicado visualmente.

**Logo real:** el logo de Mindfreak Events que el usuario ya tenía
cargado en Configuración → Sistema no se puede leer sin sesión (la tabla
`companies` solo es visible para usuarios autenticados de esa empresa —
RLS intacta, no se tocó). Como las pantallas de auth son públicas por
definición, se guardó una copia recortada del logo como archivo estático
en `public/brand/mindfreak-logo.png` — solo para las pantallas de
login/auth, no reemplaza el logo dinámico del sidebar ni el de los PDFs,
que siguen leyendo `company.logo_url` como antes.

**Ajuste (feedback del usuario tras ver el resultado):** la primera
versión metía el logo negro dentro de una placa blanca sobre el panel
oscuro — se veía "pegado ahí" en vez de integrado. Se generó una segunda
variante, `public/brand/mindfreak-logo-on-dark.png`, recoloreando a
blanco los píxeles negros del logo (detección por saturación: se
preserva el teal de las barras/"EVENTS" y solo el texto/monograma negro
pasa a blanco) para que quede directamente sobre el degradado oscuro,
sin caja — mismo tratamiento que Linear/Stripe le dan a su logo en
pantallas de login.

**Componentes reutilizables extendidos (aditivo, no rompe nada):**
`components/ui/field.tsx` (`Input`) y `components/ui/password-input.tsx`
(`PasswordInput`) ahora aceptan una prop opcional `icon` para el ícono a
la izquierda del campo — sin `icon`, se comportan exactamente igual que
antes, así que el resto de los ~30 formularios que ya los usan no cambia.

**Verificación:** `npx tsc --noEmit`, `npm run build`, `npx eslint .`
(0 errores) y `npx vitest run` (19/19) — todos en verde. Sin cambios de
lógica de negocio, permisos ni base de datos.

## Seguridad: "ojito" para ver la contraseña + captcha ante comportamiento sospechoso en el login

Dos pedidos del usuario:

**1) Ver la contraseña (ícono de ojo).** Nuevo componente reutilizable
`components/ui/password-input.tsx` (`PasswordInput`) — mismo look que
`Input`, pero con un botón de ojo que alterna `type="password"` ↔
`type="text"`. Reemplaza los campos de contraseña de:
- Login (`app/(auth)/login/page.tsx`)
- Cambiar contraseña propia (`app/(dashboard)/profile/change-password-form.tsx`)
- Crear usuario y Restablecer contraseña de otro usuario
  (`app/(dashboard)/settings/users/{new-user-form,reset-password-button}.tsx`),
  que ya tenían un ojito hecho a mano — se consolidaron en el mismo
  componente para no duplicar la lógica.

**2) Captcha (Cloudflare Turnstile) tras varios logins fallidos.**
Nueva migración `051_login_captcha_protection.sql`: tabla
`auth_login_attempts` (sin policies — solo accesible vía funciones
`SECURITY DEFINER`, ya que el login ocurre sin sesión) + 3 funciones
RPC: `record_failed_login`, `get_login_attempts`, `reset_login_attempts`,
todas con ventana de 15 minutos. En `features/auth/actions.ts`, `signIn`
ahora:
- Consulta el conteo de intentos fallidos del correo antes de validar
  la contraseña.
- A partir de 3 intentos fallidos seguidos (ventana de 15 min), exige
  un token de Turnstile válido (verificado server-side contra
  `https://challenges.cloudflare.com/turnstile/v0/siteverify`) antes de
  siquiera intentar la contraseña de nuevo.
- Registra cada intento fallido y resetea el contador en un login
  exitoso.

Nuevo componente `components/ui/turnstile-widget.tsx` — se renderiza en
el login solo cuando el servidor marca `requiresCaptcha: true`. Nuevas
variables de entorno en `.env.example`:
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` — si se dejan
vacías, el captcha simplemente no aparece y el login sigue funcionando
normal (no rompe nada mientras se configuran las llaves de Cloudflare).

**Verificación:** `npx tsc --noEmit`, `npm run build`, `npx eslint .`
(0 errores) y `npx vitest run` (19/19) — todos en verde. Migración
aplicada directamente al proyecto de Supabase de producción.

## Fix: error "Event handlers cannot be passed to Client Component props" en Bancos y Términos de pago

Reportado por el usuario al entrar a Configuración → Bancos. Bug
preexistente, no relacionado con las fases de rediseño: en
`app/(dashboard)/settings/banks/page.tsx` y
`app/(dashboard)/settings/payment-terms/page.tsx` (ambos Server
Components), el botón de eliminar le pasaba a `ConfirmButton` (un
Client Component) una función flecha en línea que envolvía la Server
Action —
`onConfirm={() => deleteBankCatalogEntryAction(b.id)}` — en vez de
pasar la Server Action ya vinculada con sus argumentos. Una función
flecha común no es serializable a través del límite servidor/cliente;
solo una Server Action (o una referencia a ella con `.bind`) lo es. El
resto de las pantallas que usan `ConfirmButton` desde un Server
Component (ej. `app/(dashboard)/suppliers/page.tsx`) ya usaban el
patrón correcto (`accion.bind(null, id)`), por eso no fallaban.

**Fix**: en ambos archivos, `onConfirm={() => deleteXAction(id)}` →
`onConfirm={deleteXAction.bind(null, id)}` — dos líneas cambiadas, sin
tocar ninguna Server Action, query ni la lógica de negocio.

**Verificación:** `npx tsc --noEmit`, `npm run build`, `npx eslint .`
(0 errores) y `npx vitest run` (19/19) — todos en verde. Este tipo de
error de límite servidor/cliente no lo detecta `tsc` ni `eslint`, solo
aparece en tiempo de ejecución — por eso no había salido antes en la
verificación automática de las fases del rediseño.

## Rediseño UI/UX — Fase 7: manual del sistema, íconos circulares de color y logo más visible

Tres pedidos del usuario en un solo lote: (1) el ícono de la marca no se
veía bien, (2) faltaba un manual del sistema accesible como el ícono "?"
de QuickBooks, con contenido completo módulo por módulo, y (3) usar
íconos circulares de color como los de la captura de referencia, en todo
el sistema. Sin cambios de lógica ni de datos — todo presentación y una
página nueva de solo lectura.

**Nuevo: `components/ui/icon-badge.tsx`** — ícono circular con fondo de
color suave (`IconBadge`, 7 tonos: blue/green/amber/red/violet/teal/
neutral), reutilizando los tokens de marca y de la paleta de gráficos.
Se agregaron `--chart-5-bg` y `--chart-6-bg` a `app/globals.css` para
tener el par color+fondo-suave también en violeta y teal, igual que ya
existía para success/warning/danger/info.

**`components/layout/sidebar.tsx`**:
- Cada grupo de navegación tiene ahora un tono (Comercial=violeta,
  Operaciones=teal, Finanzas=verde, Análisis=ámbar, Dashboard=azul); el
  ítem inactivo muestra su ícono dentro de un `IconBadge` de ese color —
  igual al estilo de círculos de color de la referencia — y el ítem
  activo mantiene el pill sólido azul con el ícono en blanco (sin
  duplicar color encima de color).
- El logo/marca (arriba del sidebar) pasa de 28px a 36px, con
  proporciones más cuadradas, texto más grande y un anillo sutil para
  que se defina mejor contra el fondo oscuro; si hay un logo real
  subido, ahora se muestra sobre una placa blanca para que no se pierda
  contra el sidebar oscuro. Mientras no se suba el logo real de
  Mindfreak Events, sigue usando la inicial "M" — el campo para subirlo
  ya existe en Configuración → Organización.

**Nuevo: `app/(dashboard)/help/page.tsx`** — el manual del sistema,
accesible desde un ícono de ayuda (`?`) nuevo en la barra superior,
junto a Notificaciones y Configuración. Navegación lateral con un
`IconBadge` de color por módulo, saltando a una sección con contenido
real (no genérico) de cada uno: Dashboard, Clientes, Proveedores,
Cotizaciones, Proyectos, Servicios, Facturas, Cobros y pagos, Gastos,
Bancos, Tareas, Reportes, Auditoría, Configuración/Usuarios y un
resumen de cómo el sistema protege los datos financieros — incluyendo
los estados reales de cada entidad (ej. los 8 estados de Cotizaciones,
los 6 de Facturas) y qué permiso hace falta para las acciones
sensibles (`quotations.approve`, `reports.view`, `settings.manage`,
`banks.reconcile`).

**`components/ui/card.tsx`**: se agregó soporte para `id` (para los
anclajes del manual) — cambio aditivo, no afecta ningún uso existente.

**Verificación:** `npx tsc --noEmit`, `npm run build` (incluye la nueva
ruta `/help`), `npx eslint .` (0 errores) y `npx vitest run` (19/19) —
todos en verde. Sin cambios de esquema. Verificación visual en
navegador no disponible en este entorno.

## Rediseño UI/UX — Fase 6: pulido "SaaS moderno" en topbar, badges, vacíos y pantallas de acceso

Continuación de la Fase 5/5b: más señales visuales de producto SaaS
moderno, aplicadas a componentes compartidos y a las 3 pantallas de
acceso (login, recuperar contraseña, verificación en dos pasos) que no
pasan por el layout del dashboard y por eso no habían recibido ningún
toque de las fases anteriores. Sin cambios de lógica, validaciones ni
flujos de autenticación.

- **`app/(dashboard)/layout.tsx`**: la barra superior ahora es `sticky`
  (se queda visible al hacer scroll en pantallas largas de tablas/reportes),
  con `shadow-[var(--shadow-sm)]` en vez de solo un borde, y un fondo
  semitransparente con `backdrop-blur-sm` — un detalle típico de topbars
  SaaS modernos.
- **`components/ui/badge.tsx`**: cada badge de estado ahora lleva un
  punto de color antes del texto (patrón común en dashboards SaaS:
  Linear, Vercel, Stripe), reforzando el color sin depender solo del
  fondo. Mismo mapeo de estados → tono, sin cambios de comportamiento.
- **`components/ui/empty-state.tsx`**: el ícono de los estados vacíos
  ahora va dentro de un círculo con el color de acento suave, en vez de
  flotar solo — más amigable y menos "formulario viejo".
- **`app/(auth)/login/page.tsx`, `recover-password/page.tsx`,
  `mfa-challenge/page.tsx`**: las 3 agregan la misma marca (cuadrado
  oscuro con "M", igual al ícono del sidebar) centrada sobre el título,
  el texto introductorio centrado, y la tarjeta del formulario con
  `shadow-[var(--shadow-md)]` en vez de la sombra mínima por defecto —
  quedan visualmente alineadas al resto del sistema en vez de sentirse
  como una pantalla aparte.

**Verificación:** `npx tsc --noEmit`, `npm run build`, `npx eslint .` (0
errores) y `npx vitest run` (19/19) — todos en verde. Sin cambios de
esquema ni de lógica de negocio. Verificación visual en navegador no
disponible en este entorno.

## Rediseño UI/UX — Fase 5b: sidebar oscuro (corrigiendo fidelidad con el diseño elegido)

El usuario reportó que la app en vivo no se veía como la Opción B del
canvas ("SaaS Moderno"). Causa: la Fase 5 solo actualizó tokens de color
(`app/globals.css`), pero el componente `Sidebar` nunca leía el token
`--brand-secondary` — quedó definido desde la Fase 1 con el comentario
"variante oscura para navegación/sidebar si se usa sólido" pero sin
usarse; el sidebar seguía siendo blanco (`bg-brand-surface`), que es la
diferencia visual más grande entre la app y las 3 opciones del canvas
(las tres mostraban un sidebar oscuro sólido).

**`components/layout/sidebar.tsx`** — único archivo tocado:
- El `<aside>` pasa de `bg-brand-surface` + borde a `bg-brand-secondary`
  (el oscuro `#0b1220` ya definido en la Fase 5), sin borde propio.
- Logo, nombre de la plataforma y textos pasan a blanco/blanco-translúcido
  (`text-white`, `text-white/70`, `text-white/40`) en vez de los tonos de
  texto para fondo claro.
- El ítem de navegación activo pasa de "fondo azul muy claro + texto azul"
  a **fondo azul sólido (`brand-accent`) + texto blanco** — el pill de
  navegación que se veía en las 3 opciones del canvas.
- Separadores (`border-b`, `border-t`) y el botón "Colapsar" pasan a usar
  `border-white/10` / `text-white/50` para tener contraste sobre el fondo
  oscuro, en vez de los tokens de borde/texto pensados para fondo claro.
- Nada de la lógica de navegación, rutas, colapsado o el drawer móvil
  cambió — solo clases de color.

**Verificación:** `npx tsc --noEmit`, `npm run build`, `npx eslint .` (0
errores) y `npx vitest run` (19/19) — todos en verde. Verificación visual
en navegador no disponible en este entorno.

## Rediseño UI/UX — Fase 5: paleta "SaaS Moderno" (elegida en el canvas de diseño)

El usuario revisó 3 direcciones de sistema de diseño en un canvas
(Azul Ejecutivo, SaaS Moderno, Alto Contraste Premium) y eligió
**SaaS Moderno**. Esta fase aplica esa paleta a los tokens reales de la
app en `app/globals.css` — un solo archivo, cero cambios de lógica — que
se propagan automáticamente a todos los módulos porque cada componente
compartido (`Button`, `Field`, `Card`, `KpiCard`, `Badge`, `Sidebar`,
gráficos) ya consume estos tokens en vez de colores sueltos.

**Cambios de valores en `:root` (mismos nombres de token, no se agregó
ni quitó ninguno):**
- `--brand-primary`: `#0b0e14` → `#101828` (carbón en vez de negro puro)
- `--brand-accent` / `--brand-info`: `#2e90fa` → `#155eef` (azul más vívido)
- `--brand-accent-hover`: `#1570d6` → `#0e4fd1`
- `--brand-accent-light` / `--brand-info-bg`: `#eaf4ff` → `#eaf1ff`
- `--brand-secondary`: `#101828` → `#0b1220`
- `--brand-background`: `#f6f8fb` → `#f9fafb`
- `--brand-surface-hover`: `#f1f5f9` → `#f2f4f7`
- `--brand-border`: `#e2e8f0` → `#eaecf0`
- `--brand-success` / `-bg`: `#12b76a` / `#ecfdf3` → `#17b26a` / `#e7f9ef`
- `--brand-warning-bg`: `#fffaeb` → `#fff6e8`
- `--brand-danger-bg`: `#fef3f2` → `#fdecec`
- `--chart-1`, `--chart-2`: siguen a `brand-accent`/`brand-success`;
  `--chart-6`: `#0e7490` → `#0e9384` (teal, segundo acento de la Opción B)
- **Radios**, más redondeados: `--radius-sm` 0.25rem→0.375rem,
  `--radius-md` 0.5rem→0.625rem, `--radius-lg` 0.75rem→1rem
- **Sombras**, más suaves y con más aire: `--shadow-sm/md/lg` ajustadas
  (menos opacidad, más difuminado)

**Fuera de alcance de esta fase (a propósito):** las plantillas PDF de
facturas/cotizaciones/recibos (`lib/pdf/*.tsx`) siguen usando los colores
de la Opción A original codificados directamente ahí — son documentos
oficiales que el cliente ya recibe con esa imagen, así que no se tocaron
sin pedirlo explícitamente. Si se quiere que los PDFs usen la nueva
paleta, es un cambio aparte y puntual.

**Verificación:** `npx tsc --noEmit`, `npm run build`, `npx eslint .` (0
errores) y `npx vitest run` (19/19) — todos en verde. Solo un archivo CSS
de tokens, sin cambios de esquema ni lógica. Verificación visual en
navegador no disponible en este entorno (bloqueo de red documentado hacia
`*.supabase.co`).

## Rediseño UI/UX — Fase 4: consistencia responsive en todos los módulos

Cuarta fase del rediseño: pasada mecánica y de bajo riesgo sobre **todas**
las pantallas listadas por el usuario como prioridad (Clientes, Proveedores,
Cotizaciones, Facturas, Cobros, Pagos, Bancos, Proyectos, Gastos, Servicios,
Configuración, Usuarios, Tareas, Auditoría, Perfil, Dashboard) para que el
espaciado responsive aplicado en Reportes (Fase 3) quede parejo en toda la
app. Sin cambios de lógica, datos ni consultas — solo clases de Tailwind en
los contenedores de página.

- **Padding de página responsive**: los 33 archivos de página bajo
  `app/(dashboard)/**` cuyo `<main>` usaba `p-8` fijo ahora usan
  `p-4 md:p-8`, igual que el patrón ya establecido en Reportes y en el
  layout del dashboard — en móvil el contenido usa el ancho completo en vez
  de desperdiciar 32px de margen a cada lado.
- **Encabezados de página sin desbordamiento en móvil**: los 8 encabezados
  de listado (Cotizaciones, Proyectos, Facturas, Gastos, Bancos, Proveedores,
  Clientes, Dashboard) que ponen título+descripción a la izquierda y botón(es)
  de acción a la derecha con `justify-between` ahora incluyen
  `flex-wrap gap-3`, así los botones bajan a una segunda línea en pantallas
  angostas en vez de comprimirse o desbordar horizontalmente.
- Se dejó sin tocar el padding interno de tarjetas/paneles (p. ej. el
  recuadro punteado de adjuntos en el detalle de Proyecto) — solo se
  modificó el contenedor de página de nivel superior.
- Se revisó que los módulos de listado (Clientes, Proveedores, Cotizaciones,
  Facturas, Proyectos, Gastos, Bancos) ya usan consistentemente
  `Input`/`Select`/`Button`/`Badge`/`DataTable`/`EmptyState` compartidos —
  no se encontraron pantallas con controles de formulario "sueltos" fuera
  del sistema de componentes.

**Verificación:** `npx tsc --noEmit`, `npm run build`, `npx eslint .` (0
errores) y `npx vitest run` (19/19) — todos en verde. Sin cambios de
esquema. Verificación visual en navegador no disponible en este entorno
(bloqueo de red documentado hacia `*.supabase.co`).

## Rediseño UI/UX — Fase 3: Reportes y widgets del Dashboard

Tercera fase del rediseño, enfocada en los dos puntos explícitamente priorizados
por el usuario que aún no se habían tocado: el módulo de **Reportes** y los
widgets con listas (`WidgetCard`/`MiniList`) del Dashboard. Sin cambios de
lógica, datos, cálculos, permisos ni consultas — solo presentación.

**`app/(dashboard)/reports/page.tsx`**
- Layout responsive: el contenedor principal pasa de `flex gap-8 p-8` fijo a
  `flex flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-8`, de modo que en
  móvil/tablet el panel de navegación de reportes se apila arriba del
  contenido en vez de comprimirlo en una columna angosta de 256px.
- El panel de navegación (`aside`) pasa de `w-64` fijo a `w-full md:w-64`.
- Los inputs de fecha (`DateRangeFields`, usados en los 5 reportes con
  filtros) ahora usan `FIELD_CLASSES` de `components/ui/field.tsx` en vez de
  una clase suelta hardcodeada, quedando visualmente consistentes con los
  `<Select>` que los acompañan en la misma barra de filtros.
- Las 6 tarjetas KPI del reporte "Cuentas por Cobrar y Vencimientos" (Total
  por cobrar, Total vencido, Vence hoy, Próximos 7/15/30 días) ahora pasan un
  ícono (`lucide-react`) a `KpiCard`, igual que las tarjetas KPI del
  Dashboard desde la Fase 2.

**`components/dashboard-widgets/render-widget.tsx`**
- `WidgetCard` ahora acepta un ícono opcional junto al título; se agregó a
  los 8 widgets de tipo lista/gráfico (Flujo financiero, Facturas vencidas,
  Facturas próximas, Últimos cobros, Últimos pagos, Tareas pendientes,
  Rentabilidad por proyecto), reforzando la iconografía consistente ya
  aplicada a las tarjetas KPI sueltas en la Fase 2.
- `MiniList` (usado por esos mismos widgets) pasa de una lista con `gap-2`
  suelto a `divide-y divide-brand-border` con padding vertical por fila, dando
  una separación más clara entre elementos sin cambiar los datos mostrados.

**Verificación:** `npx tsc --noEmit`, `npm run build`, `npx eslint .` (0
errores) y `npx vitest run` (19/19) — todos en verde. Sin cambios de
esquema, por lo que no aplica verificación con datos reales en Supabase.
Verificación visual en navegador no disponible en este entorno (bloqueo de
red documentado hacia `*.supabase.co`).

**Pendiente para próximas fases:** revisión de formularios de creación/edición
por módulo (Clientes, Proveedores, Cotizaciones, Facturas, Proyectos, Gastos,
Bancos) para confirmar que todos usan `Input`/`Select`/`Textarea` compartidos;
pulido de `data-table.tsx` en pantallas muy angostas si se detectan casos
puntuales de uso fuera del wrapper `overflow-x-auto` existente.

## Rediseño UI/UX — Fase 2: componentes base (botones, campos, tarjetas KPI)

Segunda fase del rediseño. Estrategia deliberada: en vez de tocar cada
pantalla de cada módulo una por una, se elevan los componentes
COMPARTIDOS que ya usan los 12 módulos (`Button`, `Input`/`Select`/
`Textarea`, `KpiCard`) — así el rediseño se propaga automáticamente a
Clientes, Proveedores, Cotizaciones, Facturas, Cobros/Pagos, Bancos,
Proyectos, Gastos, Reportes, Configuración y Usuarios sin reescribir cada
página ni arriesgar romper su lógica. Sin cambios de negocio, queries ni
base de datos.

- **`Button`**: sombra retirada de las variantes planas (`outline`/`ghost`,
  que antes tenían una sombra igual que los botones sólidos), estado
  `active:scale-[0.98]` para dar feedback táctil real al pulsar, borde con
  más contraste en hover para `outline`.
- **`Input`/`Select`/`Textarea`**: borde con hover visible (antes solo
  reaccionaban al focus), más alto (`py-2.5`) para mejor objetivo táctil
  en móvil.
- **`KpiCard`** (usado en las 10 tarjetas del Dashboard: Total por cobrar,
  Vencido, Ventas, Gastos, Utilidad, Margen, Proyectos activos, etc.):
  el ícono ahora vive en un chip de color (azul o rojo según `danger`) en
  vez de un ícono suelto gris — jerarquía visual mucho más clara, efecto
  "hover" sutil en la tarjeta completa.
- Verificado: `tsc`, `next build`, `eslint` y `vitest` (19 pruebas) pasan
  limpios. La verificación visual en navegador no es posible desde este
  entorno (bloqueo de red hacia Supabase ya documentado en este proyecto).

Pendiente: revisión módulo por módulo de casos particulares que no pasan
por estos componentes compartidos (si los hay), y pulido de Reportes.

## Rediseño UI/UX — Fase 1: paleta de gráficos + navegación responsive

Primera fase del rediseño moderno del ERP pedido por el usuario ("dashboard
tipo SaaS profesional, responsive, sin tocar lógica ni base de datos").
El sistema de diseño base (tokens en `app/globals.css`, componentes
`Card`/`Badge`/`Button`/`DataTable`/`Modal`) ya venía de un rediseño
anterior en este mismo proyecto — esta fase construye sobre eso, no lo
reemplaza. Ningún cambio toca lógica de negocio, queries, acciones ni base
de datos.

- **Paleta de gráficos e indicadores**: nuevos tokens `--chart-1`…`--chart-6`
  y `--chart-grid` en `app/globals.css`, pensados para series de datos
  (gráficos de líneas/barras) — distintos de los tonos semánticos de
  estado (success/warning/danger/info) que ya existían para badges.
- **Gráfico de flujo financiero del Dashboard** (`financial-flow-chart.tsx`):
  actualizado para usar los tokens del sistema de diseño en vez de colores
  sueltos (`#17a6b8`, `#dc2626` de un esquema anterior), con grid, ejes y
  tooltip más pulidos.
- **Sidebar y navegación responsive**: el sidebar no tenía ningún
  comportamiento en móvil/tablet (aparecía fijo y angosto). Ahora:
  - En desktop (`md+`) se comporta exactamente igual que antes (colapsable).
  - En móvil/tablet se convierte en un drawer deslizante con overlay,
    controlado por un botón de menú (hamburguesa) nuevo en la barra
    superior, y se cierra automáticamente al navegar.
  - Nuevo `components/layout/sidebar-context.tsx` (estado del drawer) y
    `components/layout/mobile-menu-button.tsx`.
- Verificado: `tsc`, `next build`, `eslint` y `vitest` (19 pruebas) pasan
  limpios.

Pendiente para las siguientes fases (según lo priorizado por el usuario):
tablas y formularios con mejoras de jerarquía visual/espaciado, tarjetas de
KPI con iconografía por módulo, y una pasada de consistencia visual sobre
Clientes, Proveedores, Cotizaciones, Facturas, Cobros/Pagos, Bancos,
Proyectos, Gastos, Reportes, Configuración y Usuarios.

## Proveedores: Cuenta Banco + Tipo de servicio; Tareas: alertas de asignación

**Proveedores**
- Nuevos campos: `bank_name` (banco donde se le paga al proveedor —
  select con el catálogo `bank_catalog` como sugerencia, mismo patrón que
  `payee_bank_name` en gastos, con fallback de texto libre si el banco no
  está en el catálogo), `bank_account_number` (número de cuenta) y
  `service_type` (tipo de servicio, distinto de `category` que ya existía
  como rubro libre).
- Migración `049_suppliers_bank_service_type.sql` — solo agrega columnas
  nuevas (`add column if not exists`), no toca datos existentes.
- Formularios de creación y edición de proveedor actualizados; el listado
  de proveedores ahora muestra la columna "Tipo de servicio"; la
  importación CSV acepta las tres columnas nuevas como opcionales
  (documentado en `/suppliers/import`).

**Tareas — alertas de asignación**
- Cuando se crea una tarea con `assigned_to`, o se reasigna a otro
  usuario, se genera automáticamente una notificación interna (tabla
  `notifications` ya existente, visible en la campanita `NotificationBell`)
  para el usuario asignado. No se notifica si la tarea queda sin asignar
  ni si alguien se la asigna a sí mismo.
- Implementado como trigger de base de datos (`notify_task_assignment()`,
  `SECURITY DEFINER`, sobre `AFTER INSERT OR UPDATE OF assigned_to` en
  `tasks`) — mismo patrón que `generate_due_date_alerts()` de la Fase 4 de
  cobros. Al vivir en la base de datos, cubre cualquier vía de asignación
  presente o futura (formulario actual, una futura edición de tarea,
  importaciones, etc.) sin depender de que cada Server Action recuerde
  disparar la alerta.
- Migración `050_task_assignment_notifications.sql`.
- Verificado con datos reales: tarea asignada a otro usuario → notificación
  creada; tarea auto-asignada → sin notificación; reasignación a un tercer
  usuario → nueva notificación para el nuevo asignado. Todo limpiado
  después (0 filas de prueba remanentes).

## Fix: el QR del autenticador mostraba el texto "data:image/svg+xml;utf-8," encima

El usuario mandó una captura real: al activar el autenticador, arriba del
QR aparecía literalmente el texto `data:image/svg+xml;utf-8,` — el campo
`qr_code` que devuelve Supabase en realidad es un **data URI completo**
(`data:image/svg+xml;utf-8,<svg>...`), no el SVG suelto como asumí al
construirlo. Usarlo con `dangerouslySetInnerHTML` hacía que el navegador
mostrara el prefijo del data URI como texto plano antes de interpretar el
SVG.

- Corregido: ahora se usa `<img src={qrCode} />` — un data URI es
  perfectamente válido como `src` de una imagen, y así el navegador lo
  interpreta completo en vez de mezclarlo con texto.
- Verificado: `tsc`, `npm run build`, `eslint` (una advertencia esperada
  por usar `<img>` en vez de `next/image` — correcto en este caso, ya
  documentado que `next/image` se evita a propósito por portabilidad), 19
  tests unitarios.

## Feat: MFA con Google Authenticator (TOTP) — activación y reto al iniciar sesión

Pedido del usuario: activar verificación en dos pasos con Google
Authenticator. Usa el soporte nativo de MFA de Supabase Auth (TOTP) — no
requiere ningún servicio ni costo externo, funciona con Google
Authenticator, Authy, 1Password o cualquier app compatible con el
estándar.

- **Activación** (Mi Perfil → Inicio de sesión y seguridad →
  Autenticador): genera un QR real (vía `supabase.auth.mfa.enroll`), la
  persona lo escanea y confirma con el código de 6 dígitos
  (`mfa.challenge` + `mfa.verify`). También clave manual como respaldo
  por si no puede escanear.
- **Quitar autenticador**: disponible una vez activo.
- **Reto al iniciar sesión**: si el usuario tiene el autenticador activo,
  después de la contraseña se le pide el código de 6 dígitos
  (`/mfa-challenge`, fuera del layout del dashboard) antes de dejarlo
  entrar — se verifica el nivel de autenticación (aal1→aal2) tanto en el
  login como en el layout del dashboard (por si alguien entra directo a
  una URL sin pasar por el reto).
- "Verificación en dos pasos" en Mi Perfil ahora refleja el estado real
  (Activada/pendiente) en vez de "Próximamente".
- **No se pudo probar end-to-end**: confirmé con evidencia (no solo
  supuesto) que este entorno bloquea la conexión a `*.supabase.co`
  (`curl` devuelve `x-deny-reason: host_not_allowed` del proxy de red,
  antes de siquiera llegar a Supabase) — misma limitación que ya aplicaba
  a crear usuarios y resetear contraseñas, ahora confirmada con prueba
  directa en vez de asumida.
- Verificado: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Feat: corregir el correo de un usuario + verificación real de que el correo existe

Pedido del usuario: poder corregir el correo de un usuario si se
equivocó al escribirlo, y confirmar que el correo existe de verdad (no
solo que tiene formato válido) — para usuarios existentes y para
cualquiera que se agregue de aquí en adelante.

**Investigado antes de construir** (comportamiento real de Supabase, con
documentación oficial inconsistente entre versiones): la API de
administración (`admin.updateUserById`) aplica el cambio de correo **de
inmediato, sin flujo de confirmación** — eso confirma la corrección pero
no prueba que el correo sea real. Lo que sí prueba que existe es un
correo de confirmación real que la persona tenga que abrir
(`auth.resend({type: "signup"})`).

- **Cambio de comportamiento real para usuarios nuevos**: antes se creaban
  con `email_confirm: true` (activos de inmediato). Ahora se crean con
  `email_confirm: false` y se envía automáticamente un correo de
  confirmación — el usuario debe hacer clic antes de poder entrar. Es el
  trade-off necesario para que la verificación sea real.
- **Corregir correo de un usuario existente**: clic sobre el correo en
  Configuración → Usuarios, se actualiza vía la API de administración
  (`email_confirm: false`) y se reenvía automáticamente el correo de
  confirmación a la dirección corregida.
- **Insignia de estado** por usuario: ✅ verificado o ⚠️ "Reenviar" (clic
  para volver a mandar el correo de confirmación) — el estado real viene
  de `auth.users.email_confirmed_at` (leído con el cliente de
  administración, ya que no es un campo expuesto por RLS normal).
- **No se pudo probar end-to-end** (misma limitación de red que crear
  usuarios y resetear contraseñas) — reutiliza exactamente los mismos
  métodos ya confirmados funcionando en producción.
- Verificado: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Docs: README neutral entre plataformas de despliegue (Vercel, Cloudflare Pages, Azure)

Pedido del usuario: mantener el proyecto preparado para desplegarse en el
futuro en Cloudflare Pages, Azure u otra plataforma, sin depender
innecesariamente de Vercel. Auditoría real del código antes de proponer
cualquier cambio:

- **Confirmado, sin cambios necesarios**: cero dependencias `@vercel/*`,
  sin `vercel.json`, sin secretos hardcodeados (solo 3 variables de
  entorno, todas de Supabase), sin uso de `next/image` (uno de los
  mayores candados típicos a Vercel), sin `middleware.ts` ni rutas con
  `runtime = "edge"`, cron jobs ya corriendo en Supabase (`pg_cron`), no
  en Vercel Cron, storage ya en Supabase Storage, no Vercel Blob.
- **Único punto real a tener en cuenta** (no es un problema, es una nota
  para cuando se elija plataforma): `@react-pdf/renderer` necesita
  runtime de Node.js completo — sin fricción en Azure, requiere
  `nodejs_compat` en Cloudflare Pages.
- **Único cambio hecho**: reescrita la sección "Deployment" del
  `README.md` para ser neutral entre plataformas (Vercel queda como "la
  opción actual", no como "la recomendación"), con la nota de
  portabilidad de arriba. Sin tocar código, sin tocar la base de datos,
  sin tocar nada que ya funcione — tal como se pidió explícitamente.

## Fix: Factura y Cotización tradicionales con el mismo formato limpio de la Electrónica

El usuario pidió aplicarle a los PDF de Cotización y Factura tradicionales
el mismo formato visual (recuadros, sin barra oscura) que ya tenía la
Factura Electrónica — "se ve más limpia" — sin cambiar la información que
ya mostraban, y sin agregar los recuadros de "Autorizado Por / Recibido
Por" en ninguno de los dos.

- Rediseñados `invoice-document.tsx` y `quotation-document.tsx`: header
  con nombre/dirección/teléfono/RNC de la empresa a la izquierda (sin
  barra oscura), título del documento + metadatos a la derecha, dos
  recuadros bordeados (Datos del cliente / Factura-Cotización No. y
  Fecha) — mismo patrón que ya usaba `invoice-electronic-document.tsx`.
- Toda la información que ya existía se conserva igual: NCF, condición de
  pago, estado, pagado (factura); válida hasta, condición de pago,
  condiciones/términos (cotización); comisión, descuento, ITBIS, balance
  pendiente en ambos.
- Sin recuadros de firma en ninguno de los dos (nunca los tuvieron, no se
  agregaron).
- Verificado visualmente: generé ambos PDF con datos reales, los convertí
  a imagen y confirmé que coinciden con el estilo limpio de la
  Electrónica, con toda la información intacta.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests
  unitarios.

## Chore: punto de recuperación pre-contabilidad-v1 + corrección de tax_rate_id vestigial + documentación de estado

Tres tareas ejecutadas tras una auditoría completa de arquitectura (leer/
analizar, sin modificar nada, para el diagnóstico de evolución hacia
contabilidad de partida doble):

1. **Punto de recuperación**: commit + tag anotado `pre-contabilidad-v1`,
   con `BACKUP-pre-contabilidad-v1.md` documentando el esquema completo
   (37 tablas), las 5 funciones de negocio, el conteo de 118 políticas
   RLS, y un snapshot de conteos/totales financieros para poder comparar
   después. Aclarado explícitamente qué NO es este respaldo (no es un
   `pg_dump` real de los datos — depende de los backups automáticos de
   Supabase, que el usuario debe confirmar en su Dashboard).
2. **Corrección de `tax_rate_id`** en `invoice_items`/`quotation_items`:
   era un campo vestigial (nunca se poblaba al crear una línea nueva,
   solo se copiaba al duplicar un documento — confirmado con datos
   reales: 0 de 8 líneas existentes lo tenían poblado). Corregido de
   forma puramente aditiva: ahora se busca una tasa activa del catálogo
   que coincida con el % elegido y se vincula si existe — **el cálculo
   del ITBIS no cambió en absoluto** (`tax_percent` sigue siendo la única
   fuente de verdad). Verificado con datos reales: inserté una línea con
   18% (vinculó correctamente a "ITBIS 18%") y otra con 5% personalizado
   (correctamente no vinculó nada), confirmé que el snapshot financiero
   completo (facturas, totales, ITBIS) siguió idéntico antes/después, y
   que las 8 líneas históricas siguen con `tax_rate_id` en null, sin
   tocar. Datos de prueba limpiados sin residuos.
3. **`ESTADO-ACTUAL-ERP.md`**: documento de referencia rápida de qué
   maneja y qué no maneja el sistema hoy, enlazando el diagnóstico
   completo y el punto de recuperación.
- Verificado: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Feat: Facturación Electrónica (e-CF) preparada — Tradicional o Electrónica, elegible por factura

Pedido del usuario, con una captura real de referencia (factura e-CF de
otro negocio) para adaptar al diseño de Mindfreak. **Importante, aclarado
antes de construir**: esto deja la arquitectura y el diseño LISTOS — no es
una integración real con la DGII (eso requiere certificación real del
negocio, que el usuario mismo dijo que todavía no tiene). Nunca se generan
e-NCF, código de seguridad o QR falsos — eso sería un problema legal, no
solo técnico.

- **Nuevos campos en `invoices`**: `billing_type` ('REGULAR'/'ELECTRONIC'),
  `e_ncf`, `e_ncf_valid_until`, `payment_type_code` (1-Contado/2-Crédito),
  `security_code`, `digital_signature_at`. Migración
  `048_electronic_billing.sql`, con comentarios en las columnas dejando
  explícito que `e_ncf`/`security_code` solo los puede emitir la DGII o un
  proveedor certificado.
- **Selector "Tipo de facturación"** en Nueva Factura y en el detalle
  (editable después) — Tradicional (NCF, como ya existía) o Electrónica
  (e-CF). Al elegir Electrónica aparecen los campos propios del e-CF.
- **Nuevo PDF** (`invoice-electronic-document.tsx`): mismo layout que la
  referencia del usuario (e-NCF y su vigencia arriba a la derecha, cajas
  de Facturado A / Factura No.-Fecha, tabla de ítems, Subtotal/Comisión/
  Descuento Global/ITBIS/Balance, recuadros de firma) pero con la
  identidad visual de Mindfreak (no una copia literal del formato ajeno).
  Mientras no haya `e_ncf` real, muestra una insignia clara **"PENDIENTE
  DE CERTIFICACIÓN DGII"** en vez de inventar un código de seguridad o QR
  — cuando sí exista (por una integración real futura), se muestran esos
  datos automáticamente.
- La acción de generar PDF ahora elige la plantilla correcta según
  `billing_type` de la factura.
- **Verificado de verdad, ambos estados**: generé el PDF con datos
  reales sin certificar (muestra "Pendiente de certificación DGII") y con
  datos de certificación simulados para PROBAR el layout (no para usarlos
  de verdad) — confirmé visualmente en ambos casos que el diseño coincide
  con la referencia, adaptado a la marca.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Feat: PDF de Recibo de Cobro y Comprobante de Pago a Proveedor (nuevos)

Pedido del usuario: aplicar el mismo diseño de Cotización/Factura a otros
documentos. No existía ningún PDF de recibo en el sistema — se construyó
desde cero, no solo se restiló.

- **Nuevos documentos**: `lib/pdf/receipt-document.tsx` (Recibo de Cobro,
  para `customer_payments`) y `lib/pdf/supplier-receipt-document.tsx`
  (Comprobante de Pago, para `supplier_payments`). Mismo Design System que
  Cotización/Factura: header oscuro con logo sobre fondo blanco, pastilla
  de tipo de documento, acento de marca. Monto destacado en una caja grande
  centrada, balance pendiente (de la factura o del gasto) resaltado abajo.
  El comprobante de proveedor incluye el banco de origen (propio) y el
  banco destino del proveedor (`payee_bank_name`) cuando existe.
- **Nuevas acciones** en `features/payments/actions.ts`:
  `generatePaymentReceiptAction` / `generateSupplierPaymentReceiptAction`
  — mismo patrón que las de Cotización/Factura (genera el PDF, lo sube a
  `documents/{companyId}/receipts/...`, devuelve un link firmado de 7 días).
  El número de recibo se deriva del UUID del pago (`REC-XXXXXXXX` /
  `PAG-XXXXXXXX`), ya que no existe una numeración secuencial dedicada.
- **UI**: nuevo botón reutilizable `DownloadReceiptButton`, agregado como
  columna en la tabla de Cobros (detalle de Factura) y en el Historial de
  pagos (detalle de Gasto).
- Verificado de verdad: ambos PDFs generados con datos de prueba,
  convertidos a imagen (`pdftoppm`) e inspeccionados visualmente —
  consistentes con el estilo de Cotización/Factura.
- Verificado también: `tsc`, `npm run build`, `eslint`, ahora 19 tests
  unitarios (17 + 2 nuevos de recibos) limpios.

## Fix: el logo se veía sin el trazo negro en el header del PDF

La subida del logo ya funcionó (confirma que el fix anterior de RLS
resolvió el problema real) — pero en el PDF solo se veían las barras teal,
sin la "M" negra. Causa: el header del PDF es negro y el logo tiene su
trazo principal en negro sobre fondo transparente — se vuelve invisible al
mezclarse con el fondo.

- `lib/pdf/quotation-document.tsx` / `invoice-document.tsx`: el logo ahora
  se muestra dentro de un recuadro blanco redondeado (40×40) dentro del
  header oscuro, para que cualquier logo (sin importar sus colores) se vea
  bien sobre el fondo oscuro.
- Verificado de verdad: probé con el logo real del usuario (recortado al
  ícono), lo rendericé y lo convertí a imagen — confirmado visualmente que
  la "M" negra ahora se ve completa sobre su propio fondo blanco.
- Verificado también: `tsc`, `npm run build`, `eslint`, 17 tests unitarios.

## Fix: la fecha de vencimiento se veía vacía al elegir una condición de pago

El usuario mandó una captura: al elegir "Crédito 30 días" en Nueva Factura,
el campo "Fecha de vencimiento" se veía completamente vacío
("dd/mm/yyyy") — técnicamente no era un bug (el vencimiento real sí se
calcula bien al crear la factura, ya que lo hace un trigger en la base de
datos), pero visualmente parecía roto/sin funcionar.

- **Nueva Factura** y **editar factura** (`InvoiceHeaderForm`): el campo
  de vencimiento ahora muestra una **vista previa calculada en vivo**
  (fecha de emisión + días de crédito de la condición elegida) mientras se
  llena el formulario, en vez de quedar en blanco. Sigue deshabilitado
  (no editable directo) porque el valor real lo pone el trigger al
  guardar, pero ahora se ve la fecha esperada de una vez.
- Corregido también un posible warning de React (mezclar input controlado/
  no controlado) al implementar esto — quedó completamente controlado con
  un solo estado.
- Verificado: el cálculo en el navegador (JS) coincide exacto con el que
  hace la base de datos (probado con la misma fecha de la captura del
  usuario: 16/09/2026 + 30 días = 16/10/2026).
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Fase 4 del módulo financiero avanzado: Alertas, Responsable de cobro e Historial de gestión

- **Alertas de vencimiento de verdad automáticas** (no solo calculadas al
  abrir una pantalla): nueva función `generate_due_date_alerts()`
  programada con **pg_cron** para correr todos los días a las 8:00am —
  identifica facturas vencidas, que vencen hoy, o en 1/3/7 días
  exactamente (tal como se pidió), y genera una notificación interna para
  el **responsable de cobro** de esa factura. Protegida contra duplicados
  (no genera la misma alerta dos veces el mismo día para la misma
  factura).
- **Responsable de cobro**: nuevo campo `invoices.responsible_user_id` +
  selector en el detalle de cada factura — cualquier usuario de la
  compañía puede ser asignado.
- **Historial de gestión de cobro**: nueva tabla
  `invoice_collection_history` — cada intento de cobro (llamada, correo,
  WhatsApp, visita, nota) queda registrado con fecha, usuario, comentario,
  resultado y próxima acción. No se edita ni se borra (igual que
  audit_logs) — es un registro de auditoría de gestión.
- **Campana de notificaciones** (nueva, en la esquina superior — pendiente
  del backlog desde hacía tiempo): contador de no leídas, panel
  desplegable, clic en una notificación la marca como leída y navega a la
  factura correspondiente, "Marcar todas como leídas".
- **Verificado con datos reales, la función completa de punta a punta**:
  creé una factura vencida y otra que vence en 3 días, ambas con
  responsable asignado, corrí `generate_due_date_alerts()` manualmente
  (simula lo que hará el cron mañana) — generó exactamente 2
  notificaciones con el título/monto/cliente correctos ("Factura vencida:
  ...", "Vence en 3 días: ..."). Confirmé que correrla una segunda vez no
  duplica nada (0 notificaciones nuevas). También probé asignar un
  responsable y registrar una gestión de cobro real bajo RLS — ambos
  funcionan. Confirmé que el cron job quedó programado y activo. Todos los
  datos de prueba limpiados sin residuos.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.
- **Pendiente**: Fase 5 (arquitectura de automatizaciones más generales —
  motor de reglas SI/ENTONCES, canales externos email/WhatsApp — solo
  preparar, no implementar todavía, tal como se pidió explícitamente).

## Fase 3 del módulo financiero avanzado: Dashboard configurable por usuario

La fase más grande de las 5. Diseño: sin librería de drag & drop nueva
(HTML5 nativo), sin JSON-widgets-desde-cero (registro de widgets en
código, agregar uno nuevo = una entrada + un caso, no rediseñar nada).

- **Nueva tabla `dashboard_widget_preferences`**: un registro por usuario
  por compañía, con la lista de widgets en JSONB (tipo, visible, tamaño —
  el orden es la posición en el array). RLS: cada quien solo ve/edita su
  propia fila, 100% personal (nadie más la puede tocar, ni un admin).
  Migración `045_dashboard_widgets.sql`. Persiste de verdad: sobrevive a
  cerrar sesión, recargar, y volver a entrar (es una fila en la base de
  datos, no localStorage).
- **Catálogo de 17 widgets** (`features/dashboard-widgets/registry.ts`):
  Total por cobrar/vencido/vence hoy, Cuentas por pagar, Ingresos/Gastos/
  Utilidad/Margen del mes, Proyectos activos, Cotizaciones pendientes,
  Gráfico de flujo financiero, Facturas vencidas/próximas, Últimos cobros/
  pagos, Tareas pendientes, Rentabilidad por proyecto (top 5). Cada uno
  reutiliza queries ya existentes (KPIs del Dashboard, el Dashboard de CxC
  de la Fase 2, Reportes, Pagos, Tareas) — una sola pasada de datos en
  paralelo (`getDashboardWidgetBundle`), sin duplicar lógica.
- **`/dashboard`**: ahora se arma en base a la configuración guardada del
  usuario (o un layout por defecto — el mismo Dashboard "de fábrica" que
  ya existía — si nunca ha personalizado nada). Botón "Personalizar
  Dashboard" arriba.
- **`/dashboard/customize`**: lista arrastrable (drag & drop nativo del
  navegador, sin librería nueva) — mostrar/ocultar cada widget, cambiar su
  tamaño (chico/mediano/grande), reordenar arrastrando. Guarda con un
  botón, se aplica de inmediato al volver al Dashboard.
- **Decisión de diseño**: el punto de entrada "Personalizar Dashboard" se
  puso directo en la página del Dashboard, visible para **todos** los
  usuarios por igual (admin o no) — en vez de esconderlo dentro de "Mi
  perfil" solo para no-admins como se planteó originalmente. Es más
  descubrible y consistente para todos, dado que es una preferencia 100%
  personal en cualquier caso. Se puede mover si se prefiere la ubicación
  original.
- Verificado con datos reales: insert/select bajo RLS con la fila real del
  usuario admin — guardó y leyó de vuelta exactamente la configuración de
  prueba (2 widgets con tamaños distintos). Revertido al layout por
  defecto al terminar (no se dejó una configuración de prueba puesta al
  usuario real).
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.
- **Pendiente**: Fase 4 (alertas de vencimiento + responsable de cobro +
  historial de gestión) y Fase 5 (arquitectura de automatizaciones, solo
  preparar).

## Fase 2 del módulo financiero avanzado: Dashboard de Cuentas por Cobrar y Vencimientos

- **Nuevo reporte "Cuentas por Cobrar y Vencimientos"** dentro de Reportes
  (ahora el reporte por defecto al entrar): 6 KPIs (total por cobrar,
  vencido, vence hoy, próximos 7/15/30 días — acumulativos, consolidados
  en la moneda base), línea de tiempo horizontal de vencimientos por día
  (próximos 30 días), tabla de facturas vencidas, tabla de facturas
  próximas a vencer, y dos tablas de cotizaciones: pendientes de
  aceptación (SENT/VIEWED/NEGOTIATING) y aceptadas sin facturar todavía
  (APPROVED sin ninguna factura vinculada).
- Nueva query `getReceivablesDashboard()` en `features/reports/queries.ts`
  — reutiliza el mismo set base de facturas pendientes que ya usaba el
  reporte de Cuentas por Cobrar existente (ahora renombrado "(detalle)"
  para distinguirlo de este dashboard nuevo), sin duplicar lógica.
- **Verificado con datos reales, no solo por partes**: creé 4 facturas con
  vencimientos exactos (vencida hace 32 días, vence hoy, en 5 días, en 20
  días) y confirmé que el cálculo de días (`due_date - current_date` en la
  base de datos) coincide exacto con la lógica en JS — y por lo tanto los
  6 totales cayeron en los cubos correctos (vencido=1000, hoy=2000,
  7 días=3000, 15 días=3000, 30 días=7000, total=10000). También creé una
  cotización pendiente y una aprobada sin facturar, y confirmé que esta
  última no tiene ninguna factura vinculada (se clasifica correctamente).
  Todos los datos de prueba limpiados sin residuos.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.
- **Pendiente**: vista visual de calendario tipo grid (hoy es una línea de
  tiempo horizontal por fecha, funcional pero más simple que un calendario
  completo) — se puede mejorar en una pasada de diseño aparte si se
  quiere. Las Fases 3-5 (dashboard configurable, alertas/responsable/
  historial, arquitectura de automatizaciones) siguen pendientes.

## Fix: 3 pendientes del PDF y de líneas de factura (feedback real del usuario)

El usuario mandó capturas reales tras probar el vencimiento automático (que
funcionó perfecto: 16/09 + 30 días = 16/10) con tres observaciones:

1. **El Impuesto (%) no salía en 18% solo al agregar una línea de
   factura/cotización** — bug real de React: un `form.reset()` nativo NO
   vuelve a aplicar el `defaultValue` de un campo si su `key` no cambia
   entre renders (el `key` del campo de Impuesto se quedaba igual mientras
   no se cambiara de servicio). Corregido con un contador `resetKey` que
   se suma a la key en cada línea agregada, forzando un remount real con
   el valor por defecto correcto. Aplicado en Facturas y Cotizaciones. De
   paso, `getDefaultTaxRate()` ahora fuerza `Number()` sobre la tasa (Postgres
   a veces la entrega como texto).
2. **El PDF de factura no mostraba la condición de pago**, a diferencia
   del de cotización. Se agregó la fila "Condición" en "ESTADO DE PAGO" —
   mismo patrón que ya existía en el PDF de cotización — y se conectó el
   nombre real de la condición en ambas acciones de generar PDF (antes
   solo estaba el tipo declarado, sin el dato realmente conectado).
3. **"Balance pendiente" en rojo** llamaba la atención de más, como si el
   cliente estuviera atrasado en una factura recién creada. Cambiado a un
   gris neutro (`#374151`), igual que el resto de los totales.
- Verificado de verdad: rendericé el PDF con "Crédito 30 días" real y
  confirmé visualmente (imagen) que aparece la condición y que el balance
  ya no se ve en rojo.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Fix: columna "Impuesto" visible en las líneas de Cotización/Factura

Complemento al fix anterior (el ITBIS sí se aplicaba, confirmado en la
base de datos: la línea tenía `tax: 360.00` sobre `unit_price: 2000.00`,
18% exacto) — pero la tabla de líneas no tenía ninguna columna que lo
mostrara, solo Descripción/Cant./Precio/Descuento/Subtotal, así que
parecía que no se había aplicado.

- Nueva columna "Impuesto" en la tabla de líneas, tanto en Facturas como
  en Cotizaciones. La columna que antes decía "Subtotal" (que en realidad
  ya incluye el impuesto de esa línea) se renombró a "Total" para no
  confundir con el Subtotal general de la factura/cotización (que si es
  antes de impuestos).
- Verificado con datos reales: confirmada la línea de la factura del
  usuario en la base de datos (INV-0005, "Capacitacion": unit_price 2000,
  tax 360, subtotal 2360 — 18% correcto).
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Fase 1 del módulo financiero avanzado: Condiciones de pago + vencimiento automático

Pedido grande del usuario (14 secciones) — dividido en 5 fases. Esta es la
Fase 1: catálogo de Condiciones de pago, integrado en Cotizaciones y
Facturas, con cálculo automático de vencimiento.

- **Nueva tabla `payment_terms`** (catálogo por compañía, mismo patrón que
  `bank_catalog`/`tax_rates`): nombre, días de crédito, forma de pago,
  % anticipo, % saldo (deben sumar 100, validado en BD y en el formulario),
  activo/inactivo. Migración `044_payment_terms.sql`. Prellenada con las 6
  condiciones que pidió el usuario (Contado, Crédito 15/30/45/60 días,
  50/50).
- **Nueva pantalla Configuración → Condiciones de pago**: crear/activar-
  desactivar/eliminar, sin tocar código para agregar nuevas.
- **Cotizaciones**: nuevo selector "Condición de pago" en Nueva Cotización
  — al elegir una, sus valores (días de crédito, % anticipo/saldo, forma
  de pago) se "congelan" en la cotización (mismo criterio que la tasa de
  cambio: si el catálogo cambia después, las cotizaciones ya hechas no se
  alteran). Se muestra en el detalle.
- **Facturas**: nuevo selector "Condición de pago" (en Nueva Factura y al
  editar el borrador). **Vencimiento automático** vía trigger de base de
  datos: `due_date = issue_date + credit_days`, recalculado si cambia la
  fecha de emisión. Sin condición de pago, `due_date` se sigue escribiendo
  a mano como antes — no se rompió nada de lo existente.
- **Herencia automática cotización→factura** ("cuando se acepta la
  cotización, la condición de pago pasa automáticamente a facturación"):
  al crear una factura desde un proyecto que viene de una cotización con
  condición de pago, se hereda sola si no se elige otra explícitamente.
- **Verificado end-to-end con datos reales** (no solo por partes): probé
  el ejemplo exacto del usuario (15/09/2026 + Crédito 30 días = 15/10/2026)
  directo en la función del trigger — coincide. Después armé la cadena
  completa Cliente → Cotización (con Crédito 15 días) → Proyecto → Factura
  heredando la condición → confirmé que el vencimiento calculado fue
  2026-09-30 (15/09 + 15 días), exacto. Todos los datos de prueba
  limpiados sin dejar residuos.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

**Pendiente (fases siguientes)**: Dashboard de Cuentas por Cobrar y
Vencimientos (Fase 2), Dashboard configurable por usuario con widgets
drag&drop (Fase 3), alertas de vencimiento + responsable de cobro +
historial de gestión (Fase 4), arquitectura de automatizaciones futuras
(Fase 5, solo preparar, no implementar todavía).

## Fix: el círculo del avatar usaba el azul de la interfaz, no el teal real de la marca

El usuario notó que el círculo seguía azul en vez del teal de la "E" del
logo (`#17a6b8`). Causa real: había dos conceptos de "acento" mezclados —
el `brand-accent` de la interfaz general (azul, del rediseño ERP) y el
`brand_accent` real de la empresa guardado en Configuración → Sistema
(teal). El avatar usaba la clase de Tailwind del primero por error.

- `UserMenu` ahora recibe `brandAccent` como prop (el valor real de
  `companies.brand_accent`) y lo aplica con `style` inline (es un color
  dinámico, no una clase fija) — tanto en el círculo chico del header como
  en el grande del menú desplegable.
- El resto de la interfaz (links, botones) se queda con el azul del
  Design System general a propósito — el avatar es el único elemento
  pensado para reflejar la identidad de marca real de la empresa.
- Verificado: `tsc`, `npm run build`, `eslint`, 19 tests unitarios limpios.

## Feat: "Inicio de sesión y seguridad" en formato de lista (estilo cuenta de Google)

Ajuste sobre la pestaña de seguridad de "Mi perfil", con una captura de
referencia: filas etiqueta-izquierda/valor-derecha, separadas por líneas,
en vez de tarjetas sueltas.

- Nuevo `SecurityRow`/`ComingSoonBadge` reutilizables.
- Filas reales y funcionales: Id. de usuario, Correo (solo lectura),
  **Contraseña** (clic en "Cambiar" expande el formulario inline, se
  colapsa solo al guardar), **Teléfono** (editable inline sin recargar).
- Filas de MFA (**Autenticador**, **Verificación en dos pasos**, **Claves
  de acceso/Passkeys**) se muestran en la lista con una insignia
  "Próximamente" — visibles para que el usuario sepa que van a existir,
  pero sin fingir que ya funcionan (siguen pendientes, evaluadas en
  `MANUAL_NOTES.md`).
- Verificado: `tsc`, `npm run build`, `eslint`, 19 tests unitarios limpios.

## Feat: "Mi perfil" separado en Perfil / Inicio de sesión y seguridad

Pedido del usuario (basado en un patrón común tipo Google/Slack): separar
"Mi perfil" en dos pestañas.

- Nueva columna `profiles.position` (ocupación/cargo) — migración
  `043_profile_position.sql`.
- **Pestaña "Perfil"**: nombre, ocupación/cargo, teléfono.
- **Pestaña "Inicio de sesión y seguridad"**: correo (de solo lectura, con
  nota de contactar a un admin para cambiarlo) y cambiar contraseña.
- Verificado con datos reales: update de `position` bajo RLS funciona,
  dato de prueba revertido.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Fix: menú de usuario persistente + acceso restringido a "Mi perfil"

Feedback real tras probar la creación de usuarios (que sí funcionó — el
Service Role Key quedó bien configurada):

1. No había forma de editar el nombre de un usuario ya creado.
2. "Cerrar sesión" solo existía en el Dashboard — si el usuario estaba en
   cualquier otra pantalla, no podía salir.
3. Un usuario no-admin, al hacer clic en el ícono de Configuración, "no
   pasaba nada" (en realidad sí pasaba: el guard de permisos lo regresaba
   al Dashboard en silencio, confuso).
4. Un usuario no-admin no tenía forma de cambiar su propio nombre ni su
   contraseña — Configuración está bloqueada para él a propósito (es
   configuración de la EMPRESA), pero su propio perfil no debería estarlo.

Cambios:

- **Nuevo `UserMenu`** (avatar circular con iniciales, esquina superior
  derecha, en el layout compartido — visible en TODA la app, no solo en
  Dashboard): nombre, correo, link a "Mi perfil", "Cerrar sesión". El botón
  de cerrar sesión duplicado en el Dashboard se quitó.
- **Ícono de Configuración ahora se oculta por completo** si el usuario no
  tiene `settings.manage` — en vez de dejarlo hacer clic y devolverlo en
  silencio.
- **Nueva página `/profile`** ("Mi perfil"), disponible para **cualquier**
  usuario autenticado (no requiere `settings.manage` — es su propia
  cuenta, no configuración de empresa): editar su nombre/teléfono, y
  cambiar su contraseña (pide la contraseña actual primero, re-autentica
  antes de aplicar el cambio, para que una sesión abierta y desatendida no
  baste).
- **Configuración → Usuarios**: nombre de cada usuario ahora editable
  inline por un admin (antes solo texto fijo).
- Verificado con datos reales: update de `phone` en el propio perfil bajo
  RLS — funciona (y de paso confirmé que el nombre del admin estaba vacío
  desde siempre, ahora se puede completar desde "Mi perfil"). Dato de
  prueba revertido.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Feat: importar proveedores masivamente por CSV (mismo patrón que Clientes)

- `importSuppliersCsvAction`: mismo mecanismo exacto que la importación de
  Clientes ya existente (`papaparse`, registro en `import_batches`,
  reporte de éxitos/errores por fila). Columnas esperadas: `name, tax_id,
  category, email, phone, address` (solo `name` obligatorio).
- Nueva pantalla `/suppliers/import`, con historial de importaciones
  recientes — botón "Importar CSV" agregado en la lista de Proveedores.
- Verificado con datos reales: insert de un proveedor de prueba y de un
  registro de `import_batches` bajo los permisos reales — ambos
  funcionan. Datos de prueba limpiados sin residuos.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Feat: admin puede restablecer la contraseña de otros usuarios

- `resetUserPasswordAction`: usa el mismo cliente de administración
  (`SUPABASE_SECRET_KEY`) ya construido para crear usuarios —
  `admin.updateUserById(userId, {password})`, gatillado por
  `users.manage`.
- Nuevo botón "Restablecer contraseña" en Configuración → Usuarios, junto
  a cada usuario — expande un campo inline con generador de contraseña
  (mismo patrón que al crear un usuario).
- **No se pudo probar end-to-end** (misma limitación que crear usuarios:
  este entorno no tiene acceso de red a la API de administración de
  Supabase) — la lógica es idéntica a `createUserAction`, ya confirmada
  funcionando por el usuario en la app real.
- Verificado: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Fix: el PDF mostraba el % de la comisión, ahora solo "COMISIÓN" + el monto

El usuario pidió que en el documento impreso no se vea el porcentaje
("Comisión (20%)"), solo la etiqueta "COMISIÓN" y el monto — el cálculo
interno sigue usando el % igual, solo cambió lo que se muestra.

- Quitado el `({commission_percent}%)` de la fila de comisión en ambos
  PDF (Factura y Cotización, por consistencia — el usuario mencionó
  Factura, se aplicó igual a Cotización ya que se imprimen con el mismo
  formato).
- La vista en pantalla (detalle de factura/cotización dentro de la app)
  sigue mostrando el % — es información de referencia interna, no el
  documento que recibe el cliente.
- Verificado: `tsc`, `eslint`, 19 tests unitarios limpios.

## Feat: Comisión de la empresa en Cotizaciones y Facturas

Pedido del usuario, con dos decisiones de negocio confirmadas antes de
construir: (1) el cliente SÍ ve esta comisión, es un cargo más en su
factura/cotización; (2) el ITBIS SÍ se calcula también sobre el monto de
la comisión.

- **Nuevas columnas** `commission_percent`/`commission_amount` en
  `quotations` e `invoices`. Migración `047_commission.sql`.
- **Fórmula**: `Subtotal + Comisión − Descuento + ITBIS = Total`. El ITBIS
  de la comisión usa la **tasa efectiva del documento**
  (`impuesto_de_las_líneas / subtotal`), para quedar consistente aunque
  haya líneas con tasas distintas o exentas — no se asume 18% fijo.
- Campo **"Comisión de la empresa (%)"** en Nueva Cotización y Nueva
  Factura. Se recalcula solo al agregar/quitar líneas (igual que el resto
  de los totales).
- Se muestra en el detalle de ambos documentos y en sus PDF (fila
  "COMISIÓN (%)" entre Subtotal y Descuento) — solo aparece si es mayor a
  0%, para no ensuciar los documentos que no la usan.
- **Verificado de verdad con datos reales, no solo el cálculo aislado**:
  armé una cotización con 2 líneas (RD$1,000 + RD$500, 18% ITBIS cada una)
  y 10% de comisión — confirmé que la base de datos guardó exactamente
  Subtotal 1,500 → Comisión 150 → ITBIS 297 → Total 1,947 (coincide con el
  cálculo esperado a mano). Generé el PDF con esos mismos datos, lo
  convertí a imagen, y confirmé visualmente que la fila "COMISIÓN (10%)"
  aparece en el lugar correcto con el monto correcto. Datos de prueba
  limpiados sin residuos.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios
  (2 ajustados por la nueva forma del resultado).

## Fix: "duplicate key value violates unique constraint" al crear Cotización/Factura/Proyecto

El usuario reportó este error real al crear una cotización. Causa
confirmada con datos reales: la numeración usaba `count(*) + 1` — se
rompe apenas hay un **hueco** en la secuencia (una cotización/factura/
proyecto borrada en algún momento). Confirmé el hueco real: existían
COT-0001, 0002, 0003, 0006 (**sin el 0004**) — `count(*)` daba 4, así que
el siguiente número calculado era COT-0005, que ya existía → colisión.
El mismo patrón exacto estaba también en Facturas y Proyectos (sin hueco
todavía, pero con la misma falla latente).

- Las 3 funciones de numeración (`generateQuotationNumber`,
  `generateInvoiceNumber`, `generateProjectNumber`) ahora calculan el
  **máximo real** de los números ya usados (parseado en JS, no depende
  del orden lexicográfico del texto, que además falla solo con números
  de más de 4 dígitos) — tolera huecos sin colisionar.
- Verificado con los números reales actuales de cotizaciones (con el
  hueco real incluido): el cálculo da COT-0007, sin chocar con ninguno de
  los existentes.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Fix: servicio "Capacitacion" tenía 0% de impuesto guardado (dato, no bug de código)

El usuario reportó que al agregar el servicio "Capacitacion" a una
factura, el Impuesto (%) salía en 0 en vez de 18. Investigado: el
formulario de línea ya usa el `default_tax_percent` **propio del
servicio** cuando se elige uno del catálogo (correcto, cada servicio puede
tener su propia tasa) — pero ese servicio específico tenía 0% guardado
desde su creación (antes de que "Nuevo Servicio" trajera 18% por
defecto, o cambiado manualmente). Corregido el dato directamente (ahora
18%, confirmado junto con el resto de los servicios). No fue necesario
ningún cambio de código.

## Feat: módulo de Usuarios, Roles y Permisos (crear usuarios directo, sin invitación)

Pedido del usuario: poder crear usuarios directo desde la app (sin correo
de invitación, con contraseña temporal), asignar/editar sus roles, y una
matriz para editar qué permisos tiene cada rol. MFA queda documentado en
`MANUAL_NOTES.md` para una ronda futura (Supabase soporta TOTP y SMS/
WhatsApp nativos; se recomienda TOTP como método principal).

- **Nueva variable de entorno `SUPABASE_SECRET_KEY`** (antes "service_role",
  Supabase renombró sus llaves) — documentada en `.env.example`, nunca
  expuesta al cliente. `lib/supabase/admin.ts`: cliente dedicado, solo para
  la API de administración de Auth (crear usuarios) — nunca para leer/
  escribir datos de negocio (eso sigue siempre respetando RLS).
- **`createUserAction`**: crea el usuario directo vía
  `admin.createUser({email, password, email_confirm: true})` — sin correo
  de invitación, activo de inmediato. Actualiza el nombre en `profiles`
  (el trigger de F1 ya crea la fila automáticamente) y asigna los roles
  elegidos.
- **Gestión de usuarios existentes**: activar/desactivar, y cambiar sus
  roles (chips seleccionables) — `/settings/users`.
- **Nueva pantalla `/settings/roles`**: matriz de permisos por rol,
  agrupada por módulo. El rol Administrador siempre aparece con todo
  activado y no es editable (evita quedarse sin acceso a Configuración por
  accidente).
- **Dos bugs de RLS reales encontrados y corregidos** (migración
  `042_fix_users_roles_rls.sql`) antes de que llegaran a producción:
  1. `profiles_update` solo dejaba editar el propio perfil — no servía
     para activar/desactivar a otro usuario. Se agregó: también se puede
     si se tiene `users.manage` y el perfil objetivo es de la misma
     compañía.
  2. `role_permissions_insert`/`delete` exigían que el rol tuviera
     `company_id` propio, pero los 5 roles base son plantillas globales
     (`company_id = null`) — la condición nunca se cumplía y la política
     rechazaba todo. Se agregó la excepción para roles con `company_id
     is null`. Nota documentada: en un futuro con más de una compañía en
     la misma instancia, editar una plantilla global las afectaría a
     todas — no es un problema hoy (V1 tiene una sola compañía).
- **Verificado con datos reales**: insert/delete en `role_permissions`
  para un rol del sistema (antes fallaba con error de RLS, ahora
  funciona) — probado y revertido sin dejar residuos. Lógica de la
  política de `profiles` verificada con una consulta directa.
- **No pude probar `createUserAction` end-to-end** (crear un usuario real
  de Auth) — este entorno no tiene acceso de red a la API de Supabase,
  solo a la base de datos vía SQL. Pendiente que el usuario lo pruebe en
  la app real una vez tenga `SUPABASE_SECRET_KEY` configurada.
- Verificado también: `tsc`, `npm run build`, `eslint`, 19 tests unitarios.

## Fix: "new row violates row-level security policy" al subir el logo

El usuario reportó este error real al intentar subir el logo en
Configuración → Sistema — confirma un problema que ya había investigado
antes sin resolver del todo (ver nota en la Ronda de Configuración): el
bucket `branding` (creado en `034_settings_organization.sql`) rechaza
cualquier INSERT en `storage.objects`, **incluso con una política trivial
`with check (true)`**, e **incluso en un bucket completamente nuevo creado
desde cero con su propia política**. Se descartaron como causa: triggers,
grants, permisos, public vs. private, nombre del bucket — nada de eso
explica el fallo. El bucket `documents` (F8), en cambio, sigue funcionando
perfecto para el mismo tipo de operación.

**Solución (workaround estable, no una explicación del bug)**:
`uploadLogoAction` ahora guarda el logo dentro del bucket `documents`
(privado, probado) en una subcarpeta `{companyId}/branding/`, generando un
**link firmado de ~10 años** en vez de una URL pública directa (ya que
`documents` no es público). Confirmado con búsqueda que Supabase permite
expiraciones de años sin problema.

- Migración `041_deprecate_branding_bucket.sql`: elimina las políticas del
  bucket `branding` (ya no se usa) — el bucket en sí queda inerte, no se
  puede borrar por SQL directo (protegido por Supabase Storage), inofensivo.
- Verificado con datos reales: INSERT en la ruta real
  `{companyId}/branding/logo.png` dentro de `documents` — funciona.
  Confirmados los permisos `documents.view`/`settings.manage` del usuario
  admin, necesarios para insertar y para generar el link firmado.
- **No pude probar la subida real end-to-end** (sin acceso de red desde
  este entorno a la API de Storage de Supabase, solo a la base de datos vía
  SQL) — la simulación por SQL confirma que la política ya no bloquea la
  ruta, pero pide al usuario confirmar en la app real.
- Verificado también: `tsc`, `npm run build`, `eslint`, 17 tests unitarios.

## Rediseño de los PDF de Cotización y Factura (el documento que le llega al cliente)

Pedido del usuario: mejorar visualmente el PDF real que se envía al
cliente, usando como referencia una cotización de ejemplo ya bien diseñada
(header oscuro + banda teal, tabla numerada, totales resaltados).

- **Reescritos** `lib/pdf/quotation-document.tsx` e
  `lib/pdf/invoice-document.tsx`: header con el logo y color de marca reales
  de la empresa (`companies.logo_url`/`brand_primary`/`brand_accent` — ya
  configurables desde Configuración → Sistema, cero pasos manuales extra),
  pastilla de tipo de documento, metadatos alineados a la derecha (No. doc,
  RNC, fecha, vencimiento), sección de datos del cliente (con RNC/email/
  teléfono, antes no se mostraban), tabla numerada con encabezado y filas
  alternas en el color de marca, bloque de totales con el total resaltado
  en el color de acento. Factura además muestra estado (traducido al
  español) y balance pendiente en rojo si aplica.
- Las acciones de generar el PDF (`generateQuotationShareLinkAction`/
  `generateInvoiceShareLinkAction`) ahora piden también `logo_url`,
  `brand_primary`, `brand_accent` de la empresa y `tax_id`/`email`/`phone`
  del cliente — antes no se pedían.
- **Verificado de verdad, no solo por tipo**: generé ambos PDFs con datos
  idénticos al ejemplo del usuario, los convertí a imagen (`pdftoppm`) y
  los inspeccioné visualmente — coinciden con el estilo de referencia.
  También confirmé que si el logo aún no existe o la URL está rota, el PDF
  se sigue generando sin romperse (solo omite la imagen).
- Nuevo test permanente `tests/unit/pdf-render.test.ts`: renderiza ambos
  PDFs sin datos reales para detectar si un cambio futuro rompe la
  generación.
- Verificado: `tsc`, `npm run build`, `eslint`, ahora 17 tests unitarios
  (15 + 2 nuevos de PDF) limpios.
- **Pendiente para que se vea igual de completo que el ejemplo**: subir el
  logo en Configuración → Sistema (hoy no hay ninguno), y si quieres el
  campo "Concepto del servicio" del ejemplo, ese es nuevo (no existe hoy en
  cotizaciones) — avísame si lo quieres agregar.

## Fix: "Tasa de cambio" solo debe aparecer si la moneda no es la base

Observación del usuario: mostrar siempre el campo "Tasa de cambio" no
tenía sentido — solo aplica cuando la moneda elegida es distinta a la
moneda base de la empresa (configurable en Configuración → Organización,
hoy DOP). Si coinciden, no hay conversión que hacer.

- Nuevo componente reutilizable `CurrencyExchangeFields`: el selector de
  Moneda se mantiene siempre visible; "Tasa de cambio" solo aparece cuando
  la moneda elegida ≠ moneda base de la empresa. Cuando no aplica, se envía
  `1` automáticamente por un input oculto (mismo comportamiento de fondo,
  nada cambia en el cálculo).
- Aplicado en los 4 formularios que tenían este par de campos: Nueva
  Cotización, Nueva Factura, Nuevo Gasto, Editar Gasto. Cada página ahora
  trae la moneda base real de la empresa (`getCompany().base_currency`) en
  vez de asumir DOP fijo.
- Verificado: `tsc`, `npm run build`, `eslint`, 15 tests unitarios limpios.

## Ronda 3 (última) de la nueva lógica financiera: comas en vivo en todos los formularios de dinero

Extendido `MoneyInput` (construido en una ronda anterior, solo aplicado en
la línea de Cotizaciones) a **todos** los campos de dinero del sistema:

- **Cotizaciones/Facturas**: precio y descuento de línea.
- **Gastos**: subtotal (nuevo y editar).
- **Pagos/Cobros**: monto en "Registrar cobro" y "Registrar pago".
- **Proyectos**: precio y costo estimado de línea; presupuesto (nuevo,
  editar, y al convertir una cotización en proyecto).
- **Productos y Servicios**: costo y precio de venta (nuevo y editar).
- **Bancos**: balance/deuda inicial y límite de crédito (nuevo y editar),
  monto en movimiento manual y en transferencia.
- `MoneyInput` ganó soporte para `disabled` (necesario para el balance
  inicial bloqueado en cuentas con movimientos).
- Verificado con los mismos ejemplos que pidió el usuario: `1000→1,000`,
  `1000000→1,000,000`, `125000.50→125,000.50` — confirmado con una prueba
  directa de la función de formateo.
- Verificado también: `tsc`, `npm run build`, `eslint`, 15 tests unitarios.
- **Con esto se completan las 3 rondas** del cambio de lógica financiera
  pedido por el usuario (cuenta obligatoria en cobros/pagos, tarjetas de
  crédito, y comas en vivo).

## Feat: catálogo de bancos parametrizable (Configuración → Bancos)

Pedido del usuario: poder elegir el banco de una lista desplegable en vez
de escribirlo cada vez (evita "Banreservas" vs. "banreservas" vs.
"BanReservas" regados por el sistema).

- Nueva tabla `bank_catalog` (por compañía, con RLS igual al resto de
  catálogos de Configuración — lectura abierta, escritura con
  `settings.manage`). Migración `040_bank_catalog.sql`.
- **Precargado con 12 bancos comunes de RD** (Banreservas, Banco Popular,
  BHD, Scotiabank, Banco Caribe, Vimenca, APAP, Cibao, Promerica, Lafise,
  Santa Cruz, y "Otro") — verificado que el seed insertó los 12 realmente.
- Nueva pestaña **Configuración → Bancos**: agregar, activar/desactivar y
  eliminar entradas del catálogo (mismo patrón que Categorías de gastos).
- Reemplazados los campos de texto libre por `<select>` de este catálogo
  en: "Nueva cuenta bancaria/tarjeta" y su edición (campo "Banco"), y
  "Nuevo gasto"/"Registrar pago"/"Editar gasto" (campo "Banco del
  proveedor"). Los formularios de edición muestran el valor guardado como
  opción de respaldo si no está en el catálogo (para no perder datos
  viejos ya escritos como texto libre).
- Verificado con datos reales: catálogo con los 12 bancos confirmado,
  insert/delete de una entrada nueva bajo RLS simulando el usuario admin.
  Datos de prueba limpiados.
- Verificado también: `tsc`, `npm run build`, `eslint`, 15 tests unitarios.

## Fix: gap real encontrado al revisar el trabajo de "banco del proveedor"

Al retomar esta funcionalidad (por una compactación de contexto, se había
perdido de vista que ya estaba construida) encontré y corregí dos
problemas reales:

1. **Funciones SQL duplicadas**: cada migración que le agregó un parámetro
   a `register_supplier_payment`/`create_card_expense` dejó una función
   **sobrecargada nueva** conviviendo con la anterior en vez de
   reemplazarla (2-3 versiones de cada una). Corregido con `DROP FUNCTION`
   explícito de las firmas viejas — confirmado que solo queda una versión
   de cada una.
2. **`create_card_expense` no generaba `supplier_payments`**: un gasto que
   nace ya pagado (tarjeta o banco elegido al crear) solo generaba el
   `bank_transaction`, nunca su fila de pago — el "Historial de pagos" del
   gasto se veía **vacío** aunque estuviera pagado. Corregido: ahora
   también inserta en `supplier_payments` (con el mismo `payee_bank_name`)
   cuando hay proveedor. Migración `039_card_expense_creates_payment_record.sql`.
- Verificado end-to-end con datos reales: gasto pagado de inmediato con
  proveedor + banco del proveedor — el pago apareció correctamente en
  `supplier_payments`, y el saldo del banco propio bajó igual que antes.
  Datos de prueba limpiados.
- Verificado también: `tsc`, `npm run build`, `eslint`, 15 tests unitarios.

## Feat: banco del proveedor (destino) separado del banco propio (origen)

Aclaración del usuario: quería anotar a qué banco se le deposita **al
proveedor**, no de cuál de sus propias cuentas sale el dinero (eso ya
existía). Es un dato informativo — puede variar de un pago a otro para el
mismo proveedor, así que va por gasto/pago, no en la ficha del proveedor.

- Migración `038_payee_bank_name.sql`: columna `payee_bank_name` nueva en
  `expenses` y `supplier_payments`. No participa en ningún cálculo de
  saldo — puramente informativo.
- Campo "Banco del proveedor (opcional)" agregado en: Nuevo Gasto, Editar
  Gasto, y Registrar Pago.
- Nueva columna "Banco del proveedor" en el historial de pagos del gasto
  (junto a "Banco (propio)", para no confundirlas).
- Verificado con datos reales: gasto creado con `payee_bank_name` guardó
  el valor correctamente y por separado de la cuenta propia de origen.
  Datos de prueba limpiados.
- Verificado también: `tsc`, `npm run build`, `eslint`, 15 tests unitarios.

## Feat: elegir banco al crear un gasto (no solo con tarjeta) — se paga de inmediato

Pedido del usuario: en "Nuevo gasto", poder indicar desde qué banco se pagó
aunque el método no sea tarjeta (ej. ya se hizo una transferencia y se sabe
de una vez desde dónde salió), en vez de tener que crear el gasto pendiente
y luego ir a "Registrar pago" a elegir el mismo banco por separado.

- `create_card_expense` generalizada: ahora acepta **cualquier tipo de
  cuenta** (banco o tarjeta), no solo tarjetas, y recibe el método de pago
  real como parámetro (antes fijo en 'CARD').
- "Nuevo gasto": si el método es Tarjeta, el selector de cuenta es
  obligatorio (solo tarjetas). Para cualquier otro método, aparece un
  selector **opcional** de banco ("Aún no lo sé" por defecto) — si se
  elige uno, el gasto queda pagado de inmediato con esa cuenta; si se deja
  en blanco, sigue naciendo pendiente como siempre (flujo de dos pasos
  intacto).
- Nueva query `listActiveAccountsForSelect` (bancos + tarjetas, filtrados
  en el formulario según el método elegido).
- Verificado con datos reales: gasto creado con método "Transferencia" +
  banco elegido quedó `PAID` de inmediato y el saldo del banco bajó en el
  mismo momento (10,000 → 9,500). Datos de prueba limpiados.
- Verificado también: `tsc`, `npm run build`, `eslint`, 15 tests unitarios.

## Fix: la página general /payments tampoco mostraba el banco

Mismo fix que la ronda anterior, pero en la pantalla que se me había
escapado: `/payments` (el listado general de "Cobros y pagos", separado de
los historiales dentro de cada factura/gasto).

- `listAllPayments`/`listAllSupplierPayments`: agregado el embed de
  `bank_accounts(name, bank_name)`.
- Nueva columna "Depositado en" (Cobros) / "Pagado desde" (Pagos a
  proveedores).
- Verificado: `tsc`, `npm run build`, `eslint`, 15 tests unitarios limpios.

## Fix: historial de pagos no mostraba el banco

En "Historial de pagos" (Gastos) y "Cobros" (Facturas) no se veía de qué
banco/tarjeta salió o entró el dinero, solo fecha/monto/método/referencia.

- `listPaymentsForExpense`/`listPaymentsForInvoice`: agregado el embed de
  `bank_accounts(name, bank_name)`.
- Nueva columna "Banco" en ambas tablas.
- Verificado: `tsc`, `npm run build`, `eslint`, 15 tests unitarios limpios.

## Edición de cuentas bancarias/tarjetas

Hasta ahora no existía forma de editar una cuenta bancaria o tarjeta una
vez creada (solo crear y activar/desactivar). Criterio adoptado (mismo
usado en Cotizaciones/Gastos: "editable solo en borrador"):

- **Siempre editable, sin restricción**: nombre, banco, número enmascarado,
  y **límite de crédito** (para que se pueda ajustar cuando el banco suba o
  baje el límite).
- **Solo editable si la cuenta todavía no tiene ningún movimiento**: el
  balance/deuda inicial y su fecha — cambiarlos después desincronizaría
  todo lo ya calculado. El campo se deshabilita automáticamente en la UI
  con una nota explicando por qué.
- Tipo (Banco/Tarjeta) y moneda quedan fijos para siempre desde la
  creación — cambiarlos retroactivamente no tiene sentido una vez que hay
  movimientos con esa moneda/semántica.
- Verificado con datos reales: con 0 movimientos, el conteo usado para
  decidir si se puede editar el balance inicial da 0 (editable); tras
  simular una compra con tarjeta, el conteo sube a 1 (bloqueado); el
  límite de crédito y el nombre se pudieron actualizar igual, con o sin
  movimientos. Datos de prueba limpiados.
- Verificado también: `tsc`, `npm run build`, `eslint`, 15 tests unitarios.

## Cambio de lógica financiera — Ronda 2: Tarjetas de crédito

Migración `036_credit_cards.sql`. Diseño: una tarjeta es una fila más de
`bank_accounts` (columna nueva `type`: BANK/CREDIT_CARD, + `credit_limit`),
reutilizando toda la infraestructura ya probada de Bancos (RLS, vista de
balance, transferencias) en vez de una tabla paralela. Convención: el
balance calculado de una tarjeta es negativo = deuda (ej. -6,000 = se deben
6,000) — funciona con la fórmula existente sin modificarla.

- **`create_card_expense`** (nueva función transaccional): un gasto pagado
  con tarjeta se crea **ya pagado** (`status='PAID'`, sin paso de "pagar"
  posterior) y genera su movimiento contra la tarjeta en el mismo momento.
  Intereses/comisiones de tarjeta usan esta misma función — son un gasto
  más pagado con esa tarjeta, sin lógica especial.
- **Pagar la tarjeta** reutiliza `create_bank_transfer` (Banco→Tarjeta) ya
  existente de F14 — sin crear ningún gasto nuevo.
- **Resguardos agregados**: `register_customer_payment` y
  `register_supplier_payment` ahora rechazan una tarjeta como cuenta (un
  cobro de cliente no entra a una tarjeta; un gasto pagado con tarjeta se
  registra vía `create_card_expense`, no como "pago posterior"). Un gasto
  ya pagado (`paid_amount > 0`) no se puede cancelar sin más — nuevo
  trigger `guard_expense_cancel` — evitaría dejar la deuda de la tarjeta
  desincronizada; requeriría un flujo de reembolso, fuera de este alcance.
- **UI**: formulario de nueva cuenta con selector Banco/Tarjeta (con
  "Deuda inicial" y "Límite de crédito" para tarjetas), lista de Bancos
  separada en dos secciones, detalle de cuenta muestra "Deuda actual" +
  crédito disponible para tarjetas, nuevo selector de tarjeta en "Nuevo
  gasto" cuando el método de pago es "Tarjeta", "Cancelar gasto" ya no se
  muestra para gastos pagados (el trigger lo bloquearía de todas formas).
- **Verificado end-to-end con datos reales**: creé una tarjeta con deuda
  inicial de 5,000, simulé una compra de 1,000 (el gasto quedó `PAID` de
  inmediato y la deuda subió a 6,000), pagué 2,000 de la tarjeta desde un
  banco (el banco bajó a 8,000, la deuda bajó a 4,000, **sin crear ningún
  gasto nuevo** — confirmado contando registros), y confirmé que cancelar
  el gasto ya pagado es rechazado por el trigger. Datos de prueba limpiados
  por completo al final.
- Verificado también: `tsc`, `npm run build`, `eslint`, 15 tests unitarios.

**Pendiente (Ronda 3, última)**: separadores de miles en vivo (`MoneyInput`)
en el resto de los formularios de dinero del sistema.

## Cambio de lógica financiera — Ronda 1: cuenta bancaria obligatoria en cobros y pagos

Pedido del usuario: que Factura→Cobro→Banco y Gasto→Pago→Banco sean
inevitables, no opcionales. **El mecanismo ya existía** desde F11/F13
(`register_customer_payment`/`register_supplier_payment` ya creaban el
`bank_transaction` automáticamente cuando se pasaba una cuenta) — el
problema real era que el campo era opcional, así que si no se elegía
cuenta, no pasaba nada.

- Migración `035_bank_account_required.sql`: ambas funciones ahora
  **rechazan** el cobro/pago si no se pasa `p_bank_account_id` (`raise
  exception 'bank_account_required'`).
- `registerPaymentSchema` (Zod): `bank_account_id` pasó de opcional a
  requerido — el error se muestra en el formulario antes de llegar a la
  base de datos.
- Formularios de registrar cobro (Facturas) y registrar pago (Gastos):
  quitada la opción "Sin cuenta", el select ahora es `required`.
- Si la empresa todavía no tiene ninguna cuenta bancaria creada, en vez
  del formulario se muestra un aviso con link directo a crear una — no se
  puede cobrar/pagar "en el aire".
- Verificado con datos reales: confirmado que el RPC **rechaza** un cobro
  sin cuenta, y que con cuenta sigue funcionando igual que antes (el saldo
  del banco sube/baja correctamente). Datos de prueba limpiados.

**Pendiente (rondas siguientes)**: módulo de Tarjetas de crédito, y
separadores de miles en vivo en el resto de los formularios de dinero.

## Fix: campo "Monto" distorsionado en Facturas y Gastos

- En "Registrar cobro" (Facturas) y "Registrar pago" (Gastos), el campo
  Monto tenía una etiqueta dinámica muy larga (ej. "Monto (máx. 15000.00
  DOP)") metida en una caja de solo 160px de ancho — se desbordaba y
  distorsionaba el resto de la fila del formulario. Corregido: la etiqueta
  ahora es solo "Monto", y el máximo se muestra como texto de ayuda debajo
  del campo (usando el prop `hint` ya existente en `Input`).
- Revisado el resto del proyecto por el mismo patrón (etiquetas dinámicas
  largas) — no se encontró ningún otro caso.
- Verificado: `tsc`, `npm run build`, `eslint` y los 15 tests unitarios
  limpios.

## Fix: feedback tras el rediseño (layout, textos en inglés, comas en números)

- **Layout roto en Cotizaciones y Facturas**: la tarjeta de totales usaba
  `ml-auto` (flotaba pegada a la derecha) — antes del rediseño era solo
  texto simple así que no se notaba, pero con el borde/sombra de `Card`
  se veía como una caja perdida. Corregido: ahora es una tarjeta normal con
  cada línea en formato etiqueta-izquierda/monto-derecha, separador antes
  del Total.
- **Estados en inglés**: en la pestaña "Ingresos"/"Facturas"/"Gastos" del
  detalle de Proyecto, y en "Importaciones recientes" de Clientes, el
  badge de estado mostraba el valor crudo de la base de datos (`DRAFT`,
  `SENT`, `PAID`, `PROCESSING`, etc.) en vez de traducido — se corrigieron
  los 4 casos encontrados con una búsqueda en todo el proyecto para
  confirmar que no quedó ninguno más.
- **Números sin comas al escribir**: nuevo componente `MoneyInput`
  (`components/ui/money-input.tsx`) que muestra separador de miles en vivo
  mientras se escribe (ej. "1,000.50"), enviando el valor numérico real al
  formulario vía un input oculto — el servidor no cambia nada. Aplicado por
  ahora en el formulario de línea de Cotizaciones (Precio, Descuento, Costo
  estimado); se puede extender a otros formularios de dinero si se pide.
- Verificado: `tsc`, `npm run build`, `eslint` y los 15 tests unitarios
  limpios.

## Rediseño ERP SaaS — Etapa 15 (ÚLTIMA): Login y Recuperar contraseña

- Login y Recuperar contraseña migrados a `Input`/`Button`/`Card`.
  Selectores de los tests E2E preservados exactamente (mismos `id`, mismo
  texto "Ingresar").
- **Con esto se completan las 15 etapas del rediseño ERP SaaS** — las ~40
  pantallas del sistema ahora usan el Design System nuevo (negro/blanco/
  azul claro, componentes reutilizables, íconos `lucide-react`, toasts
  `sonner`, modales de confirmación en vez de `window.confirm()`), sin
  tocar ninguna lógica de negocio, query, action, ruta ni permiso en
  ningún momento. Cada etapa se verificó con `tsc` + `build` + `eslint` +
  los 15 tests unitarios antes de darla por buena.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 14: módulo Configuración

- Pestañas con estado activo (nuevo componente cliente `SettingsTabs`, usa
  `usePathname` como el Sidebar).
- Organización, Sistema (colores + logo), Categorías de gastos, Impuestos
  y Usuarios migrados a `DataTable`, `Badge`, `Input`/`Select`,
  `Button`/`ConfirmButton`.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 13: módulo Auditoría

- Filtros migrados a `Select`/`Button`, tabla a `DataTable`, acción con
  `Badge` coloreado (crear=verde, actualizar=azul, eliminar/cancelar/
  desactivar=rojo).
- Sin cambios de lógica/queries/rutas. Verificado: `tsc`, `npm run build`,
  `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 12: módulo Reportes

- Hub de 5 reportes (737 líneas) reescrito completo: sidebar de navegación
  con estado activo, filtros migrados a `Select`, tablas a `DataTable`,
  estados a `Badge` (incluyendo "días vencida" en rojo/verde).
- Sin cambios de lógica/queries/rutas. Verificado: `tsc`, `npm run build`,
  `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 11: módulo Tareas

- `/tasks` y los componentes compartidos `NewTaskForm`/`TaskList` (también
  usados en la pestaña "Tareas" de Proyectos) migrados a `Input`/`Select`,
  `Button`, tabla con estilo consistente y `ConfirmButton` en vez de
  `window.confirm()` para eliminar.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 10: módulo Bancos

- Lista y detalle (ya venían con cambios sin commitear de una pasada
  anterior — verificados y completados) + formularios (nueva cuenta,
  movimiento manual, transferencia) migrados a `DataTable`, `Badge`,
  `Button`/`ConfirmButton`, `Input`/`Select`.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 9: módulo Productos y Servicios

- Lista, detalle y formularios (nueva categoría, nuevo producto/servicio,
  editar) migrados a `DataTable`, `Badge`, `Card`, `Button`/`ConfirmButton`,
  `Input`/`Select`/`Textarea`.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 8: módulo Proveedores

- Lista, detalle y formularios (nuevo, editar, nuevo contacto) migrados a
  `DataTable`, `Badge`, `Card`, `Button`/`ConfirmButton`, `Input`.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 7: módulo Gastos

- Lista, detalle (`KpiCard` para totales, `ConfirmButton` para cancelar,
  `DataTable` para historial de pagos) y formularios (nuevo, editar,
  registrar pago a proveedor) migrados al Design System.
- Sin cambios de lógica/queries/actions/rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 6: módulo Cobros/Pagos

- `/payments`: las dos tablas (Cobros, Pagos a proveedores) migradas a
  `DataTable`. Los formularios de registro ya vivían migrados dentro de
  Facturas (Etapa 5) y Gastos (próxima etapa).
- Sin cambios de lógica/queries/rutas. Verificado: `tsc`, `npm run build`,
  `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 5: módulo Facturas

- Lista, detalle (líneas + cobros con `DataTable`, tarjeta de totales) y
  formularios (nueva factura, línea, NCF/vencimiento, registrar cobro)
  migrados al Design System.
- Botones auxiliares (compartir/duplicar/descartar) con `toast` en vez de
  mensajes de error inline.
- Sin cambios de lógica, queries, actions ni rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 4: módulo Proyectos

- Detalle de proyecto (el archivo más grande, 770 líneas, 13 pestañas)
  reescrito completo con `DataTable`, `Badge`, `KpiCard` (Finanzas/
  Rentabilidad), `Button`/`ConfirmButton`.
- Lista de proyectos, formularios (nuevo, editar, línea, convertir
  cotización, nueva actividad) y `ActivityItem` migrados al Design System.
- Sin cambios de lógica, queries, actions ni rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 3: módulo Cotizaciones

- Lista, detalle y formularios migrados a `DataTable`, `Badge`,
  `Button`/`ConfirmButton`, `Input`/`Select`/`Textarea`.
- `ShareLinkButton` ahora usa `toast` (éxito/error) en vez de texto inline.
- Sin cambios de lógica, queries, actions ni rutas. Verificado: `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios limpios.

## Rediseño ERP SaaS — Etapa 2: módulo Clientes

- Lista (`/clients`): `DataTable`, `Badge` por estado (Lead/Activo/Inactivo),
  `Input`/`Select` para el filtro, `EmptyState` cuando no hay resultados.
- Detalle (`/clients/[id]`): `Badge`, `ConfirmButton` (modal propio) en vez
  de `window.confirm()` para desactivar cliente y eliminar contacto.
- Formularios (nuevo/editar cliente, nuevo contacto, importar CSV):
  migrados a `Input`/`Select`/`Button` del Design System.
- Sin cambios de lógica, queries, actions ni rutas — verificado con `tsc`,
  `npm run build`, `eslint` y los 15 tests unitarios, todos limpios.

## Módulo de Configuración — primera etapa

- Nuevo layout `/settings` con pestañas: Organización, Impuestos (existente),
  Categorías de gastos, Sistema, Notificaciones, Documentos, Seguridad,
  Usuarios. Acceso vía ícono de engranaje en la esquina superior derecha del
  dashboard (no en el menú lateral), como se pidió.
- **Organización**: datos de empresa editables (nombre legal, RNC,
  dirección, teléfono, correo, moneda base). Columnas nuevas en `companies`
  (`address`, `phone`, `email` — migración `034_settings_organization.sql`).
- **Categorías de gastos**: gap real — existía la tabla desde F3 sin
  ninguna pantalla. Construida con crear/listar/eliminar, mostrando cuántos
  gastos usan cada categoría antes de dejar eliminarla.
- **Sistema**: nombre de plataforma y colores de marca editables (con nota
  honesta: todavía no están conectados en vivo a los Design Tokens de
  Tailwind, que siguen fijos en `globals.css`). Logo con subida a un bucket
  de Storage **público** nuevo (`branding`), distinto al privado
  (`documents`, F8) para que la URL no dependa de un link firmado que
  expira.
- El sidebar ahora muestra el nombre de plataforma y logo reales de la
  empresa (antes decía "Mindfreak Manager" fijo en el código).
- **Usuarios**: página de solo lectura (lista de usuarios + roles). Invitar/
  gestionar usuarios de verdad queda para una ronda aparte — toca
  autenticación directamente (ya tuvimos un incidente real con esto en F4).
- **Notificaciones/Documentos/Seguridad**: páginas informativas honestas
  sobre qué aplica a este sistema y qué no (NCF/notificaciones reales siguen
  V2; tipos/plantillas de documento no aplican al diseño actual; sesiones/
  autenticación ya las maneja Supabase Auth).
- Verificado con datos reales (insert/update/delete bajo RLS simulando
  admin) para Organización y Categorías de gastos.
- **Sin verificar**: la subida de logo al bucket `branding`. Se investigó a
  fondo un fallo de "violates row-level security policy" al intentar
  simularlo con SQL directo (se descartaron triggers, grants y políticas
  restrictivas como causa) sin llegar a una conclusión definitiva — parece
  una limitación de probar `storage.objects` por esta vía, no
  necesariamente un bug de la política (que replica exactamente el patrón
  ya probado del bucket `documents`). Pendiente que el usuario lo pruebe en
  la app real.

## Rediseño de interfaz (ERP SaaS) — Etapa 1: fundación

Pedido explícito del usuario: rediseño visual completo (Odoo/ERPNext/Zoho),
**sin tocar funcionalidad, lógica, datos, rutas ni permisos**. Dado el
tamaño real (~40 pantallas construidas en 23 fases), se aborda por etapas.

**Etapa 1 (esta ronda) — fundación del Design System + Sidebar + Dashboard:**

- **Tokens** (`app/globals.css`): paleta negro + blanco + azul claro (antes
  negro + teal), colores semánticos completos con fondo suave a juego
  (`success`/`warning`/`danger`/`info`, cada uno con su `-bg`), estados
  (`hover`, `disabled`), escala de radios y sombras. Se mantienen los
  nombres de variable existentes (`brand-primary`, `brand-accent`, etc.)
  para no romper ninguna pantalla ya construida — solo cambian valores y se
  agregan tokens nuevos.
- **Librería de componentes** (`components/ui/`): `Button` (variantes
  primary/secondary/outline/ghost/danger, estados loading/disabled),
  `Badge` (con mapeo automático de estados de negocio → color: PAID=verde,
  PENDING=amarillo, OVERDUE=rojo, etc.), `Input`/`Select`/`Textarea` (con
  label/error/hint, **de paso corrige la deuda de accesibilidad** detectada
  en F21 — ahora sí asocian `htmlFor`/`id`), `Card`/`KpiCard`, `EmptyState`,
  `Skeleton`/`TableSkeleton`, `Modal`, `ConfirmButton` (reemplaza
  `window.confirm()` nativo por un modal propio), `Toaster` (via `sonner`,
  montado en el layout raíz), `DataTable` (tabla con estilo consistente).
- **Iconos**: `lucide-react` instalado.
- **Sidebar** (`components/layout/sidebar.tsx`): agrupado por dominio
  (Comercial, Operaciones, Finanzas, Análisis), ícono por módulo, estado
  activo/hover diferenciado (vía `usePathname`), colapsable.
- **Dashboard**: KPIs con `KpiCard` + íconos, sección de accesos rápidos
  (Nueva cotización/cliente/factura/gasto).
- Verificado: `tsc`, `npm run build`, `eslint` y los 15 tests unitarios
  siguen limpios tras el cambio (cambio puramente visual, sin tocar
  lógica/queries/actions).

**Pendiente (próximas etapas, no en esta ronda)**: aplicar estos mismos
componentes al resto de los módulos (Clientes, Proveedores, Cotizaciones,
Proyectos, Facturas, Cobros, Gastos, Bancos, Tareas, Reportes, Auditoría,
Configuración) — tablas, formularios, botones e iconografía de cada
pantalla individual siguen con el estilo anterior hasta que se aborden.
También pendiente: breadcrumbs, empty/skeleton states aplicados por
pantalla, responsive real para tablas complejas en mobile.

## F23 — Deployment

- Revisado que el proyecto esté listo para desplegarse: sin URLs
  hardcodeadas a `localhost` en el código (verificado por búsqueda), solo
  2 variables de entorno necesarias (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), build de producción limpio.
- Agregado `engines.node: ">=20"` en `package.json` para que Vercel (u
  otro host) use una versión de Node compatible con Next.js 16.
- **README actualizado** con la guía completa de deployment en Vercel
  (conectar el repo ya existente, variables de entorno, deploy automático
  en cada push a `main`) y un paso importante que se detectó al revisar el
  código: `resetPasswordForEmail` (recuperar contraseña) depende de la
  **Site URL** configurada en el dashboard de Supabase, no de una URL en
  el código — hay que actualizarla de `localhost:3000` al dominio de
  producción una vez desplegado, o los links de recuperación de contraseña
  seguirían apuntando a localhost.
- **Nota importante**: yo no puedo conectar Vercel por ti — mi entorno no
  tiene acceso a esa web ni a tu cuenta. Esto es lo único de F23 que
  depende de que tú lo hagas (son ~5 minutos siguiendo la guía del README).

## F22 — Optimización

Basado en una revisión directa de los *advisors* de rendimiento de
Supabase (migración `033_optimization.sql`):

- **RLS ineficiente (WARN, 8 hallazgos, resuelto)**: varias políticas
  llamaban `auth.uid()` directo en vez de `(select auth.uid())` —
  Postgres las re-evaluaba por cada fila en vez de una sola vez por
  consulta. Corregido en `profiles`, `user_roles`, `approvals`,
  `audit_logs`, `notifications`.
- **Políticas duplicadas (WARN, 45 hallazgos, resuelto)**: 9 tablas
  (`exchange_rates`, `expense_categories`, `invoice_items`, `project_items`,
  `quotation_items`, `service_categories`, `services`, `settings`,
  `tax_rates`) tenían una política `_select` y otra `_write` (`FOR ALL`)
  que también cubría `SELECT` — Postgres evaluaba ambas en cada lectura.
  Separadas en políticas explícitas de `insert`/`update`/`delete` sin
  volver a cubrir `select`.
- **61 índices de cobertura faltantes en FKs (INFO, resuelto)**: ya estaba
  documentado como deuda técnica desde F3. Se agregaron todos —
  `company_id` en 15 tablas (el filtro más usado de todo el sistema, vía
  RLS), más FKs de negocio (`bank_transactions`, `customer_payments`,
  `supplier_payments`, `quotation_items`/`invoice_items`.`service_id`/
  `tax_rate_id`, `projects`.`manager_id`/`quotation_id`/`contact_id`, etc.)
  y columnas de auditoría (`created_by`/`approved_by`/`uploaded_by`).
- **No se tocaron los "unused index" (INFO, 7→68 tras la migración)**: es
  esperado — la base de datos todavía no tiene tráfico real de producción,
  así que Postgres no ha registrado uso de ningún índice todavía (ni los
  viejos ni los nuevos). No hay motivo para borrar índices que se van a
  necesitar según crezca el uso real.
- **Verificado exhaustivamente antes de dar por bueno**: tras aplicar la
  migración, se re-consultaron los *advisors* — los WARN de RLS ineficiente
  y políticas duplicadas desaparecieron por completo. Se probó
  insert/select/update/delete real bajo RLS simulando el usuario admin en
  `services` (política simple) y `quotation_items` (política vía `EXISTS`,
  la más compleja de dividir) para confirmar que separar las políticas no
  rompió ningún flujo. También se confirmó `profiles` (crítica para login)
  sigue funcionando tras el fix de `auth.uid()`. Datos de prueba limpiados
  después. Los *advisors* de seguridad no mostraron ningún hallazgo nuevo.

## E2E confirmado: 8/9 pasan corriendo secuencial

- El usuario corrió `npm run test:e2e` tras el fix de `workers: 1` — **8 de
  9 tests pasan**. El único que falló fue por un "Gateway Timeout" real de
  Supabase al iniciar sesión (mismo tipo de hipo transitorio de red visto
  antes con el dashboard), no un bug de código — confirma que el
  diagnóstico de concurrencia del fix anterior era correcto.
- Agregado `retries: 1` en `playwright.config.ts` para que un hipo de red
  aislado no obligue a repetir toda la corrida a mano.
- F21 se da por concluida: 15 tests unitarios + 9 tests E2E, todos
  verificados corriendo de verdad (unitarios por mí, E2E por el usuario).

## Fix: fallas intermitentes en E2E ("permission denied for function user_company_ids") + selectores ambiguos

- El usuario reportó 6/9 tests E2E fallando, incluyendo un error real de
  Postgres: `permission denied for function user_company_ids`.
- **Investigado directamente en la base de datos** (no asumido): consulté
  `has_function_privilege('authenticated', ...)` para `user_company_ids`,
  `has_permission`, `register_customer_payment`, `register_supplier_payment`
  y `create_bank_transfer` — **los 5 confirman `true`**, el permiso está
  correctamente configurado. No es un bug de RLS/permisos.
- **Diagnóstico**: los tests corrían con 5 workers en paralelo contra un
  proyecto Supabase real (plan gratuito, límite bajo de conexiones
  simultáneas) — bajo esa carga concurrente, el pool de conexiones puede
  producir errores intermitentes que se reportan como "permission denied"
  sin serlo realmente. Corregido en `playwright.config.ts`: `workers: 1`
  (corre secuencial, sin paralelismo, evita saturar el pool).
- **Bug real de los tests** (no de la app): 2 selectores usaban
  `getByText(/borrador/i)`, que coincidía con **dos elementos** — el badge
  de estado "Borrador" y el botón "Descartar borrador" — causando
  "strict mode violation". Corregido en `quotations.spec.ts`,
  `quotation-to-project.spec.ts` e `invoice-payment.spec.ts` usando
  `getByText("Borrador", { exact: true })`.
- Pendiente de confirmar por el usuario: volver a correr `npm run test:e2e`
  con estos dos fixes debería resolver la mayoría de las fallas reportadas.

## Fix real: los tests E2E no leían `.env.test` (8 de 9 fallaban)

- **Bug real detectado por el usuario** al correr `npm run test:e2e` por
  primera vez: 8 de 9 tests fallaron con "Faltan E2E_ADMIN_EMAIL/
  E2E_ADMIN_PASSWORD en el entorno", aunque el usuario sí había creado
  `.env.test` correctamente. Causa: **Playwright no lee archivos `.env` por
  sí solo** — yo documenté el paso de crear `.env.test` pero nunca conecté
  nada en el código para que efectivamente se cargara a `process.env`. El
  único test que pasó ("credenciales inválidas") no depende de esas
  variables, por eso no mostró el problema.
- **Corregido**: se agregó `dotenv` como dependencia de desarrollo y
  `playwright.config.ts` ahora carga `.env.test` explícitamente al inicio
  (`config({ path: ".env.test" })`) antes de que corra cualquier test.
- Verificado el mecanismo de carga con un archivo `.env.test` de prueba
  (creado y borrado de inmediato, sin credenciales reales): confirmado que
  `process.env.E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` se llenan
  correctamente tras el fix.

## Fix: `npm install` daba ERESOLVE (conflicto @types/node vs. vitest)

- **Bug real** encontrado por el usuario al instalar en su Mac: `vitest@5`
  requiere `@types/node` ^22 (o >=24), pero el proyecto tenía `@types/node`
  ^20 (heredado de F1) — `npm install` fallaba con `ERESOLVE` sin la
  bandera `--legacy-peer-deps`. Yo lo había resuelto localmente con esa
  bandera al construir F21, pero eso no queda "guardado" para quien clona
  el repo de cero.
- **Corregido de raíz**: `@types/node` subido a `^22` en `package.json`.
  Reinstalado desde cero (`rm -rf node_modules package-lock.json &&
  npm install`) sin ninguna bandera especial — instala limpio. Verificado
  que build, lint, tipos y los 15 tests unitarios siguen pasando tras el
  cambio.

## Ampliación de cobertura E2E

- Se agregaron 4 specs E2E más a las 3 de F21 (siguen sin ejecutarse en
  este entorno, mismo motivo — sin navegador ni red a Supabase):
  - `quotation-to-project.spec.ts`: crear cotización → agregar línea →
    marcar enviada → aprobar → convertir a proyecto.
  - `invoice-payment.spec.ts`: crear factura → agregar línea → emitir →
    registrar el cobro completo (verifica que quede "Pagada").
  - `expense-payment.spec.ts`: crear proveedor → crear gasto asociado →
    registrar el pago completo (verifica que quede "Pagado").
  - `documents.spec.ts`: crear cliente → subir un documento → verificar que
    aparece → eliminarlo → verificar que desaparece.
- Total ahora: 7 specs E2E cubriendo los flujos de negocio principales de
  punta a punta (Cliente→Cotización→Proyecto, Factura→Cobro,
  Proveedor→Gasto→Pago, Documentos), además de autenticación.
- Selectores verificados contra el código real de cada página (no
  adivinados) antes de darlos por buenos.

## F21 — Testing

- **Unit tests (Vitest)**: 15 tests sobre las funciones puras de cálculo
  financiero — `calculateItemSubtotal`/`calculateQuotationTotals`
  (cotizaciones), `calculateInvoiceItemSubtotal`/`calculateInvoiceTotals`
  (facturas), `calculateExpenseTotals` (gastos, incluyendo redondeo e
  impuesto como %). Ejecutados y verificados en este entorno: los 15 pasan.
  `npm test` / `npm run test:watch`.
- **E2E tests (Playwright)**: `auth.spec.ts` (login válido/inválido,
  logout), `clients.spec.ts` (crear cliente), `quotations.spec.ts` (crear
  cotización + línea). Selectores verificados contra el código real (no
  adivinados). **No se pudieron ejecutar en este entorno** — sin navegador
  ni acceso de red a Supabase — quedan listos para correr localmente con
  `npm run test:e2e` (requiere `.env.test` con un usuario de prueba, ver
  `.env.test.example`, y `npx playwright install chromium` una vez).
- **Sin tests de integración automatizados contra Supabase real**: mismo
  motivo (sin red desde este entorno hacia Supabase). En su lugar, cada
  función Postgres transaccional y cada política RLS nueva de F11 en
  adelante se verificó manualmente con datos de prueba reales antes de
  cerrar cada fase — ya documentado en las entradas anteriores de este
  changelog.
- **Hallazgo de la fase**: casi todos los formularios (excepto login)
  tienen `<label>` sin `htmlFor`/`id` asociado a su `<input>` — no rompe
  funcionalidad, pero afecta accesibilidad y forzó a que los tests E2E usen
  selectores por `name` en vez de `getByLabel()`. Documentado como deuda
  técnica, no corregido en esta fase (afectaría decenas de formularios).

## Reportes: filtros por reporte

- Cada uno de los 5 reportes ahora tiene sus propios filtros (todos los
  pedidos eran factibles con el esquema actual, ninguno quedó fuera):
  - **Rentabilidad por proyecto**: Período (`event_date`), Proyecto,
    Cliente, Estado del proyecto, Responsable.
  - **Cuentas por cobrar**: Período (`issue_date`), Cliente, Estado,
    Proyecto, Moneda.
  - **Cuentas por pagar**: Período (`expense_date`), Proveedor, Estado,
    Proyecto, Moneda.
  - **Ventas por cliente**: Período (`issue_date`), Cliente, Proyecto,
    Estado de factura, Moneda.
  - **Gastos por categoría**: Período (`expense_date`), Categoría,
    Proyecto, Proveedor, Estado.
- Filtros vía `<form method="get">` (sin JS necesario), preservando el
  reporte activo. Botón "Limpiar" para quitar todos los filtros.
- Nota de diseño: cuando se elige explícitamente un Estado en Cuentas por
  cobrar/pagar (ej. "Pagada"), se reemplaza el filtro por defecto de
  "solo pendientes" — permite usar el mismo reporte también para ver
  facturas/gastos ya saldados si se necesita.
- Nuevas queries de catálogo (`listClientsForFilter`, `listSuppliersForFilter`,
  `listProjectsForFilter`, `listExpenseCategoriesForFilter`,
  `listManagersForFilter`) en `features/reports/queries.ts`.

## Ajustes de feedback (documentos, actividades, reportes, auditoría)

- **Documentos**: se quitó la miniatura de imágenes (pedido explícito) y se
  alinearon mejor las columnas Tamaño/Subido/Ver/Descargar/Eliminar con
  anchos fijos.
- **Actividades**: formulario de registro ahora usa un textarea de varias
  líneas en vez de un input de una sola línea — más espacio para escribir.
  Se agregó **editar** (inline) y **eliminar** por actividad — revierte la
  decisión original de F18 de dejarla inmutable como `audit_logs`; una
  actividad no es un registro financiero, así que permitir editarla/borrarla
  no compromete nada (migración `032_activities_edit_delete.sql`,
  verificado con update/delete real bajo RLS).
- **Reportes**: rediseñado como un **hub** con selector lateral (categorías
  → reportes), en vez de las 5 tablas apiladas en una sola página — cada
  reporte se carga solo cuando se selecciona. Confirmado: F19 es la única
  fase de "Reportes" en el plan (F0, sección 33); cualquier reporte nuevo
  se agrega al mismo catálogo (`REPORT_CATALOG` en la página), no requiere
  una fase nueva.
- **Auditoría**: tabla con anchos de columna fijos y el JSON de detalle en
  un bloque con scroll propio (máx. altura), para que no se vea "pegado"
  cuando el detalle es largo.
- **Nota sobre el "Gateway Timeout"** reportado en `listActiveServices`: se
  revisó la query (simple, sin joins) y el RLS (patrón estándar ya probado
  en todo el proyecto) — no se encontró ningún problema de código; fue
  tráfico/latencia transitoria hacia Supabase.

## F20 — Auditoría

- `audit_logs` ya existía desde F3, con RLS desde F4 (lectura gateada por
  `settings.manage`, cada quien registra solo sus propias acciones). F20
  construye la **UI de consulta** (`/audit`, gateada por `settings.manage`):
  filtro por entidad y por acción, últimos 200 registros, con usuario,
  fecha, acción y detalle (valores nuevos/anteriores en JSON).
- **Gaps reales encontrados y corregidos** (revisando qué acciones ya
  registraban auditoría vs. lo que exige la sección 22 del prompt maestro
  — "Facturas, Pagos, Gastos, Cotizaciones, Bancos, Configuración"):
  - Bancos: `toggleBankAccountActiveAction`, `createManualTransactionAction`
    y `toggleReconciledAction` no registraban nada — corregido.
  - Configuración (tasas de impuesto): `createTaxRateAction`,
    `setDefaultTaxRateAction` y `toggleTaxRateActiveAction` no registraban
    nada — corregido.
  - Cobros/Pagos a proveedores y transferencias bancarias sí estaban
    cubiertos, pero desde dentro de las funciones Postgres
    (`register_customer_payment`/`register_supplier_payment`/
    `create_bank_transfer`), no vía el helper `logAudit` de la aplicación —
    confirmado al revisar, no requirió cambios.
- Verificado con inserción real simulando el usuario admin (mismo shape que
  usa `logAudit`) antes de dar por buenos los fixes. Datos de prueba limpiados.
- Nuevo link "Auditoría" en el menú lateral.
- Pendiente para más adelante (no bloqueante): Aprobaciones y Usuarios/
  Permisos también están listados en la sección 22, pero esos módulos
  todavía no tienen UI propia (siguen en backlog).

## F19 — Reportes

- `features/reports/queries.ts` + página `/reports`, cinco reportes de solo
  lectura sobre datos ya registrados (nada nuevo que capturar):
  - **Rentabilidad por proyecto**: todos los proyectos con Cotizado/
    Facturado/Cobrado/Costo real/Utilidad real/Margen (misma fórmula de F15,
    pero agregada en 5 consultas totales en vez de 5 por proyecto — evita
    N+1).
  - **Cuentas por cobrar**: facturas con balance pendiente, con antigüedad
    (días vencida) calculada respecto a la fecha de vencimiento.
  - **Cuentas por pagar**: gastos con balance pendiente.
  - **Ventas por cliente** y **Gastos por categoría**: totales agregados.
  - Todo consolidado en la moneda base de la empresa (mismo enfoque de F15/F16).
- **Fix de RLS real encontrado durante esta fase**: el permiso
  `reports.view` existía en el catálogo desde F0/F4, pero ninguna política
  RLS lo usaba — alguien con `reports.view` pero sin `invoices.view`/
  `expenses.view`/etc. habría visto los reportes vacíos, ya que RLS es la
  última línea de defensa y bloquea la lectura de esas tablas sin el
  permiso específico. Corregido en `031_reports_rls.sql`: las políticas de
  `select` de `quotations`, `projects`, `project_items`, `invoices`,
  `invoice_items`, `customer_payments` y `expenses` ahora aceptan
  `reports.view` como alternativa al permiso propio del módulo. Verificado
  revisando las políticas aplicadas directamente en Postgres.
- Página gateada por `reports.view` a nivel de aplicación (redirige a
  `/dashboard` si no se tiene) además del RLS.
- Nuevo link "Reportes" en el menú lateral.

## Mejora: previsualizar documentos sin descargar

- La lista de documentos ahora separa **"Ver"** (abre el archivo en una
  pestaña nueva sin forzar descarga — funciona para PDFs e imágenes, que el
  navegador ya sabe mostrar inline) de **"Descargar"** (fuerza guardar el
  archivo, vía el parámetro `download` de la URL firmada de Supabase
  Storage).
- Imágenes ahora muestran una **miniatura** directamente en la lista (clic
  para verla en grande); otros tipos muestran un ícono genérico (PDF/Archivo).

## Fix: subir documentos daba "Body exceeded 1 MB limit"

- Next.js limita el tamaño del body de los Server Actions a **1MB por
  defecto** — la validación propia de 15MB en `uploadDocumentAction` (F17)
  nunca llegaba a ejecutarse porque el framework rechazaba la petición
  antes. Corregido en `next.config.ts` con
  `experimental.serverActions.bodySizeLimit: "16mb"` (con margen sobre el
  límite de 15MB de la aplicación, para no cortar justo en el borde).

## F18 — Tareas y actividades

- Tablas `tasks`/`activities` ya existían desde F3, RLS (select/insert/update
  de tasks; select/insert de activities) desde F4 — gateadas con
  `projects.view`/`projects.update` (no tienen permiso propio en el
  catálogo). **Fix de RLS**: faltaba la política de `DELETE` en `tasks`
  (migración `030_tasks_delete.sql`) — verificado con inserción/actualización/
  borrado real simulando el usuario admin antes de darlo por bueno.
- Una tarea puede ser **general de la empresa o ligada a un proyecto**
  (`project_id` opcional, igual que gastos). `features/tasks/*` +
  `components/tasks/{new-task-form,task-list}.tsx` (reutilizables: la misma
  lista/formulario sirven en `/tasks` y en la pestaña "Tareas" del proyecto).
- Estado de tarea (Pendiente/En curso/Hecha/Cancelada) se cambia inline desde
  un select en la lista, sin recargar la página.
- **Actividades** (`features/activities/*`): bitácora de llamadas, reuniones,
  correos y notas por proyecto. **A propósito, no tiene update ni delete** —
  es un registro tipo bitácora, mismo espíritu que `audit_logs` (se registra,
  no se edita ni se borra después).
- Conectado: página general `/tasks` (con filtro por estado) + pestañas
  "Tareas" y "Actividades" del detalle de Proyecto (ambas placeholder hasta
  ahora).
- Nuevo link "Tareas" en el menú lateral.

## F17 — Documentos/Storage

- La infraestructura base (tabla `documents`, bucket privado `documents`,
  RLS por `company_id` + permisos) ya se había adelantado en F8 para el PDF
  de cotizaciones (F0, sección R lo fijaba como requisito de V1). F17
  construye la **UI genérica** sobre esa misma infraestructura, reutilizable
  en cualquier módulo vía el patrón polimórfico `entity_type`/`entity_id`.
- **Fix de RLS**: faltaba la política de `DELETE` tanto en la tabla
  `documents` como en `storage.objects` (bucket `documents`) — sin ella,
  borrar un documento habría fallado en silencio, igual que el bug de
  "Descartar borrador" de hace unas rondas. Se agregó y se verificó con una
  simulación real de RLS antes de darla por buena (migración
  `029_documents_delete.sql`).
- `features/documents/{schema,queries,actions}.ts` + componentes reutilizables
  `components/documents/{upload-document-form,document-list}.tsx`:
  subir (máx. 15MB), listar, descargar (link firmado de 10 minutos) y
  eliminar (borra el archivo de Storage y la fila de metadata).
- Conectado en: pestaña **Documentos** del detalle de Proyecto (la pestaña
  que faltaba de la lista original), y además en **Gastos** ("Recibos y
  comprobantes"), **Clientes** y **Proveedores** ("Documentos y contratos")
  — coincide con el alcance de la sección 21 del prompt maestro
  (cotizaciones, facturas, recibos, contratos, fotografías, comprobantes).
- Documentos **sí se pueden borrar físicamente** (a diferencia de
  cotizaciones/facturas/gastos) — no están en la lista de "nunca borrar" de
  F0-Arquitectura sección M.

## F16 — Dashboard

- Se instaló **recharts** (dependencia npm), la librería de gráficos que
  F0-Arquitectura dejó pendiente de elegir para esta fase.
- `features/dashboard/queries.ts`: `getDashboardKPIs()` (Ventas, Cobros,
  Gastos, Pagos del mes en curso; Cuentas por cobrar/pagar vivas; Proyectos
  activos; Cotizaciones pendientes/aprobadas; Utilidad y Margen del mes) y
  `getFinancialFlowSeries(meses)` (Cobros vs Pagos de los últimos 6 meses,
  para el gráfico). Todo consolidado en la moneda base de la empresa con el
  `exchange_rate` congelado de cada registro — mismo enfoque que F15.
- `/dashboard` ahora muestra las tarjetas de KPI + un gráfico de línea
  (Cobros vs Pagos, últimos 6 meses) vía `FinancialFlowChart` (componente
  cliente con recharts).
- Verificado con datos reales (factura + gasto de prueba este mes): Ventas,
  Gastos, Cuentas por cobrar y Cuentas por pagar coincidieron exactamente
  con el cálculo manual — incluyendo un gasto real del usuario ya pagado,
  correctamente excluido de "cuentas por pagar" pero incluido en "gastos del
  mes". Datos de prueba limpiados después.

## Fix: pestañas del detalle de Proyecto (Ingresos, Facturas, Cobros, Gastos, Proveedores, Pagos, Bancos)

- Las 7 pestañas que quedaron como placeholder tras F10-F14 ahora muestran
  datos reales filtrados por proyecto, cada una con un propósito distinto
  (sin duplicar lo que ya muestra Finanzas):
  - **Ingresos**: cotizaciones ligadas al proyecto
  - **Facturas**: facturas del proyecto (+ link para crear una nueva)
  - **Cobros**: cobros del proyecto, con link a la factura correspondiente
  - **Gastos**: gastos del proyecto (+ link para crear uno nuevo)
  - **Proveedores**: proveedores usados en el proyecto, con total gastado
    por proveedor (agregado desde `expenses`, excluyendo cancelados)
  - **Pagos**: pagos a proveedores del proyecto
  - **Bancos**: movimientos bancarios del proyecto
- Cada consulta se hace bajo demanda (solo cuando esa pestaña está activa),
  igual que ya se hacía con Finanzas/Rentabilidad en F15.
- Verificado con datos reales el caso más propenso a error (agregación de
  gastos por proveedor: 2 gastos del mismo proveedor sumaron correctamente).
  Datos de prueba limpiados después.
- Quedan como placeholder solo Tareas y Actividades (F18) y Documentos (F17)
  — esos módulos todavía no existen en absoluto, a diferencia de los 7 de
  arriba que sí existían como pantallas independientes.

## F15 — Rentabilidad

- `getProjectProfitability(projectId)` en `features/projects/queries.ts`:
  calcula por proyecto Cotizado/Facturado/Cobrado (ingresos), Costo
  estimado/real, Utilidad estimada/real y Margen estimado/real, consolidando
  todo en la moneda base de la empresa usando el `exchange_rate` ya
  congelado de cada cotización/factura/cobro/gasto (nunca la tasa actual) —
  tal como quedó definido en F0-Arquitectura, sección P.
  - Utilidad estimada = Cotizado − Costo estimado
  - Utilidad real = Facturado − Costo real (no se usa Cobrado para esto: es
    un indicador de flujo de caja, no de rentabilidad devengada)
- Es un cálculo en vivo (consultas agregadas), no una tabla cacheada — el
  cacheo para performance queda como optimización futura si hace falta
  (ya estaba contemplado como posible en F0).
- Pestañas **"Finanzas"** y **"Rentabilidad"** del detalle de Proyecto
  (antes placeholder) ahora muestran esta información real.
- Verificado extremo a extremo con datos de prueba reales (proyecto con
  cotización en DOP, factura y cobro en USD a tasa 60, gasto en DOP): los
  montos consolidados coincidieron exactamente con lo calculado a mano.
  Datos de prueba limpiados después.
- **Nota de deuda técnica detectada** (no corregida en esta fase, documentada
  en PROJECT_MASTER.md): las demás pestañas del proyecto (Ingresos, Gastos,
  Proveedores, Facturas, Cobros, Pagos, Bancos) siguen siendo placeholder
  aunque sus módulos ya existen como pantallas independientes — nunca se
  conectó una vista filtrada por proyecto dentro de esas pestañas.

## Ampliación: Servicios → Productos y Servicios

- El catálogo (tabla `services`, sin renombrar — sigue siendo la misma
  referenciada por `quotation_items`/`project_items`/`invoice_items`) ahora
  soporta bienes físicos además de servicios, ya que Mindfreak Events
  también vende productos (extintores, libretas, etc.), no solo servicios.
- Columnas nuevas (aditivas, migración `028_products_and_services.sql`):
  `type` (`PRODUCTO`/`SERVICIO`, default `SERVICIO` — no rompe datos
  existentes), `description`, `default_tax_percent`.
- UI renombrada a "Productos y Servicios" (menú lateral, título de página,
  breadcrumbs) — solo etiqueta visible, la ruta interna sigue siendo
  `/services`.
- Al elegir un producto/servicio del catálogo en una línea de cotización o
  factura, el % de impuesto ahora se autocompleta desde
  `default_tax_percent` (igual que ya pasaba con precio/costo). En facturas
  además se agregó el mismo auto-relleno de precio que ya tenía cotizaciones
  (antes solo se autocompletaba al copiar de un proyecto).
- Explícitamente NO incluye control de inventario/existencias — eso sigue
  clasificado como V3 en la arquitectura original.

## F14 — Bancos

- CRUD de cuentas bancarias (`bank_accounts`, ya existía desde F3/F4).
  Balance calculado (no almacenado) vía vista `bank_account_balances`
  (`security_invoker` — respeta el RLS del usuario que consulta, no del
  dueño de la vista): `opening_balance` + movimientos, sumando INCOME,
  restando EXPENSE y sumando TRANSFER con signo.
- Los movimientos por cobros/pagos a proveedores ya se generaban
  automáticamente desde F11/F13 (`register_customer_payment`/
  `register_supplier_payment`) — sin cambios ahí.
- Nuevo: **movimiento manual** (ingreso/gasto no ligado a una factura/gasto,
  ej. intereses, comisiones bancarias) y **transferencia entre dos cuentas
  propias**, esta última vía función transaccional `create_bank_transfer`
  (inserta dos filas — origen negativo, destino positivo — atómicamente,
  mismo patrón que F11/F13).
- Marcar movimientos como conciliados (`reconciled`, gated por
  `banks.reconcile`) — conciliación bancaria completa (import CSV/XLSX/OFX)
  sigue siendo V2 según F0-Arquitectura sección R.
- Verificado extremo a extremo con cuentas de prueba reales: transferencia
  de 200 entre dos cuentas, balances resultantes correctos (800/700).
  Advisors de seguridad revisados (mismo patrón ya aceptado de F11/F13 para
  funciones `SECURITY DEFINER` callables por `authenticated`). Datos de
  prueba limpiados después.

## F13 — Pagos a proveedores

- Función Postgres transaccional `register_supplier_payment` (mismo patrón
  que `register_customer_payment` de F11): crea el pago, actualiza
  `paid_amount`/`balance`/`status` del gasto (PENDING → PARTIALLY_PAID/PAID),
  genera movimiento bancario si se asoció una cuenta, y registra auditoría —
  todo en una sola transacción (rollback automático si algo falla).
- UI en el detalle del gasto: formulario "Registrar pago" (visible mientras
  el gasto esté PENDING/PARTIALLY_PAID) + historial de pagos. Si el gasto no
  tiene proveedor asignado, se muestra un aviso en vez del formulario (la
  tabla `supplier_payments` exige `supplier_id`, a diferencia de `expenses`
  donde es opcional).
- `/payments` ahora muestra dos secciones: Cobros (ya existía) y Pagos a
  proveedores (nuevo).
- Verificado extremo a extremo con datos de prueba reales: pago parcial
  correcto (PARTIALLY_PAID, balance recalculado), pago que excede el balance
  correctamente rechazado por la función. Datos de prueba limpiados después.

## F12 — Gastos

- Módulo completo sobre las tablas `expenses`/`expense_categories` (ya
  existían desde F3, con RLS desde F4 — sin cambios de esquema en esta fase).
  `features/expenses/*` + páginas `/expenses`, `/expenses/new`, `/expenses/[id]`.
- Un gasto puede ser de un proyecto/evento específico o general de la
  empresa (`project_id` opcional), con categoría y proveedor opcionales.
- Sin descuento (a diferencia de cotizaciones/facturas) — no aplica al
  registrar gastos. Impuesto igual que en cotizaciones/facturas: se escribe
  el % (default 18) y el servidor calcula el monto sobre el subtotal.
- Editable mientras `status='PENDING'` y `paid_amount=0` (sin pagos
  registrados); una vez tiene actividad real, solo se puede "Cancelar"
  (soft-state) — **nunca se borra físicamente un gasto**, a diferencia de
  cotizaciones/facturas en borrador: es una regla explícita de
  F0-Arquitectura, sección M ("nunca en... expenses"), así que no se agregó
  un "Descartar borrador" aquí como sí existe en cotizaciones/facturas.
- El registro de pagos a proveedores contra un gasto (que lo movería a
  `PARTIALLY_PAID`/`PAID`) queda para **F13 — Pagos a proveedores**.
- Verificado RLS con inserción real simulando el usuario admin vía SQL
  (`set role authenticated` + `request.jwt.claims`).

## Fix: "Descartar borrador" no borraba nada (RLS)

- **Bug real detectado por el usuario**: al descartar una cotización/factura
  en borrador, el mensaje de confirmación aparecía y no daba error, pero el
  registro seguía apareciendo en la lista — no se borraba.
- **Causa**: `quotations` e `invoices` tienen RLS habilitado con políticas de
  `select`/`insert`/`update`, pero **nunca se agregó una política de
  `delete`** — Postgres deniega por defecto sin policy, así que el
  `.delete()` se ejecutaba "exitosamente" pero afectaba 0 filas (no genera
  error, solo no borra nada).
- **Corrección** (migración `025_delete_draft_documents.sql`): se agregan
  políticas de `delete` para ambas tablas, restringidas a `status='DRAFT'`
  (RLS como segunda línea de defensa real, igual que ya valida la Server
  Action — F0-Arquitectura, sección L). Verificado con una simulación real
  del rol `authenticated` vía SQL: el delete ahora sí afecta la fila.
- Además, `discardQuotationAction`/`discardInvoiceAction` ahora verifican
  que el delete haya afectado al menos una fila (`.select('id')` sobre el
  delete) y lanzan un error explícito si no — para que un problema similar
  en el futuro se note de inmediato en vez de fallar en silencio.

## Ajustes rápidos: impuesto como % y descartar borradores

- **Impuesto vuelve a ser manual, pero ahora como porcentaje**: en vez de
  escribir el monto de impuesto en dólares/pesos, se escribe el % (por
  defecto 18, ej. ITBIS). El servidor calcula
  `impuesto = (cantidad×precio − descuento) × %` antes de sumar el total —
  ya no hay que calcularlo a mano. Esto reemplaza el selector de tasas
  parametrizadas (`tax_rates`) que se había agregado y luego revertido; la
  tabla y `/settings/tax-rates` quedan listas para cuando se construya el
  módulo de Configuración completo.
- **"Descartar borrador"** en cotizaciones y facturas: nuevo botón, visible
  solo mientras el documento está en `DRAFT`, que **elimina el registro por
  completo** (no solo cambia su estado como "Cancelar"). Pensado para
  cuando se crea una cotización/factura por error o se cambia de opinión
  justo después, antes de que tenga actividad real (envío, emisión, cobros).
  Una factura/cotización con actividad real sigue usando "Cancelar" (estado,
  preserva el registro para auditoría — F0 sección M).

## Ronda de correcciones post-F10/F11 (impuestos, PDF y duplicar)

Detectado durante pruebas reales del usuario en local, tras completar F10-F11.

- **Tabla `tax_rates`** (migración `024_tax_rates.sql`): tasas de impuesto
  nombradas por compañía (%), con una marcada como predeterminada. Sembrada
  con **ITBIS 18%** (predeterminada) y **Exento 0%** para Mindfreak Events.
  RLS: lectura amplia dentro de la compañía, escritura bajo `settings.manage`
  (mismo patrón que `services`/`service_categories`). Se agregó `tax_rate_id`
  (nullable) a `quotation_items` e `invoice_items` como referencia de
  auditoría — el monto de impuesto sigue congelándose en la línea, igual que
  el resto de campos financieros del sistema.
  - Explícitamente NO es la activación fiscal completa de NCF/ITBIS (DGII,
    reportes) — eso sigue siendo V2 según F0-Arquitectura, sección R. Es solo
    una parametrización ligera para que el impuesto se calcule como % en vez
    de escribirse a mano.
  - Página `/settings/tax-rates`: listar, crear, marcar predeterminada,
    activar/desactivar. Enlazada en el nav como "Impuestos" (mientras no
    exista el módulo de Configuración completo, que sigue en backlog).
  - Los formularios de línea de cotización/factura ahora tienen un selector
    de tasa (con la predeterminada preseleccionada) en vez de un campo
    numérico manual; opción "Manual" conserva el comportamiento anterior.
- **PDF + link de factura** (gap real: se construyó para cotizaciones en F8
  pero nunca se extendió a facturas en F10): `lib/pdf/invoice-document.tsx` +
  `generateInvoiceShareLinkAction`, mismo patrón que cotizaciones (URL
  firmada de Storage, 7 días de vigencia, registro en `documents`).
- **Botón "Descargar PDF"** agregado junto al link para compartir, tanto en
  cotizaciones como en facturas — antes solo se podía copiar el link.
- **Duplicar cotización / Duplicar factura**: crea un nuevo documento en
  BORRADOR con el mismo cliente/contacto (o cliente/proyecto en facturas) y
  todas las líneas copiadas (incluyendo la tasa de impuesto usada). El
  documento original nunca se modifica — decisión explícita para no romper
  la integridad de un documento ya emitido/aprobado (F0, sección M), evitando
  además tener que reescribir todo a mano cuando el cliente pide ajustar
  cantidades sobre algo ya facturado/cotizado.

## F11 — Cobros

- **Función Postgres transaccional `register_customer_payment`**
  (`SECURITY DEFINER`), tal como exige F0 sección H para operaciones
  financieras multi-tabla: en una sola transacción (1) crea el cobro, (2)
  actualiza `paid_amount`/`balance`/`status` de la factura (→
  `PARTIALLY_PAID` o `PAID`), (3) genera el movimiento bancario si se asoció
  una cuenta, (4) registra auditoría. Si cualquier paso falla, todo se
  revierte automáticamente (rollback de Postgres, no lógica manual en JS).
- Validaciones dentro de la función: rechaza cobrar una factura en estado no
  facturable, rechaza montos ≤ 0, y **rechaza sobre-pagos** (monto mayor al
  balance pendiente).
- **Probado exhaustivamente con datos reales antes de tocar el frontend**:
  pago parcial (verifiqué `PARTIALLY_PAID`), intento de sobre-pago (rechazado
  correctamente), pago final con cuenta bancaria (verifiqué `PAID`, el
  movimiento bancario y los 2 registros de auditoría) — luego limpié todos los
  datos de prueba.
- Server Action (`registerPaymentAction`) es solo un wrapper delgado sobre la
  función RPC — no reimplementa los pasos en JS, para no arriesgar la
  atomicidad.
- UI: formulario de cobro embebido en el detalle de la factura (solo visible
  si el estado y el balance lo permiten, y el usuario tiene `payments.create`),
  historial de cobros por factura, y página global `/payments` de solo
  lectura.
- Nota: no hay cuentas bancarias reales todavía (Bancos es F14) — el selector
  de cuenta muestra "Sin cuenta" como única opción hasta entonces; el cobro
  funciona igual, solo no genera movimiento bancario.
- Detectada (no bloqueante) una recomendación de seguridad de Supabase Auth
  ajena a este módulo — ver PROJECT_MASTER.md.

## F10 — Facturación

- **Módulo de Facturación**: crear factura ligada a un cliente directo o a un
  proyecto (si se elige proyecto, cliente y cotización de origen se derivan
  automáticamente — no hace falta elegirlos de nuevo). Líneas agregadas una
  por una (a diferencia de la conversión cotización→proyecto), permitiendo
  **facturación parcial/por cuotas** — común en eventos (depósito + factura
  final) — con opción de copiar valores desde una línea del proyecto como
  punto de partida editable.
- Campos NCF/`ncf_type` presentes y editables (sección R de F0: preparados,
  no activos/validados en producción todavía).
- **Flujo de estados en F10**: DRAFT → ISSUED (exige al menos una línea con
  total > 0) → CANCELLED. `PARTIALLY_PAID`/`PAID`/`OVERDUE` quedan para
  **F11 (Cobros)**, que los actualizará automáticamente al registrar pagos —
  no son botones manuales, para no romper la consistencia `paid_amount`/`balance`.
- `balance` se recalcula junto con los totales cada vez que cambian las líneas
  (`total - paid_amount`), dejando la estructura lista para que F11 solo tenga
  que sumar `paid_amount` sin duplicar lógica de cálculo.
- Verifiqué que no hay ambigüedad de relaciones PostgREST entre `invoices` y
  `projects` (a diferencia del caso resuelto en F9) — solo hay una FK en un
  sentido, el embed `projects(number, name)` no necesita desambiguarse.
- Agregado "Facturas" a la navegación del dashboard.
- Probado: build + lint limpios.

## F9 — Proyectos/Eventos

- **Módulo de Proyectos/Eventos**, con dos caminos de creación:
  1. **Conversión de cotización aprobada** (`convertQuotationToProjectAction`):
     copia cliente/contacto y todas las `quotation_items` → `project_items`
     sin reintroducir datos, vincula `quotation.project_id` ↔
     `project.quotation_id`, bloquea convertir una cotización no aprobada o
     ya convertida.
  2. **Proyecto directo**, sin cotización previa (la arquitectura ya lo
     permitía — `quotation_id` nullable).
- Detalle del proyecto con **pestañas** (sección 12 del prompt maestro):
  "Resumen" tiene contenido real (datos generales, líneas, presupuesto vs.
  costo estimado consumido); el resto (Finanzas, Ingresos, Gastos,
  Proveedores, Facturas, Cobros, Pagos, Bancos, Tareas, Documentos,
  Actividades, Rentabilidad) son placeholders que indican en qué fase futura
  se construyen — así no se finge funcionalidad que no existe.
- Flujo de estados de proyecto (PLANNING/CONFIRMED/IN_PROGRESS/COMPLETED/
  CANCELLED) con un solo permiso `projects.update` (sin aprobación especial,
  a diferencia de cotizaciones).
- Agregado el link "Convertir a Proyecto →" en el detalle de una cotización
  APPROVED (pieza pendiente de F8).
- Agregado "Proyectos" a la navegación del dashboard.
- Probado: build + lint limpios. La conversión cotización→proyecto (lógica
  multi-tabla más compleja hasta ahora) no se probó end-to-end en este
  entorno — recomendado que el usuario la pruebe en real antes de avanzar a
  F10 (Facturación depende de que existan proyectos y sus items).

## F8 — Cotizaciones

- **Módulo de Cotizaciones**: crear (cliente, fechas, moneda/tasa, condiciones),
  líneas de servicio (con cálculo automático de subtotal/descuento/impuesto/
  costo estimado por línea y agregado a nivel de cotización), listado con
  filtro por estado, detalle con totales y margen estimado.
- **Flujo de estados**: DRAFT → SENT (permiso `quotations.update`) →
  APPROVED/REJECTED (permiso `quotations.approve`, distinto del de edición) →
  CANCELLED. Botones de acción solo visibles si el usuario tiene el permiso
  correspondiente (capa de aplicación, además de RLS).
- **Generación de PDF + link de descarga** (decisión de F0, sección R): se
  adelantó de F17 la infraestructura mínima de Supabase Storage — bucket
  privado `documents` con políticas RLS basadas en `company_id` + permisos
  `documents.view`/`documents.upload`. El PDF se genera con
  `@react-pdf/renderer`, se sube a Storage, y se retorna una URL firmada
  (7 días de vigencia) para compartir por WhatsApp/correo.
- Se probó la generación de PDF en aislado (sin tocar Supabase) para validar
  que la librería funciona en este entorno antes de integrarla — generó un
  PDF válido correctamente.
- Nota de alcance: **"Convertir a Proyecto"** desde una cotización aprobada
  (sección O/13 del prompt maestro) se implementa en **F9 — Proyectos**, ya
  que requiere que exista el módulo de Proyectos.
- Agregado "Cotizaciones" a la navegación del dashboard.
- Probado: build + lint limpios.

## F7 — Servicios

- **Módulo de Servicios**: categorías (creación simple) + catálogo de servicios
  (nombre, categoría, unidad, precio/costo por defecto), edición y desactivar.
  Sin "lead" ni contactos — es un catálogo de configuración, no una entidad de
  relación con terceros.
- Escritura gateada por `settings.manage` (no por permisos propios de
  "services.*" — no existen en el catálogo, ver sección K del F0: es catálogo
  de configuración de empresa). Lectura abierta a cualquier usuario de la
  compañía, ya que cotizar/facturar necesita poder ver el catálogo.
- Agregado "Servicios" a la navegación del dashboard.
- Ajuste de tipos: el join embebido de PostgREST (`service_categories`) llega
  como arreglo aunque la relación sea muchos-a-uno; corregido el cast en la UI.
- Probado: build + lint limpios.

## F6 — Proveedores

- **Módulo completo de Proveedores**: listado con búsqueda, detalle/edición,
  contactos (crear/eliminar), desactivar (soft delete). Mismo patrón que
  Clientes (F5), pero sin el concepto de "lead" — un proveedor no tiene etapa
  potencial (sección 6 del prompt maestro).
- Server Actions con las 3 capas de seguridad y auditoría real en cada
  creación/edición/desactivación (`audit_logs`, reutilizando `lib/audit/log.ts`
  de F5 sin cambios).
- Agregado "Proveedores" a la navegación del dashboard.
- Probado: build + lint limpios.

## F5 — Clientes

- **Módulo completo de Clientes**: listado (con filtro por estado y búsqueda),
  detalle/edición, contactos (crear/eliminar), conversión LEAD→ACTIVE, desactivar
  (soft delete), e importación masiva vía CSV.
- `lib/audit/log.ts`: helper de auditoría reutilizable por todos los módulos
  futuros — cada creación/edición/conversión/desactivación de un cliente queda
  en `audit_logs`.
- Server Actions (`features/clients/actions.ts`) con las 3 capas de seguridad:
  UI condicional, `requirePermission()` al inicio de cada acción, y RLS como
  última línea (ya validada en F4).
- Validación con `zod` (`features/clients/schema.ts`), parseo de CSV con
  `papaparse`. Cada fila del CSV se valida individualmente; una fila inválida
  no aborta el resto — queda registrada en `import_batches.error_details` con
  su número de fila.
- Layout mínimo del dashboard con navegación lateral (se amplía por módulo a
  medida que se implementan F6 en adelante).
- Probado: build + lint limpios; parseo de CSV verificado con un archivo de
  ejemplo (fila sin nombre falla la validación como se esperaba, el resto se
  importa). Lógica de negocio (conversión idempotente, soft delete) revisada
  por código; prueba end-to-end en navegador pendiente de que el usuario corra
  `npm run dev` localmente (misma limitación de red del sandbox que en F4).

## F4 — Seguridad

- **Políticas RLS reales en las 32 tablas** (8 migraciones, `016` a `021`, más el
  helper `014`/`015`), reemplazando el denegar-todo de F3: cada tabla ahora valida
  `company_id` del usuario + el permiso correspondiente (`has_permission()`).
- Función auxiliar `user_company_ids()` para no repetir la subconsulta a
  `user_roles` en cada política.
- 2 permisos agregados (`documents.view`, `documents.upload`) que faltaban en el
  catálogo, asignados a los 5 roles.
- `lib/auth/permissions.ts`: capa de aplicación (2da de las 3 capas de seguridad) —
  `getCurrentUser()`, `hasPermission()`, `requirePermission()`, `getCurrentUserCompanyIds()`.
- Páginas de Auth: `/login` y `/recover-password` (Server Actions
  `signIn`/`signOut`/`requestPasswordReset`), sin registro público (Auth es interno).
- `proxy.ts` ahora protege rutas: sin sesión → `/login`; con sesión intentando
  entrar a `/login` o `/recover-password` → `/dashboard`.
- Stub protegido en `/dashboard` (contenido real en F16) para poder probar el flujo.
- **RLS probado con casos reales** (usuario de prueba temporal, creado y eliminado
  vía SQL): sin rol asignado no ve nada; con rol ADMIN puede crear/ver clientes;
  con rol FINANCE es bloqueado al crear un cliente pero sí ve facturas. Todos los
  casos se comportaron como se esperaba.
- Nota de transparencia: el sandbox de desarrollo no tiene salida de red hacia
  `*.supabase.co`, así que la prueba de RLS se hizo simulando el rol `authenticated`
  de Postgres vía SQL en lugar de un login real por navegador/Node — ver
  PROJECT_MASTER.md → Deuda técnica.

## F3 — Base de Datos

- **32 tablas** creadas en el proyecto Supabase real, en 13 migraciones versionadas
  (`supabase/migrations/001_*.sql` a `013_*.sql`), aplicadas y verificadas una por una:
  companies, profiles (+ trigger auto-creación desde `auth.users`), roles, permissions,
  role_permissions, user_roles (+ función `has_permission()`), clients (+ `status`
  LEAD/ACTIVE), client_contacts, suppliers, supplier_contacts, service_categories,
  services, bank_accounts (+ `opening_balance`), exchange_rates, quotations (+
  `currency`/`exchange_rate`), quotation_items, projects (+ `budget`), project_items,
  invoices, invoice_items, customer_payments, expense_categories, expenses,
  supplier_payments, bank_transactions, documents, tasks, activities, approvals,
  audit_logs, notifications, settings, import_batches.
- Resuelta la referencia circular `quotations` ↔ `projects` (FK diferida vía `ALTER TABLE`).
- Trigger genérico `set_updated_at()` aplicado a las 28 tablas con `updated_at`.
- **RLS habilitado en las 32 tablas** (denegar-todo por defecto); las políticas
  específicas se escriben en F4 — así no hubo ventana de tablas desprotegidas.
- **Seed aplicado**: compañía Mindfreak Events, 5 roles base (ADMIN, MANAGER, SALES,
  FINANCE, OPERATIONS), 30 permisos granulares, 92 asignaciones rol↔permiso.
  Guardado también en `supabase/seed/seed.sql` para resets locales.
- Revisados los *advisors* de seguridad y performance de Supabase: corregidos 2 WARN
  reales (search_path mutable en `set_updated_at`, RPC pública indebida de
  `handle_new_user`); el resto son INFO esperados (RLS sin políticas aún, índices sin
  uso en una BD nueva).
- Prueba de integridad real: FK bloquea `company_id` inexistente; insert válido
  confirma defaults correctos (`status = LEAD`, `currency = DOP`, `exchange_rate = 1`).

## F2 — Supabase

- Instaladas `@supabase/supabase-js` y `@supabase/ssr`.
- Creados `lib/supabase/client.ts` (Client Components) y `lib/supabase/server.ts`
  (Server Components/Actions), siguiendo el patrón oficial SSR de Supabase
  (sesión vía cookies, nunca localStorage — sección I de la arquitectura).
- Creado `lib/supabase/proxy.ts` + `proxy.ts` en la raíz (proxy/middleware de
  Next.js 16) para refrescar la sesión en cada request.
- Conectado al proyecto Supabase real `mindfreak-manager`
  (`hcospysvvwdfndihmemb.supabase.co`), obteniendo URL y clave pública
  (`publishable key`) directamente vía el conector de Supabase.
- `.env.local` (no versionado) con las credenciales reales; `.env.example`
  (sí versionado) como plantilla.
- Verificada la conexión real contra Supabase (`supabase.auth.getSession()`
  sin errores) y revisados los *advisors* de seguridad del proyecto (sin
  alertas — normal, aún no hay tablas).
- Build de producción verificado sin errores ni advertencias.

## F1 — Inicialización

- Proyecto Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + ESLint inicializado.
- Estructura de carpetas completa según sección D de la arquitectura: `/app` (rutas
  auth y dashboard por módulo), `/components` (ui, layout), `/features` (un
  directorio por módulo de negocio), `/lib` (supabase, auth, audit, pdf), `/hooks`,
  `/types`, `/services`, `/utils`, `/supabase` (migrations, seed), `/tests` (unit,
  integration, e2e).
- Design Tokens de marca (Mindfreak Events) centralizados en `app/globals.css`
  vía `@theme inline` de Tailwind v4: `brand-primary`, `brand-accent`,
  `brand-secondary`, `brand-background`, `brand-surface`, `brand-text`,
  `brand-muted`, `brand-success`, `brand-warning`, `brand-danger`.
- Página de inicio y layout mínimos, sin lógica de negocio.
- Nota: se removió la fuente Geist de Google Fonts (el entorno de build no tenía
  acceso a fonts.googleapis.com); se usa la fuente del sistema vía Tailwind
  (`font-sans`). Se puede reintroducir una fuente personalizada más adelante
  auto-hospedada (`next/font/local`) si se desea, sin impacto arquitectónico.
- Build de producción verificado (`npm run build`) sin errores.

## F0 — Arquitectura

- Arquitectura general aprobada (ver `F0-Arquitectura-MindfreakManager.md`).
- Ajustes incorporados durante la revisión: multimoneda real, UX/UI como
  principio transversal, clientes potenciales (leads), saldo inicial de
  cuentas bancarias, importación masiva de clientes vía CSV, catálogo de
  reportes (F19), presupuesto de proyecto explícito en el flujo central,
  y backlog inicial (alerta de presupuesto).
