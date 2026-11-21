# Develoyer Sistem POS — Plataforma Multiempresa

Plataforma SaaS multiempresa para ofrecer un sistema de Punto de Venta (POS) y gestión operativa a comercios independientes. Cada comercio administra su propia identidad, usuarios y datos, aislados mediante membresías, políticas RLS y funciones de Supabase. La plataforma está desarrollada con **Angular**, **TypeScript** y **Supabase** (PostgreSQL, Auth, Realtime, RLS).

---

## 🍦 1. Características Principales

### 📱 Flujo de Empleado (Mobile First)
- **Acceso compartido al salón**: no requiere cédula ni PIN. Un administrador habilita o cierra el acceso para su comercio durante la jornada; cualquier dispositivo con la URL del negocio puede entrar mientras esté abierto.
- **Selector visual de mesas**: Vista táctil de mesas 1 a 8 con estados en tiempo real (`available`, `occupied`).
- **Menú táctil estilo autoservicio**: Navegación ágil por categorías (Helados, Yogur, Fresas con Crema, Postres, Granizados, Toppings), fotos, precios y buscador.
- **Modal de personalización de productos**:
  - Selección de tamaño (Pequeño, Mediano, Grande).
  - Elección de los sabores configurados por producto desde Administración → Productos.
  - Selección de toppings compatibles por producto. Cada producto define cuántos vienen incluidos y el recargo por cada topping que exceda ese límite; los toppings no tienen precio individual.
  - Notas u observaciones especiales de preparación.
- **Carrito persistente y comanda**: Resumen del pedido en tiempo real, desglose con precio histórico y confirmación con envío inmediato a cocina.
- **Recuperación de toma en curso**: La mesa, el carrito y las observaciones se guardan localmente en cada dispositivo para recuperar el borrador al recargar la aplicación.
- **Pedidos del salón**: Seguimiento de comandas compartidas y cambio de estado a entregado. Los pedidos se atribuyen al empleado común «Salón».

### 💼 Flujo de Administrador (Desktop First)
- **Dashboard Ejecutivo en Tiempo Real**: Métricas clave del día (Ventas totales, pedidos activos, ticket promedio, mesas ocupadas).
- **Monitor de Comandas / Cocina**: Grilla visual no-kanban con auto-fill ordenado por prioridad de estados (`pending`, `preparing`, `ready`, `delivered`, `completed`).
- **Actualización automática de Pedidos Activos** cada 20 segundos mientras la pestaña está visible.
- **Módulo de Cobros y Liquidación**:
  - Panel deslizante lateral (*slide-over* de 430px) accesible desde la lista de comandas listas o completadas.
  - Métodos de pago colombianos: **Efectivo**, **Nequi**, **Daviplata**, **Transferencia**, **Otros**.
  - Botones rápidos de denominación de billetes colombianos (`$20.000`, `$50.000`, `$100.000 COP`).
  - Cálculo instantáneo del cambio a devolver.
  - Liberación automática de la mesa vinculada al liquidar la comanda.
- **Gestión de Caja y Arqueo Ciego**:
  - Apertura de jornada con base inicial en efectivo.
  - Registro de movimientos de caja (ingresos, egresos menores, compras de insumos).
  - Arqueo ciego de cierre: el administrador ingresa el dinero físico contado y el sistema calcula la diferencia/descuadre respecto a lo esperado por sistema.
  - Alerta y bloqueo de cierre si existen pedidos completados con pago pendiente.
  - Cierre de jornada y conciliación de caja.
- **Gestión de personal**:
  - Consulta y registro informativo del personal.
  - Control del acceso al salón durante la jornada desde el panel administrativo de cada comercio.
- **Catálogo de Productos y Toppings**:
  - Gestión de categorías, productos y toppings.
  - Tamaños de porción y precio configurables por producto; el empleado los selecciona desde una lista desplegable.
  - Matriz de compatibilidad `product_toppings`.
  - Edición de precios numéricos (`NUMERIC(12,2)`) y control de disponibilidad activa.
- **Reportes Financieros**:
  - Desglose de ingresos por método de pago.
  - Ranking de productos más vendidos.
  - Reporte semanal de ventas y gastos registrados de proveedores, separados del efectivo y arqueo diario de caja.
  - Descarga del reporte semanal en Excel con resumen, ventas diarias, gastos por proveedor, métodos de pago y productos más vendidos.
  - Histórico de turnos de caja y arqueos con diferencias.
- **Gastos de Proveedores**: módulo administrativo para registrar y consultar por semana proveedor, detalle, fecha y valor sin afectar el arqueo diario.

