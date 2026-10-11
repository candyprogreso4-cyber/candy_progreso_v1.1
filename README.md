# CANDY EL PROGRESO — Sistema POS Heladería & Cafetería Artesanal

Sistema web integral de Punto de Venta (POS) y gestión operativa para la heladería artesanal **CANDY EL PROGRESO**, desarrollado con **Angular**, **TypeScript**, **Supabase** (PostgreSQL, Auth, Realtime, RLS) y una interfaz de usuario optimizada (Mobile First para empleados en salón y Desktop First para administración y caja).

---

## 🍦 1. Características Principales

### 📱 Flujo de Empleado (Mobile First)
- **Acceso compartido al salón**: no requiere cédula ni PIN. Un administrador habilita o cierra el acceso global para la jornada; cualquier dispositivo con la URL puede entrar mientras esté abierto.
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
  - Control del acceso global al salón durante la jornada desde el panel administrativo.
- **Catálogo de Productos y Toppings**:
  - Gestión de categorías, productos y toppings.
  - Tamaños de porción y precio configurables por producto; el empleado los selecciona desde una lista desplegable.
  - Matriz de compatibilidad `product_toppings`.
  - Edición de precios numéricos (`NUMERIC(12,2)`) y control de disponibilidad activa.
- **Reportes Financieros**:
  - Desglose de ingresos por método de pago.
  - Ranking de productos más vendidos.
  - Histórico de turnos de caja y arqueos con diferencias.

---

## 🛠️ 2. Stack Tecnológico

- **Frontend**:
  - **Angular (v22)**: Standalone Components, Angular Signals, Angular Router, Reactive Forms.
  - **Tailwind CSS**: Sistema de diseño con la identidad corporativa de Candy El Progreso:
    - Ciruela primario: `#45234F` (`#2e0d38` para contrastes oscuros).
    - Rosa dulce secundario: `#F7B7D2` / `#fdbdd8`.
    - Fondos sutiles: `#fff7fe` / `#F6F5F8` y lienzo blanco `#FFFFFF`.
    - Tipografía: `Inter` con números tabulares (`tnum`) para precisión contable.
    - Iconografía: `Material Symbols Outlined`.
  - **Supabase JS Client (`@supabase/supabase-js`)**: Conexión reactiva a PostgreSQL, Auth, Realtime y Storage.
- **Backend / BaaS**:
  - **Supabase Cloud**: PostgreSQL relacional.
  - **Supabase Auth**: Autenticación de Administrador (Email/Password); los empleados entran mediante el permiso global de jornada.
  - **Supabase Realtime**: Suscripciones WebSocket a cambios en `orders`, `tables`, `payments` y `cash_registers`.
  - **Row Level Security (RLS)**: Reglas a nivel de fila que impiden a los empleados modificar precios, registrar pagos o consultar balances financieros.
  - **PostgreSQL Stored Procedures (RPCs)**: Transacciones ACID seguras con recalculo de precios en servidor para evitar fraudes desde el cliente.

---

## 🗄️ 3. Modelo de Base de Datos (14 Tablas activas)

El sistema implementa una arquitectura relacional completa estructurada en:

1. `profiles`: Perfiles de usuario vinculados a `auth.users` (`role IN ('admin', 'employee')`).
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
- `public.get_salon_access()`: Consulta si el administrador habilitó el acceso global y devuelve el usuario compartido.
- `public.set_salon_access_enabled(p_enabled)`: Habilita o cierra el acceso del salón para el administrador autenticado.
- `public.get_employee_tables(...)`, `public.create_employee_order(...)`, `public.get_employee_orders(...)` y `public.mark_employee_order_delivered(...)`: Operaciones del salón, rechazadas por PostgreSQL cuando el acceso de la jornada está cerrado.

---

## 🚀 4. Puesta en Marcha

