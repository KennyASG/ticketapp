# 🧪 GUÍA DE TESTING COMPLETO - TicketApp

## 📋 Tabla de Contenidos
1. [Prerequisitos](#prerequisitos)
2. [Configuración Inicial](#configuración-inicial)
3. [Flujo de Testing](#flujo-de-testing)
4. [Orden de Ejecución](#orden-de-ejecución)
5. [Escenarios de Prueba](#escenarios-de-prueba)
6. [Validaciones por Endpoint](#validaciones-por-endpoint)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisitos

### Software Necesario
- ✅ PostgreSQL 13+ corriendo
- ✅ Node.js 16+ instalado
- ✅ Postman instalado
- ✅ Base de datos `ticketapp` creada y con `schema.sql` ejecutado

### Servicios Activos
Todos los servicios deben estar corriendo en sus puertos respectivos:
```bash
# Terminal 1
cd services/auth-service && npm start        # Puerto 3000

# Terminal 2
cd services/concert-service && npm start     # Puerto 3001

# Terminal 3
cd services/venue-service && npm start       # Puerto 3002

# Terminal 4
cd services/ticket-service && npm start      # Puerto 3003

# Terminal 5
cd services/order-service && npm start       # Puerto 3004

# Terminal 6
cd services/notification-service && npm start # Puerto 3005
```

### Variables de Entorno
Verificar que todos los servicios tengan configurado:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ticketapp
JWT_SECRET=tu_secret_aqui
PORT=300X
```

---

## ⚙️ Configuración Inicial

### Paso 1: Importar Colección en Postman

1. Abre Postman
2. Click en **Import** (esquina superior izquierda)
3. Arrastra el archivo `TicketApp-Complete-Flow.postman_collection.json`
4. Click en **Import**

### Paso 2: Configurar Environment

1. En Postman, click en **Environments** (icono de engranaje)
2. Click en **Create Environment**
3. Nombre: `TicketApp Local`
4. Agregar variables iniciales:

| Variable | Initial Value | Current Value |
|----------|--------------|---------------|
| `base_url_auth` | `http://localhost:3000` | `http://localhost:3000` |
| `base_url_concert` | `http://localhost:3001` | `http://localhost:3001` |
| `base_url_venue` | `http://localhost:3002` | `http://localhost:3002` |
| `base_url_ticket` | `http://localhost:3003` | `http://localhost:3003` |
| `base_url_order` | `http://localhost:3004` | `http://localhost:3004` |
| `base_url_notification` | `http://localhost:3005` | `http://localhost:3005` |
| `auth_token` | `` | `` |
| `user_id` | `` | `` |
| `concert_id` | `` | `` |
| `venue_id` | `1` | `1` |
| `ticket_type_id` | `` | `` |
| `reservation_id` | `` | `` |
| `order_id` | `` | `` |

5. Click en **Save**
6. Selecciona el environment `TicketApp Local` en el dropdown de la esquina superior derecha

### Paso 3: Verificar Base de Datos

Ejecuta en PostgreSQL:
```sql
-- Verificar que existan usuarios
SELECT * FROM users;

-- Verificar que existan roles
SELECT * FROM roles;

-- Verificar que existan venues (de schema.sql inicial)
SELECT * FROM venues;

-- Verificar que existan status
SELECT * FROM status_generales;
```

**Resultado esperado:**
- ✅ Al menos 1 usuario admin (email: `admin@example.com`)
- ✅ 2 roles (admin y user)
- ✅ Al menos 1 venue
- ✅ Status para todos los dominios (concert, order, ticket, etc.)

---

## 🎯 Flujo de Testing

### Diagrama de Flujo
```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO                           │
└─────────────────────────────────────────────────────────────┘

1. AUTENTICACIÓN
   ├─► Register User (opcional)
   ├─► Login Admin ─────────────► Obtiene TOKEN
   └─► Get Current User

2. SETUP INICIAL (Admin)
   ├─► Create Venue ────────────► venue_id
   ├─► Create Section ──────────► section_id (con asientos)
   └─► Get Venue Sections

3. CREAR CONCIERTO (Admin)
   ├─► Create Concert ──────────► concert_id + concert_seats
   ├─► Get Concert By ID
   ├─► Create Ticket Type ──────► ticket_type_id
   └─► Get Available Seats

4. PROCESO DE COMPRA (Usuario)
   ├─► Create Reservation ──────► reservation_id (expira en 15 min)
   ├─► Create Order ────────────► order_id (status: pending)
   └─► Confirm Order ───────────► Genera tickets + Pago simulado

5. POST-COMPRA
   ├─► Get User Orders
   ├─► Get Order By ID ─────────► Ver tickets generados
   ├─► Send Tickets Email
   └─► Send Confirmation Email

6. REPORTES (Admin)
   ├─► Get All Orders
   └─► Get Sales by Concert
```

---

## 📝 Orden de Ejecución

### FASE 1: Autenticación ⚡ (OBLIGATORIO)

#### 1.1 Login Admin
**Endpoint:** `POST /auth/login`

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Validaciones:**
- ✅ Status: 200
- ✅ Response contiene `token`
- ✅ Token se guarda automáticamente en `{{auth_token}}`

**¿Por qué es importante?**
> Todos los endpoints subsiguientes requieren el token de autenticación. Este paso es CRÍTICO.

#### 1.2 Get Current User (Opcional)
**Endpoint:** `GET /auth/me`

**Validaciones:**
- ✅ Status: 200
- ✅ Response contiene datos del usuario admin
- ✅ `role_id` = 1 (admin)

---

### FASE 2: Setup de Venues (Si usas venues existentes, SKIP)

#### 2.1 Get All Venues
**Endpoint:** `GET /venues`

**Validaciones:**
- ✅ Status: 200
- ✅ Response es array de venues
- ✅ Si hay venues, usar `venue_id` existente

**Decisión:**
- Si existen venues → Usar ID existente y SKIP a 2.4
- Si NO existen venues → Continuar con 2.2

#### 2.2 Create Venue (Solo si no hay venues)
**Endpoint:** `POST /admin/venues`

**Body:**
```json
{
  "name": "Arena Test",
  "address": "Calle Falsa 123",
  "city": "Ciudad Test",
  "country": "Guatemala"
}
```

**Validaciones:**
- ✅ Status: 201
- ✅ Response contiene `venue.id`
- ✅ `venue_id` se guarda automáticamente

#### 2.3 Get Venue Sections
**Endpoint:** `GET /venues/{{venue_id}}/sections`

**Validaciones:**
- ✅ Status: 200
- ✅ Response es array de secciones
- ✅ Cada sección tiene `id`, `name`, `capacity`

#### 2.4 Create Section (Solo si el venue no tiene secciones)
**Endpoint:** `POST /admin/venues/{{venue_id}}/sections`

**Body:**
```json
{
  "name": "VIP Test",
  "capacity": 50
}
```

**Validaciones:**
- ✅ Status: 201
- ✅ Response contiene `section.id`
- ✅ Se crearon 50 asientos automáticamente
- ✅ Mensaje: "Sección creada con 50 asientos"

**¿Qué pasa internamente?**
> Al crear una sección, el sistema genera automáticamente N asientos (donde N = capacity) numerados del 1 al N.

---

### FASE 3: Crear Concierto 🎵 (OBLIGATORIO)

#### 3.1 Get All Concerts (Opcional)
**Endpoint:** `GET /admin/concerts`

**Validaciones:**
- ✅ Status: 200
- ✅ Response es array de conciertos
- ✅ Cada concierto incluye `status` y `venues`

#### 3.2 Create Concert ⭐ CRÍTICO
**Endpoint:** `POST /admin/concerts`

**Body:**
```json
{
  "title": "Rock Fest 2025",
  "description": "El mejor festival de rock del año",
  "date": "2025-12-15T20:00:00Z",
  "status_id": 2,
  "venue_id": 1
}
```

**Parámetros importantes:**
- `status_id`: 2 = "on_sale" (ver tabla `status_generales` donde `dominio='concert'`)
- `venue_id`: ID del venue donde se realizará
- `date`: Debe ser fecha futura en formato ISO

**Validaciones:**
- ✅ Status: 201
- ✅ Response contiene `concert.id`
- ✅ `concert_id` se guarda automáticamente
- ✅ Concierto asociado al venue
- ✅ Se crearon `concert_seats` automáticamente para todos los asientos del venue

**¿Qué pasa internamente?**
> 1. Valida que el venue exista
> 2. Valida que no haya traslape de horarios (±4 horas)
> 3. Crea el concierto
> 4. Crea relación `concert_venue_detail`
> 5. Crea `concert_seats` para TODOS los asientos del venue (status: available)

**Verificación en BD:**
```sql
-- Ver concert_seats creados
SELECT COUNT(*) FROM concert_seats WHERE concert_id = 1;
-- Debe ser igual a la suma de capacidades de todas las secciones del venue
```

#### 3.3 Get Concert By ID
**Endpoint:** `GET /admin/concerts/{{concert_id}}`

**Validaciones:**
- ✅ Status: 200
- ✅ Response incluye:
  - `status` (objeto con descripción)
  - `venues` (array con datos del venue)
  - `venues[0].sections` (secciones del venue)
  - `ticketTypes` (array, puede estar vacío aún)

#### 3.4 Get Available Seats
**Endpoint:** `GET /concerts/{{concert_id}}/available-seats`

**Validaciones:**
- ✅ Status: 200
- ✅ Response es array agrupado por sección
- ✅ Cada sección muestra:
  - `section_name`
  - `capacity`
  - `available_seats` (array de asientos disponibles)

**Ejemplo de respuesta:**
```json
[
  {
    "section_id": 1,
    "section_name": "VIP",
    "capacity": 100,
    "available_seats": [
      {"seat_id": 1, "seat_number": 1},
      {"seat_id": 2, "seat_number": 2},
      ...
    ]
  }
]
```

---

### FASE 4: Tipos de Tickets 🎫 (OBLIGATORIO)

#### 4.1 Get Ticket Types by Concert
**Endpoint:** `GET /concerts/{{concert_id}}/ticket-types`

**Validaciones:**
- ✅ Status: 200
- ✅ Response es array (puede estar vacío)

#### 4.2 Create Ticket Type ⭐ CRÍTICO
**Endpoint:** `POST /admin/concerts/{{concert_id}}/ticket-types`

**Body:**
```json
{
  "section_id": 1,
  "name": "VIP - Rock Fest",
  "price": 500,
  "available": 100
}
```

**Parámetros importantes:**
- `section_id`: ID de la sección del venue (opcional, puede ser `null` para tickets generales)
- `price`: Precio en la moneda configurada (entero)
- `available`: Cantidad de tickets disponibles para venta

**Validaciones:**
- ✅ Status: 201
- ✅ Response contiene `ticketType.id`
- ✅ `ticket_type_id` se guarda automáticamente
- ✅ `available` coincide con lo especificado

**¿Qué pasa internamente?**
> Se crea un tipo de ticket asociado al concierto. Este tipo de ticket se usará para crear reservas y órdenes.

**Recomendación:**
> Crear al menos 2 tipos de tickets (ej: VIP y General) para probar diferentes escenarios.

#### 4.3 Update Ticket Type (Opcional)
**Endpoint:** `PUT /admin/ticket-types/{{ticket_type_id}}`

**Body:**
```json
{
  "price": 450,
  "available": 95
}
```

**Validaciones:**
- ✅ Status: 200
- ✅ Precio y disponibilidad actualizados

---

### FASE 5: Proceso de Reserva y Compra 🛒 (FLUJO CRÍTICO)

#### 5.1 Create Reservation ⭐ INICIO DEL FLUJO DE COMPRA
**Endpoint:** `POST /tickets/reserve`

**Body:**
```json
{
  "concert_id": {{concert_id}},
  "ticket_type_id": {{ticket_type_id}},
  "quantity": 2
}
```

**Validaciones:**
- ✅ Status: 201
- ✅ Response contiene:
  - `reservation.id`
  - `reservation.expires_at` (15 minutos desde creación)
  - `quantity` confirmada
  - `message` indicando tiempo de expiración
- ✅ `reservation_id` se guarda automáticamente

**¿Qué pasa internamente?**
> 1. Verifica disponibilidad del ticket type
> 2. Crea reserva con status "held" que expira en 15 minutos
> 3. Reduce `available` del ticket type
> 4. Si el ticket tiene `section_id`, marca asientos como "reserved"

**Verificación en BD:**
```sql
-- Ver reserva creada
SELECT * FROM reservations WHERE id = X;

-- Ver disponibilidad reducida
SELECT available FROM ticket_types WHERE id = X;

-- Ver asientos reservados (si aplica)
SELECT COUNT(*) FROM concert_seats 
WHERE concert_id = X AND status_id = (
  SELECT id FROM status_generales 
  WHERE dominio='seat' AND descripcion='reserved'
);
```

**⚠️ IMPORTANTE:**
> La reserva expira en 15 minutos. Después de ese tiempo, se debe ejecutar el endpoint de liberar reservas expiradas.

#### 5.2 Get User Reservations (Opcional)
**Endpoint:** `GET /tickets/reservations`

**Validaciones:**
- ✅ Status: 200
- ✅ Response incluye todas las reservas del usuario
- ✅ Cada reserva muestra:
  - `concert` (título y fecha)
  - `status` (descripción: "held", "expired", "confirmed")
  - `expires_at`

#### 5.3 Create Order ⭐ CREAR ORDEN DE COMPRA
**Endpoint:** `POST /orders`

**Body:**
```json
{
  "reservation_id": {{reservation_id}},
  "ticket_type_id": {{ticket_type_id}},
  "quantity": 2
}
```

**Validaciones:**
- ✅ Status: 201
- ✅ Response contiene:
  - `order.id`
  - `total` (price × quantity)
  - `message`: "Orden creada. Procede a confirmar el pago."
- ✅ `order_id` se guarda automáticamente
- ✅ Status de orden: "pending"

**¿Qué pasa internamente?**
> 1. Verifica que la reserva exista y no haya expirado
> 2. Verifica que pertenezca al usuario autenticado
> 3. Calcula total (precio × cantidad)
> 4. Crea orden con status "pending"
> 5. Crea order_items asociados

**Verificación en BD:**
```sql
-- Ver orden creada
SELECT * FROM orders WHERE id = X;

-- Ver items de la orden
SELECT * FROM order_items WHERE order_id = X;
```

#### 5.4 Confirm Order ⭐⭐⭐ CONFIRMAR PAGO Y GENERAR TICKETS
**Endpoint:** `POST /orders/{{order_id}}/confirm`

**Sin body (solo autenticación requerida)**

**Validaciones:**
- ✅ Status: 200
- ✅ Response contiene:
  - `order` con status "confirmed"
  - `tickets` (array de tickets generados)
  - Cada ticket tiene `code` único
  - Si hay asientos asignados, cada ticket tiene `seat_id`
  - `message`: "Orden confirmada exitosamente"

**¿Qué pasa internamente? (FLUJO COMPLEJO)**
> 1. Verifica que la orden exista y esté en "pending"
> 2. **Simula pago:** Crea registro en tabla `payments` con status "captured"
> 3. **Cambia status de orden:** "pending" → "confirmed"
> 4. **Genera tickets:**
>    - Crea N tickets (donde N = quantity)
>    - Cada ticket tiene código único: `TKT-{orderId}-{ticketNum}-{timestamp}-{random}`
>    - Status de tickets: "issued"
> 5. **Asigna asientos (si aplica):**
>    - Obtiene asientos "reserved" de la sección
>    - Asigna cada asiento a un ticket
>    - Cambia status de asientos: "reserved" → "occupied"
> 6. **Confirma reserva:** status "held" → "confirmed"

**Verificación en BD:**
```sql
-- Ver orden confirmada
SELECT * FROM orders WHERE id = X;

-- Ver pago registrado
SELECT * FROM payments WHERE order_id = X;

-- Ver tickets generados
SELECT id, code, seat_id FROM tickets WHERE order_id = X;

-- Ver asientos ocupados
SELECT COUNT(*) FROM concert_seats 
WHERE concert_id = X AND status_id = (
  SELECT id FROM status_generales 
  WHERE dominio='seat' AND descripcion='occupied'
);

-- Ver reserva confirmada
SELECT * FROM reservations WHERE concert_id = X;
```

**Ejemplo de respuesta:**
```json
{
  "order": {
    "id": 1,
    "user_id": 1,
    "concert_id": 1,
    "status": {
      "descripcion": "confirmed"
    },
    "total": 1000,
    "tickets": [
      {"id": 1, "code": "TKT-1-1-ABC123"},
      {"id": 2, "code": "TKT-1-2-ABC124"}
    ]
  },
  "tickets": [
    {
      "id": 1,
      "order_id": 1,
      "ticket_type_id": 1,
      "seat_id": 15,
      "code": "TKT-1-1-ABC123",
      "status_id": 10
    },
    {
      "id": 2,
      "order_id": 1,
      "ticket_type_id": 1,
      "seat_id": 16,
      "code": "TKT-1-2-ABC124",
      "status_id": 10
    }
  ],
  "message": "Orden confirmada exitosamente"
}
```

---

### FASE 6: Post-Compra y Notificaciones 📧

#### 6.1 Get User Orders
**Endpoint:** `GET /orders/user/{{user_id}}`

**Validaciones:**
- ✅ Status: 200
- ✅ Response es array de órdenes del usuario
- ✅ Cada orden incluye:
  - `concert` (título y fecha)
  - `status` (descripción)
  - `tickets` (array de códigos)

#### 6.2 Get Order By ID
**Endpoint:** `GET /orders/{{order_id}}`

**Validaciones:**
- ✅ Status: 200
- ✅ Response incluye:
  - Datos completos de la orden
  - `user` (nombre y email)
  - `concert` (título y fecha)
  - `items` (detalles de productos comprados)
  - `tickets` (con códigos y seat_id)
  - `payment` (datos del pago)

**Este endpoint es útil para:**
> Mostrar al usuario el detalle completo de su compra, incluyendo los tickets que puede imprimir o descargar.

#### 6.3 Send Tickets Email
**Endpoint:** `POST /orders/{{order_id}}/send-tickets`

**Sin body (solo autenticación requerida)**

**Validaciones:**
- ✅ Status: 200
- ✅ Response contiene:
  - `success: true`
  - `notification` (registro de envío)
  - `message` con email del destinatario

**¿Qué pasa internamente?**
> 1. Obtiene datos de la orden (usuario, concierto, tickets)
> 2. (En implementación completa) Genera PDF con los tickets
> 3. (En implementación completa) Envía email con PDF adjunto
> 4. Registra notificación en BD con status "sent" o "failed"

**Nota:**
> La implementación actual registra la notificación pero no envía email real. Debes implementar:
> - `emailTransporter.js` con configuración de SMTP
> - `pdfGenerator.js` para generar PDF de tickets
> - `emailTemplates.js` con plantillas HTML

#### 6.4 Send Confirmation Email
**Endpoint:** `POST /orders/{{order_id}}/send-confirmation`

**Sin body (solo autenticación requerida)**

**Validaciones:**
- ✅ Status: 200
- ✅ Response similar a 6.3

**Diferencia con 6.3:**
> - 6.3 envía los tickets (PDF adjunto)
> - 6.4 envía confirmación de compra (resumen de orden)

---

### FASE 7: Reportes y Administración 📊

#### 7.1 Get All Orders (Admin)
**Endpoint:** `GET /admin/orders`

**Validaciones:**
- ✅ Status: 200
- ✅ Response incluye:
  - Array de todas las órdenes
  - Cada orden con `user`, `concert`, `status`
  - `pagination` (total, page, totalPages)

**Query params opcionales:**
- `page`: Número de página (default: 1)
- `limit`: Items por página (default: 20)

#### 7.2 Get Sales by Concert (Admin)
**Endpoint:** `GET /admin/concerts/{{concert_id}}/sales`

**Validaciones:**
- ✅ Status: 200
- ✅ Response incluye:
  - `concert_id`
  - `total_orders`: Total de órdenes confirmadas
  - `total_tickets`: Total de tickets vendidos
  - `total_revenue`: Suma de ingresos
  - `orders`: Array detallado de cada orden

**Ejemplo de respuesta:**
```json
{
  "concert_id": 1,
  "total_orders": 5,
  "total_tickets": 12,
  "total_revenue": 6000,
  "orders": [
    {
      "id": 1,
      "user": {
        "id": 2,
        "name": "Juan Pérez",
        "email": "juan@example.com"
      },
      "total": 1000,
      "tickets_count": 2,
      "items": [
        {
          "ticketType": {
            "name": "VIP - Rock Fest",
            "price": 500
          }
        }
      ],
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

**Utilidad:**
> Dashboard de ventas por concierto para análisis financiero y de audiencia.

---

## 🎭 Escenarios de Prueba

### Escenario 1: Flujo Feliz Completo ✅

**Objetivo:** Usuario compra tickets exitosamente

**Pasos:**
1. ✅ Login como admin → Obtiene token
2. ✅ Crear concierto con venue existente → concert_id
3. ✅ Crear tipo de ticket → ticket_type_id
4. ✅ Login como usuario regular (o usar mismo admin)
5. ✅ Crear reserva → reservation_id
6. ✅ Crear orden → order_id
7. ✅ Confirmar orden → Tickets generados
8. ✅ Enviar tickets por email
9. ✅ Verificar orden en "Get User Orders"

**Resultado esperado:**
- Orden confirmada con status "confirmed"
- Tickets generados con códigos únicos
- Asientos asignados (si aplica)
- Notificación registrada

---

### Escenario 2: Reserva Expirada ⏰

**Objetivo:** Probar que las reservas expiran correctamente

**Pasos:**
1. ✅ Crear reserva normal
2. ⏳ Esperar 16 minutos (o cambiar manualmente `expires_at` en BD)
3. ❌ Intentar crear orden con reserva expirada
4. ✅ Ejecutar "Release Expired Reservations"
5. ✅ Verificar que:
   - Reserva cambió a status "expired"
   - Disponibilidad de tickets se restauró
   - Asientos liberados (status vuelve a "available")

**Resultado esperado:**
- Error al crear orden: "La reserva ha expirado"
- Después de liberar: Tickets disponibles nuevamente

**Verificación en BD:**
```sql
-- Forzar expiración (para testing rápido)
UPDATE reservations 
SET expires_at = NOW() - INTERVAL '1 minute' 
WHERE id = X;

-- Verificar expiración
SELECT * FROM reservations WHERE id = X;

-- Verificar tickets disponibles restaurados
SELECT available FROM ticket_types WHERE id = X;
```

---

### Escenario 3: Traslape de Horarios 🚫

**Objetivo:** Probar validación de traslape de conciertos

**Pasos:**
1. ✅ Crear concierto en venue 1, fecha: 2025-12-15 20:00
2. ❌ Intentar crear otro concierto en venue 1, fecha: 2025-12-15 21:00
   (Dentro de 4 horas del primero)
3. ✅ Verificar error de traslape

**Resultado esperado:**
- Error 400: "Traslape de horario detectado con el concierto..."

**Casos válidos:**
- Mismo venue, diferencia > 4 horas: ✅ Permitido
- Diferente venue, misma hora: ✅ Permitido

---

### Escenario 4: Sin Disponibilidad 📉

**Objetivo:** Probar manejo de tickets agotados

**Pasos:**
1. ✅ Crear ticket type con `available: 2`
2. ✅ Crear reserva de 2 tickets → Éxito
3. ❌ Intentar crear otra reserva de 1 ticket
4. ✅ Verificar error de disponibilidad

**Resultado esperado:**
- Error: "Solo hay 0 tickets disponibles"

---

### Escenario 5: Múltiples Usuarios 👥

**Objetivo:** Probar concurrencia básica

**Pasos:**
1. ✅ Crear 2 usuarios diferentes
2. ✅ Ambos intentan reservar los últimos 5 tickets
3. ✅ Primero que ejecute reserva → Éxito
4. ❌ Segundo que ejecute reserva → Error de disponibilidad

**Resultado esperado:**
- Solo un usuario logra reservar
- Sistema maneja correctamente la concurrencia

---

## ✅ Validaciones por Endpoint

### Validaciones Generales (Todos los Endpoints)

| Validación | Esperado |
|------------|----------|
| **Headers** | `Content-Type: application/json` |
| **Auth** | `Authorization: Bearer {{auth_token}}` (excepto login/register) |
| **Response** | JSON válido |
| **Errores** | `{ "message": "..." }` |

### Validaciones Específicas

#### POST /auth/login
- ✅ Token es string no vacío
- ✅ Token tiene formato JWT (3 partes separadas por puntos)
- ✅ User contiene `id`, `name`, `email`, `role`

#### POST /admin/concerts
- ✅ `concert_id` es número entero
- ✅ Concierto tiene relación con venue
- ✅ En BD: `concert_seats` creados = total asientos del venue
- ✅ Fecha del concierto es futura

#### POST /tickets/reserve
- ✅ `expires_at` es 15 minutos después de `created_at`
- ✅ `available` del ticket type se redujo por `quantity`
- ✅ Si hay `section_id`, asientos marcados como "reserved"

#### POST /orders/{{order_id}}/confirm
- ✅ Tickets generados = `quantity` especificada
- ✅ Cada `code` es único en toda la tabla
- ✅ Status de orden: "confirmed"
- ✅ Existe registro en `payments`
- ✅ Si hay asientos, cada ticket tiene `seat_id` asignado
- ✅ Asientos cambiaron a "occupied"

---

## 🐛 Troubleshooting

### Error: "Token inválido o expirado"

**Causa:** Token expiró o no se está enviando correctamente

**Solución:**
1. Ejecutar nuevamente "Login Admin"
2. Verificar que `{{auth_token}}` tenga valor en environment
3. Verificar que el header `Authorization` esté presente

---

### Error: "Venue no encontrado"

**Causa:** El `venue_id` no existe en BD

**Solución:**
```sql
-- Ver venues disponibles
SELECT * FROM venues;

-- Usar un ID existente o crear uno nuevo
```

---

### Error: "Traslape de horario detectado"

**Causa:** Ya existe concierto en ese venue dentro de ±4 horas

**Solución:**
- Usar fecha diferente (> 4 horas de diferencia)
- Usar venue diferente
- Eliminar concierto conflictivo

---

### Error: "Solo hay 0 tickets disponibles"

**Causa:** Tickets agotados o reservas no liberadas

**Solución:**
1. Ejecutar "Release Expired Reservations"
2. Verificar `available` del ticket type:
```sql
   SELECT available FROM ticket_types WHERE id = X;
```
3. Si es 0, actualizar manualmente:
```sql
   UPDATE ticket_types SET available = 100 WHERE id = X;
```

---

### Error: "La reserva ha expirado"

**Causa:** Pasaron más de 15 minutos desde la reserva

**Solución:**
1. Crear nueva reserva
2. Confirmar orden dentro de 15 minutos
3. Para testing: Extender tiempo de expiración en código

---

### Error de Conexión a Servicio

**Causa:** Servicio no está corriendo

**Solución:**
1. Verificar que todos los servicios estén activos:
```bash
   # Revisar procesos de Node
   ps aux | grep node
   
   # O verificar puertos
   lsof -i :3000
   lsof -i :3001
   # ... etc
```

2. Reiniciar servicio problemático:
```bash
   cd services/XXX-service
   npm start
```

---

### Variables de Environment No Se Actualizan

**Causa:** Postman no ejecutó el script de test

**Solución:**
1. En cada request, ir a tab "Tests"
2. Verificar que exista código como:
```javascript
   pm.environment.set('concert_id', jsonData.concert.id);
```
3. Ejecutar request
4. Verificar en Environment que la variable tenga valor

---

## 📊 Checklist Final

### Antes de Empezar
- [ ] PostgreSQL corriendo
- [ ] Base de datos `ticketapp` creada
- [ ] `schema.sql` ejecutado
- [ ] Todos los servicios corriendo (6 puertos)
- [ ] Colección importada en Postman
- [ ] Environment configurado

### Flujo Completo
- [ ] Login exitoso (token obtenido)
- [ ] Concierto creado con venue
- [ ] Ticket type creado
- [ ] Reserva creada (expira en 15 min)
- [ ] Orden creada (status pending)
- [ ] Orden confirmada (tickets generados)
- [ ] Notificaciones enviadas
- [ ] Reportes funcionando

### Validaciones en BD
- [ ] `concert_seats` creados para el concierto
- [ ] `tickets` generados con códigos únicos
- [ ] `payments` registrado
- [ ] `reservations` confirmada
- [ ] Asientos en status "occupied"

---

## 🎉 ¡Felicidades!

Si llegaste aquí y todos los checks están verdes, tu aplicación está funcionando correctamente con:

✅ Sequelize ORM 100%
✅ Sin queries SQL quemadas
✅ Relaciones bien definidas
✅ Transacciones correctas
✅ Flujo completo de reserva → orden → tickets

---

## 📞 Soporte

Si encuentras algún problema no cubierto en esta guía:
1. Revisar logs de cada servicio
2. Verificar BD directamente con queries SQL
3. Usar Postman Console para ver requests/responses completos
4. Revisar que environment variables estén correctas

**Happy Testing!** 🚀