---

## 🛠️ 2. Stack Tecnológico

- **Frontend**:
  - **Angular (v22)**: Standalone Components, Angular Signals, Angular Router, Reactive Forms.
  - **Tailwind CSS**: Sistema de diseño adaptable y configurable por comercio:
    - Ciruela primario: `#45234F` (`#2e0d38` para contrastes oscuros).
    - Rosa dulce secundario: `#F7B7D2` / `#fdbdd8`.
    - Fondos sutiles: `#fff7fe` / `#F6F5F8` y lienzo blanco `#FFFFFF`.
    - Tipografía: `Inter` con números tabulares (`tnum`) para precisión contable.
    - Iconografía: `Material Symbols Outlined`.
  - **Supabase JS Client (`@supabase/supabase-js`)**: Conexión reactiva a PostgreSQL, Auth, Realtime y Storage.
- **Backend / BaaS**:
  - **Supabase Cloud**: PostgreSQL relacional.
  - **Supabase Auth**: Autenticación de administradores por comercio (Email/Password); los empleados entran mediante el permiso de jornada de su comercio.
  - **Supabase Realtime**: Suscripciones WebSocket a cambios en `orders`, `tables`, `payments` y `cash_registers`.
  - **Row Level Security (RLS)**: Reglas a nivel de fila que impiden a los empleados modificar precios, registrar pagos o consultar balances financieros.
  - **PostgreSQL Stored Procedures (RPCs)**: Transacciones ACID seguras con recalculo de precios en servidor para evitar fraudes desde el cliente.

---

## 🗄️ 3. Modelo de Base de Datos

La aplicación utiliza las tablas operativas del POS y agrega `businesses`, `business_memberships`, `platform_admins` y `business_salon_access` para separar comercios, sus administradores y el acceso de cada salón. Las tablas operativas tienen `business_id`; las políticas RLS y las RPC validan la membresía activa y el comercio relacionado.

El sistema implementa una arquitectura relacional completa estructurada en:

1. `profiles`: Perfiles de usuario vinculados a `auth.users`; `role` no concede privilegios por sí solo.
2. `employees`: Personal registrado y usuario compartido «Salón» que identifica los pedidos de la jornada.
3. `tables`: Mesas de salón con estado (`available`, `occupied`).
4. `categories`: Categorías de la carta ordenables.
5. `products`: Catálogo de helados, postres y bebidas con precio en `NUMERIC(12,2)`.
6. `toppings`: Adiciones, salsas y chips con recargo.
7. `product_toppings`: Relación muchos a muchos para restringir qué toppings aplican a cada producto.
8. `orders`: Cabecera de pedidos con separación estricta de `status` y `payment_status`.
9. `order_items`: Líneas de detalle con copia del nombre y precio unitario histórico.
10. `order_item_toppings`: Toppings aplicados a cada ítem con precio histórico.
11. `payments`: Registro de pagos y métodos de liquidación.
12. `cash_registers`: Aperturas, cierres de turno, arqueo y cálculo de descuadres.
13. `cash_movements`: Ingresos y egresos de caja durante la jornada.
14. `audit_logs`: Trazabilidad inmutable de operaciones críticas (creación de comanda, cobro, apertura/cierre de caja, login de empleados).

Las tablas heredadas `inventory` e `inventory_movements` pueden seguir existiendo en Supabase, pero esta aplicación ya no ofrece ni utiliza el módulo de inventario.

### Funciones SQL Seguras (RPC):
- `public.create_order(p_table_id, p_employee_id, p_notes, p_items)`: Recalcula y verifica precios de productos y toppings directamente en PostgreSQL; marca la mesa como ocupada y registra auditoría.
- `public.mark_order_completed(p_order_id)`: Marca la comanda como lista/completada para entrega y cobro.
- `public.register_order_payment(p_order_id, p_method, p_received, p_change)`: Liquida la orden, genera movimiento de caja en efectivo si aplica, libera la mesa y registra auditoría.
- `public.open_cash_register(p_opening_amount)`: Abre jornada y genera movimiento de base inicial.
- `public.close_cash_register(p_register_id, p_closing_amount, p_notes)`: Arquea caja y calcula diferencias.
- `public.create_business(...)` y `public.set_business_active(...)`: Alta y activación de comercios, solo para Super Administradores.
- `public.update_platform_business(...)` y `public.delete_platform_business(...)`: modificación y eliminación permanente de un comercio, solo para Super Administradores. La eliminación requiere confirmar el slug y borra sus datos operativos; las cuentas de Supabase Auth no se eliminan.
- `public.get_business_employee_tables(...)`, `public.create_business_employee_order(...)`, `public.get_business_employee_orders(...)` y `public.mark_business_employee_order_delivered(...)`: Operaciones del salón limitadas por slug, sesión, negocio activo y relaciones entre registros.
- Las RPC heredadas de empleado sin contexto de negocio no se exponen al cliente.