### Prerrequisitos
- Node.js (v18 o superior)
- npm (v9 o superior)
- Una cuenta en [Supabase](https://supabase.com)

### Paso 1: Configurar la Base de Datos en Supabase
1. Ingresa a tu proyecto en el [Dashboard de Supabase](https://supabase.com/dashboard).
2. Abre la sección **SQL Editor**.
3. Para una base nueva, ejecuta [`supabase/real_schema.sql`](./supabase/real_schema.sql) y luego las migraciones `20261006000006_employee_order_lifecycle.sql` hasta `20261006000013_product_sizes.sql`, en orden. Para actualizar una base existente, ejecuta las migraciones pendientes en orden hasta `20261006000013_product_sizes.sql`.
4. El administrador abre **Modo Salón** desde el panel. Mientras el acceso esté habilitado, cualquier dispositivo con la URL puede entrar sin cédula ni PIN; al cerrar el acceso, las operaciones del salón quedan bloqueadas también en el servidor.
   > Los pedidos creados desde el acceso compartido se atribuyen al empleado **Salón**. Cierra el acceso al terminar la jornada; cualquier persona con la URL puede operar mientras permanezca abierto.
5. En **Administración → Productos**, puedes habilitar varios tamaños por producto y configurar el precio final de cada porción; el empleado elige el tamaño en una lista desplegable. También puedes agregar toppings con **Agregar topping**, elegir cuáles permite cada producto, cuántos incluye y el recargo por exceder el límite, además de definir los sabores. El borrador de pedido se conserva localmente en cada dispositivo tras recargar la página.

### Paso 2: Crear el Usuario Administrador
1. En el Dashboard de Supabase, dirígete a **Authentication → Users**.
2. Haz clic en **Add User → Create User**:
   - **Email**: `admin@candycloud.com` (o el de tu preferencia).
   - **Password**: Define una contraseña segura (ej. `AdminCandy2026!`).
   - Marca **Auto Confirm User**.
3. En el **SQL Editor**, promueve tu usuario a rol `admin`:
   ```sql
   UPDATE public.profiles
   SET role = 'admin', full_name = 'Administrador General'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@candycloud.com');
   ```

### Paso 3: Configurar las Variables de Entorno
Verifica que el archivo `src/environments/environment.ts` apunte a tu proyecto Supabase:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://pnmvqdvnvcmtottvfvns.supabase.co',
  supabaseAnonKey: 'sb_publishable_OGOtTRSG6CtQRK-da6FB-A_1xtoxqeS',
};
```
*(Para producción, reemplaza con tus credenciales de [Project Settings → API]).*

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

---

## 👥 5. Datos y Credenciales de Demostración

El script de inicialización (`supabase/schema.sql`) incluye datos de prueba listos para usar:

### Administrador:
- **Email**: `admin@candycloud.com` (crear en Supabase Auth siguiendo el Paso 2)
- **Rol**: `admin`

### Empleados de Salón:
- Entran al salón sin credenciales cuando el administrador habilita el acceso global.
- El administrador asigna o restablece el PIN en **Administración → Personal y acceso**.

### Caja Inicial:
- Base de apertura predeterminada: `$150.000 COP`.

---

## 🔒 6. Seguridad y Buenas Prácticas Implementadas

1. **Sin Exposición de Secretos**: El cliente Angular solo utiliza la clave pública anónima (`anon`). La clave secreta `service_role` jamás se almacena en el cliente.
2. **Protección Anti-Manipulación de Precios**: Los subtotales y totales no se calculan de manera confiada en el navegador; la función almacenada `create_order` consulta directamente la tabla `products` y `toppings` para multiplicar cantidad por precio oficial en base de datos.
3. **Restricción de Privilegios RLS**:
   - Empleados anónimos / con sesión de jornada no tienen permisos de lectura ni escritura en las tablas de `payments`, `cash_registers`, `cash_movements`, `inventory_movements` o configuraciones.
   - Solo perfiles con `role = 'admin'` pueden liquidar pagos, registrar movimientos de caja o cerrar turnos.
4. **Arqueo Ciego**: Durante el cierre de turno, el cajero debe declarar el monto físico contado en efectivo antes de ver el resultado del sistema, garantizando transparencia en los descuadres de caja.
5. **Auditoría Permanente**: Cada acción crítica (creación de pedido, pago, cobro, apertura/cierre de caja, inicio de sesión de empleado) se registra automáticamente en `public.audit_logs` con usuario, timestamp y metadatos JSON.

---

## 📂 7. Estructura del Proyecto

```
candy-progreso/
├── diseño/                          # Guía de estilo, tokens y prototipos UI
│   └── artisanal_confectionery_pos/
├── public/                          # Activos estáticos (logo oficial Candy El Progreso)
├── src/
│   ├── app/
│   │   ├── admin/                   # Vistas y componentes del Administrador (Desktop)
│   │   │   ├── cash/                # Arqueo ciego, apertura y cierre de caja
│   │   │   ├── dashboard/           # KPIs en tiempo real
│   
│   │   │   ├── orders/              # Monitor no-kanban de comandas
│   │   │   ├── payments/            # Slide-over lateral de cobro en COP
│   │   │   ├── products/            # Catálogo de helados y toppings
│   │   │   ├── employees/           # Gestión de empleados y PIN de acceso
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
│   └── schema.sql                   # Script maestro consolidado con RLS y Seeds
├── angular.json
├── package.json
└── README.md
```

---

*CANDY EL PROGRESO — Calidad artesanal y tecnología de vanguardia.*