---

## 🚀 4. Puesta en Marcha

### Prerrequisitos
- Node.js (v18 o superior)
- npm (v9 o superior)
- Una cuenta en [Supabase](https://supabase.com)

### Paso 1: Configurar la Base de Datos en Supabase
1. Ingresa a tu proyecto en el [Dashboard de Supabase](https://supabase.com/dashboard).
2. Abre la sección **SQL Editor**.
3. En una base nueva, ejecuta únicamente los archivos de `supabase/migrations` en este orden:
   1. `20261005000001_initial_schema.sql`
   2. `20261005000002_seed_data.sql`
   3. `20261006000003_fix_profile_rls_login.sql`
   4. `20261006000004_employee_pin_login.sql`
   5. `20261006000005_employee_orders_and_tables.sql`
   6. `20261006000006_employee_order_lifecycle.sql`
   7. `20261006000007_employee_persistent_sessions.sql`
   8. `20261006000008_product_flavors.sql`
   9. `20261006000009_product_topping_allowance.sql`
   10. `20261006000010_global_salon_access.sql`
   11. `20261006000011_product_topping_permissions.sql`
   12. `20261006000012_order_item_topping_visibility.sql`
   13. `20261006000013_product_sizes.sql`
   14. `20261006000014_supplier_expenses.sql`
   15. `20261006000015_admin_cancel_order.sql`
   16. `20261006000016_product_image_storage.sql`
   17. `20261006000017_dedupe_duplicate_categories.sql`
   18. `20261114000001_business_identity.sql`
   19. `20261114000002_tenant_isolation.sql`
   20. `20261114000003_platform_admin_and_tenant_rpcs.sql`
   21. `20261115000001_platform_and_tenant_hardening.sql`
   22. `20261115000002_fix_profiles_rls_recursion.sql`
   23. `20261115000003_remove_legacy_default_tenant.sql`
   24. `20261115000004_platform_business_management.sql`
   25. `20261115000005_fix_tenant_trigger_record_field.sql`
   26. `20261115000006_fix_tenant_trigger_column_guards.sql`

   En una base existente, aplica solo las migraciones pendientes y en el mismo orden. No ejecutes una migración dos veces manualmente. El antiguo script de edición de perfiles se archivó en [`supabase/manual/legacy_profile_admin_update.sql`](./supabase/manual/legacy_profile_admin_update.sql); no debe usarse para otorgar acceso de plataforma.
4. No se crea un comercio ni se asigna un Super Administrador automáticamente. Las cuentas autorizadas deben agregarse explícitamente a `public.platform_admins`. La migración de aislamiento deja los registros preexistentes con `business_id = NULL`, fuera del acceso de los nuevos comercios. La migración 15003 se conserva como marcador vacío para mantener el orden y no modifica comercios ni datos. Verifica quiénes son Super Administradores:
   ```sql
   SELECT u.email
   FROM public.platform_admins AS pa
   JOIN auth.users AS u ON u.id = pa.user_id;
   ```
   Si ya ejecutaste alguna versión anterior de las migraciones en producción, revisa su historial y los miembros autorizados antes de aplicar las pendientes. Las migraciones guardan las filas operativas legadas con `business_id = NULL`, fuera del acceso de los nuevos comercios. La migración 15003 es un marcador vacío y no elimina ni desvincula datos; revisa manualmente cualquier comercio antiguo que deba retirarse. La migración 15004 agrega modificación y eliminación permanente desde el panel; para eliminar, se debe escribir el slug exacto. Los datos del comercio se borran, pero las cuentas de Supabase Auth se conservan. Las migraciones 15005 y 15006 corrigen el trigger de aislamiento para que solo lea columnas existentes en cada tabla.
5. Después de aplicar y comprobar las migraciones, publica el frontend. La plataforma abre en `/platform/login` y el Super Administrador gestiona los comercios en `/platform/businesses`. Para crear el primero, crea antes su usuario confirmado y perfil activo en Supabase Auth; luego asígnale el rol de plataforma mediante la consulta del Paso 2. Crea el primer comercio desde el panel.
6. El administrador abre **Modo Salón** desde el panel del negocio. Mientras esté habilitado, cualquiera con la URL de ese comercio puede usar el acceso compartido sin cédula ni PIN. Al cerrarlo, el servidor revoca las sesiones.
   > Los pedidos creados desde el acceso compartido se atribuyen al empleado **Salón**. Cierra el acceso al terminar la jornada; cualquier persona con la URL puede operar mientras permanezca abierto.
7. En **Administración → Productos**, puedes cargar imágenes JPG, PNG o WebP de hasta 5 MB desde tu dispositivo, habilitar varios tamaños por producto y configurar el precio final de cada porción; el empleado elige el tamaño en una lista desplegable. También puedes agregar toppings con **Agregar topping**, elegir cuáles permite cada producto, cuántos incluye y el recargo por exceder el límite, además de definir los sabores. El borrador de pedido se conserva localmente en cada dispositivo tras recargar la página.

### Paso 2: Autorizar al Super Administrador
1. Crea y confirma la cuenta de confianza en **Authentication → Users**. La autorización global se concede desde SQL, no desde `profiles.role` ni desde el navegador.
2. En SQL Editor, sustituye el correo de ejemplo por el correo confirmado y ejecuta:
   ```sql
   INSERT INTO public.platform_admins (user_id)
   SELECT u.id
   FROM auth.users AS u
   JOIN public.profiles AS p ON p.id = u.id
   WHERE lower(u.email) = lower('superadmin@tu-dominio.com')
     AND u.email_confirmed_at IS NOT NULL
     AND p.is_active = true
   ON CONFLICT (user_id) DO NOTHING;
   ```
   La migración no concede acceso a ninguna cuenta por correo ni por `profiles.role`. No uses `UPDATE profiles SET role = 'admin'` para autorizar el acceso global.
3. Para asignar un administrador a un comercio, primero crea y confirma su usuario en Supabase Auth. Después, desde el panel global, crea el negocio con ese correo. La RPC valida la cuenta y la membresía; un perfil desactivado no se reactiva automáticamente.

### Paso 3: Configurar las Variables de Entorno
Configura `src/environments/environment.ts` con la URL y la clave pública (`anon` o `publishable`) del proyecto que confirmaste:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://<project-ref>.supabase.co',
  supabaseAnonKey: '<publishable-or-anon-key>',
};
```
Obtén los valores desde **Project Settings → API** del proyecto correcto. La clave pública se usa en el navegador; nunca incluyas `service_role` ni `sb_secret` en el frontend. Revisa el archivo antes de publicar para evitar desplegar la URL o clave pública de otro proyecto.

### Paso 4: Ejecutar la Aplicación
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo en http://localhost:4200
npm start

# 3. Compilar para producción
npm run build

# 4. Ejecutar pruebas unitarias
npm test -- --watch=false
```

### Paso 5: Desplegar en Netlify
1. Publica el repositorio en GitHub. Si todavía no lo has subido, inicia sesión en GitHub desde VS Code y ejecuta `git push -u origin main`.
2. En [Netlify](https://app.netlify.com/), selecciona **Add new site → Import an existing project** y conecta el repositorio de GitHub.
3. El repositorio incluye `netlify.toml` con el comando `npm run build` y el directorio `dist/develoyer-sistem-pos/browser`. Si la interfaz de Netlify muestra `dist`, actualízalo para que coincida con esta configuración. Netlify instalará las dependencias con `npm install`.
4. Si no vas a conectarlo a GitHub, ejecuta `npm run build` localmente y publica la carpeta `dist/develoyer-sistem-pos/browser` en Netlify.
5. En Supabase, abre **Authentication → URL Configuration** y configura la URL del sitio de Netlify como **Site URL** y como URL de redirección permitida.
6. Comprueba el acceso de administrador, pedidos y recarga directa de rutas como `/login` y `/employee/menu`.

El archivo `public/_redirects` envía las rutas de Angular a `index.html`, necesario para que los enlaces funcionen al recargar en Netlify. La clave `anon`/publishable de Supabase se usa en el navegador y no es un secreto; nunca publiques una clave `service_role` o `sb_secret`.

Las migraciones `20261115000001_platform_and_tenant_hardening.sql`, `20261115000002_fix_profiles_rls_recursion.sql`, `20261115000003_remove_legacy_default_tenant.sql`, `20261115000004_platform_business_management.sql`, `20261115000005_fix_tenant_trigger_record_field.sql` y `20261115000006_fix_tenant_trigger_column_guards.sql` deben aplicarse y probarse en el proyecto Supabase correcto. La segunda corrige la política RLS recursiva de `profiles`; la tercera es un marcador vacío y no altera datos; la cuarta agrega modificar/eliminar comercios; y las dos últimas corrigen el trigger de aislamiento. Hasta entonces, el aislamiento y los permisos multiempresa no están verificados en producción.

---

## 👥 5. Datos y Acceso

La plataforma no crea comercios, productos ni usuarios de demostración:

### Super Administrador:
- Crea y confirma en Supabase Auth una cuenta controlada por la organización.
- Autorízala mediante una inserción administrativa en `public.platform_admins`, siguiendo el Paso 2. El campo `profiles.role` no otorga acceso global.

### Empleados de Salón:
- Entran al salón sin credenciales cuando el administrador habilita el acceso para ese comercio.
- El acceso compartido está delimitado al negocio y a la jornada activa.

### Caja Inicial:
- Base de apertura predeterminada: `$150.000 COP`.

---

## 🔒 6. Seguridad y Buenas Prácticas Implementadas

1. **Sin Exposición de Secretos**: El cliente Angular solo utiliza la clave pública anónima (`anon`). La clave secreta `service_role` jamás se almacena en el cliente.
2. **Protección Anti-Manipulación de Precios**: Los subtotales y totales no se calculan de manera confiada en el navegador; la función almacenada `create_order` consulta directamente la tabla `products` y `toppings` para multiplicar cantidad por precio oficial en base de datos.
3. **Restricción de Privilegios RLS**:
   - Empleados anónimos / con sesión de jornada no tienen permisos de lectura ni escritura en las tablas de `payments`, `cash_registers`, `cash_movements`, `inventory_movements` o configuraciones.
   - Las RPC administrativas y las políticas RLS validan membresía y perfil activo para el negocio; `profiles.role` por sí solo no concede privilegios.
4. **Arqueo Ciego**: Durante el cierre de turno, el cajero debe declarar el monto físico contado en efectivo antes de ver el resultado del sistema, garantizando transparencia en los descuadres de caja.
5. **Auditoría Permanente**: Cada acción crítica (creación de pedido, pago, cobro, apertura/cierre de caja, inicio de sesión de empleado) se registra automáticamente en `public.audit_logs` con usuario, timestamp y metadatos JSON.

---

## 📂 7. Estructura del Proyecto

```
develoyer-sistem-pos/
├── diseño/                          # Guía de estilo, tokens y prototipos UI
│   └── artisanal_confectionery_pos/
├── public/                          # Activos públicos de la plataforma
├── src/
│   ├── app/
│   │   ├── admin/                   # Vistas y componentes del Administrador (Desktop)
│   │   │   ├── cash/                # Arqueo ciego, apertura y cierre de caja
│   │   │   ├── dashboard/           # KPIs en tiempo real
│   
│   │   │   ├── orders/              # Monitor no-kanban de comandas
│   │   │   ├── payments/            # Slide-over lateral de cobro en COP
│   │   │   ├── products/            # Catálogo de helados y toppings
│   │   │   ├── reports/             # Métricas y reportes financieros
│   │   │   └── admin-layout.component.ts
│   │   ├── core/                    # Servicios troncales, modelos y seguridad
│   │   │   ├── auth/                # Login dual (Admin / Empleado por PIN)
│   │   │   ├── guards/              # authGuard, adminGuard, employeeGuard
│   │   │   ├── models/              # Tipos TypeScript y enums
│   │   │   └── services/            # Servicios Supabase, Realtime, Carrito, Caja, etc.
│   │   ├── employee/                # Vistas del Personal de Salón (Mobile First)
│   │   │   ├── customization/       # Modal de tamaños, sabores y toppings
│   │   │   ├── menu/                # Menú táctil con fotos y carrito flotante
│   │   │   ├── orders/              # Seguimiento de comandas y entrega a mesa
│   │   │   ├── tables/              # Selector táctil de Mesas 1 a 8
│   │   │   └── employee-layout.component.ts
│   │   ├── shared/                  # Pipes (COP), toast y componentes compartidos
│   │   ├── app.routes.ts            # Enrutamiento protegido por guards
│   │   ├── app.ts                   # Componente raíz con contenedor de toasts
│   │   └── app.html
│   ├── environments/                # Variables de conexión Supabase
│   ├── index.html                   # Fuentes Inter y Material Symbols
│   └── styles.css                   # Utilidades Tailwind y formato tabular
├── supabase/
│   ├── migrations/                  # Migraciones SQL incrementales
├── angular.json
├── package.json
└── README.md
```

---

*Develoyer Sistem POS — una plataforma, comercios independientes.*
