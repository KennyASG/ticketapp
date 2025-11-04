# 🎯 GUÍA DE TESTING REAL - TicketApp Microservicios

## 📋 ÍNDICE
1. [Requisitos Previos](#requisitos-previos)
2. [Arquitectura de Microservicios](#arquitectura-de-microservicios)
3. [Configuración de Postman](#configuración-de-postman)
4. [Flujo de Testing Completo](#flujo-de-testing-completo)
5. [Endpoints por Servicio](#endpoints-por-servicio)
6. [Escenarios de Prueba](#escenarios-de-prueba)
7. [Verificación de Base de Datos](#verificación-de-base-de-datos)
8. [Troubleshooting](#troubleshooting)

---

## ✅ REQUISITOS PREVIOS

### Software Necesario
```bash
✅ PostgreSQL 13+ corriendo
✅ Node.js 16+ instalado
✅ Postman instalado
✅ Base de datos 'ticketapp' creada
✅ schema.sql ejecutado
```

### Servicios Activos

Todos los microservicios deben estar corriendo:

```bash
# Terminal 1 - Auth Service
cd auth-service
npm install
npm start
# Corre en puerto 3001

# Terminal 2 - Venue Service  
cd venue-service
npm install
npm start
# Corre en puerto 3002

# Terminal 3 - Ticket Service
cd ticket-service
npm install
npm start
# Corre en puerto 3003

# Terminal 4 - Concert Service
cd concert-service
npm install
npm start  
# Corre en puerto 3001 (mismo que auth, diferentes rutas)

# Terminal 5 - Order Service
cd order-service
npm install
npm start
# Corre en puerto 3004

# Terminal 6 - Notification Service
cd notification-service
npm install
npm start
# Corre en puerto 3005
```

### Verificar que los servicios están corriendo

```bash
# Auth Service
curl http://localhost:3001/auth/login
# Debe responder con error (falta body)

# Venue Service  
curl http://localhost:3002/venue/venues
# Debe responder con [] o lista de venues

# Ticket Service
curl http://localhost:3003/concert/1/ticket-types  
# Debe responder con [] o lista de ticket types

# Order Service
curl http://localhost:3004/order/admin/orders
# Debe responder con error de autenticación

# Notification Service
curl http://localhost:3005/notification/notifications
# Debe responder con error de autenticación
```

---

## 🏗️ ARQUITECTURA DE MICROSERVICIOS

### Puertos y Base Paths

| Servicio | Puerto | Base Path | Descripción |
|----------|--------|-----------|-------------|
| Auth | 3001 | `/auth` | Autenticación y usuarios |
| Concert | 3001 | `/concert` | Gestión de conciertos |
| Venue | 3002 | `/venue` | Gestión de venues y secciones |
| Ticket | 3003 | `/` | Tickets, tipos y reservas |
| Order | 3004 | `/order` | Órdenes y pagos |
| Notification | 3005 | `/notification` | Notificaciones por email |

### Variables de Entorno (.env)

Cada servicio debe tener su `.env`:

```env
# Común para todos
DATABASE_URL=postgresql://usuario:password@localhost:5432/ticketapp
JWT_SECRET=supersecret

# Específico por servicio
PORT=300X  # Según el servicio
```

---

## ⚙️ CONFIGURACIÓN DE POSTMAN

### Paso 1: Importar Colección

1. Abre Postman
2. Click en **Import**
3. Selecciona `TicketApp-Real-Collection.json`
4. Click en **Import**

### Paso 2: Crear Environment

1. Click en **Environments** (⚙️)
2. Click en **+** (Create Environment)
3. Nombre: `TicketApp Local`
4. Agregar variables:

| Variable | Initial Value | Type |
|----------|---------------|------|
| `auth_service` | `http://localhost:3001` | default |
| `concert_service` | `http://localhost:3001` | default |
| `venue_service` | `http://localhost:3002` | default |
| `ticket_service` | `http://localhost:3003` | default |
| `order_service` | `http://localhost:3004` | default |
| `notification_service` | `http://localhost:3005` | default |
| `auth_token` | (vacío) | secret |
| `user_id` | (vacío) | default |
| `venue_id` | `1` | default |
| `section_id` | (vacío) | default |
| `concert_id` | (vacío) | default |
| `ticket_type_id` | (vacío) | default |
| `reservation_id` | (vacío) | default |
| `order_id` | (vacío) | default |

5. Click en **Save**
6. Selecciona el environment en el dropdown superior derecho

---

## 🎯 FLUJO DE TESTING COMPLETO

### Diagrama del Flujo

```
┌────────────────────────────────────────────────────────────┐
│                  FLUJO COMPLETO DE TESTING                 │
└────────────────────────────────────────────────────────────┘

FASE 1: AUTENTICACIÓN (Auth Service - Puerto 3001)
├─► 1.2 Login Admin ──────────► Obtiene TOKEN
└─► Variables: auth_token, user_id

FASE 2: SETUP VENUES (Venue Service - Puerto 3002)
├─► 2.1 Get All Venues ───────► Obtiene venue_id
├─► 2.3 Get Venue Sections ───► Obtiene section_id
└─► Variables: venue_id, section_id

FASE 3: CREAR CONCIERTO (Concert Service - Puerto 3001)
├─► 3.3 Create Concert ───────► Crea concierto
└─► Variables: concert_id

FASE 4: TIPOS DE TICKETS (Ticket Service - Puerto 3003)
├─► 4.2 Create Ticket Type ───► Define precio y disponibilidad
└─► Variables: ticket_type_id

FASE 5: RESERVA (Ticket Service - Puerto 3003)
├─► 4.5 Create Reservation ───► Reserva temporal (5 min)
└─► Variables: reservation_id

FASE 6: ORDEN (Order Service - Puerto 3004)
├─► 5.1 Create Order ─────────► Orden status pending
├─► 5.2 Confirm Order ────────► Genera tickets
└─► Variables: order_id

FASE 7: NOTIFICACIONES (Notification Service - Puerto 3005)
├─► 6.1 Send Tickets Email
└─► 6.2 Send Confirmation
```

---

## 📖 ENDPOINTS POR SERVICIO

### 1. AUTH SERVICE (Puerto 3001)

#### Base Path: `/auth`

**1.2 Login Admin** ⭐ **EMPEZAR AQUÍ**

```http
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@example.com",
    "role_id": 1
  }
}
```

**Variables guardadas automáticamente:**
- `auth_token`: Token JWT para autenticación
- `user_id`: ID del usuario

**Verificación:**
```sql
SELECT * FROM users WHERE email = 'admin@example.com';
```

---

**1.1 Register User**

```http
POST http://localhost:3001/auth/register
Content-Type: application/json

{
  "name": "Usuario Test",
  "email": "test@example.com",
  "password": "password123",
  "role_id": 2
}
```

---

**1.3 Get All Users (Admin)**

```http
GET http://localhost:3001/auth/admin/users
Authorization: Bearer {{auth_token}}
```

---

### 2. VENUE SERVICE (Puerto 3002)

#### Base Path: `/venue`

**2.1 Get All Venues**

```http
GET http://localhost:3002/venue/venues
Authorization: Bearer {{auth_token}}
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Arena Central",
    "address": "Av. Principal 123",
    "city": "Ciudad de Guatemala",
    "country": "Guatemala",
    "sections": [
      {
        "id": 1,
        "name": "VIP",
        "capacity": 100
      }
    ]
  }
]
```

**Variables guardadas:**
- `venue_id`: ID del primer venue encontrado

---

**2.3 Get Venue Sections**

```http
GET http://localhost:3002/venue/{{venue_id}}/sections
Authorization: Bearer {{auth_token}}
```

**Response:**
```json
[
  {
    "id": 1,
    "venue_id": 1,
    "name": "VIP",
    "capacity": 100,
    "seats": [
      {"id": 1, "seat_number": 1},
      {"id": 2, "seat_number": 2}
    ]
  }
]
```

**Variables guardadas:**
- `section_id`: ID de la primera sección

**Verificación:**
```sql
-- Ver secciones del venue
SELECT * FROM venue_sections WHERE venue_id = 1;

-- Ver asientos de la sección
SELECT COUNT(*) as total_asientos 
FROM seats 
WHERE section_id = 1;
```

---

**2.4 Create Venue (Admin)**

```http
POST http://localhost:3002/venue/admin/venue
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "name": "Arena Central",
  "address": "Av. Principal 123",
  "city": "Ciudad de Guatemala",
  "country": "Guatemala"
}
```

---

**2.7 Create Section (Admin)**

```http
POST http://localhost:3002/venue/admin/venue/{{venue_id}}/section
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "name": "VIP",
  "capacity": 100
}
```

**Response:**
```json
{
  "message": "Sección creada exitosamente",
  "section": {
    "id": 1,
    "venue_id": 1,
    "name": "VIP",
    "capacity": 100
  },
  "seatsCreated": 100
}
```

**¿Qué pasa internamente?**
1. Crea la sección en `venue_sections`
2. Crea 100 registros en `seats` con `seat_number` 1-100
3. Asocia los asientos a la sección

---

### 3. CONCERT SERVICE (Puerto 3001)

#### Base Path: `/concert`

**3.1 Get All Concerts**

```http
GET http://localhost:3001/concert/concerts
Authorization: Bearer {{auth_token}}
```

---

**3.3 Create Concert (Admin)** ⭐

```http
POST http://localhost:3001/concert/admin/concert
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "title": "Rock Fest 2025",
  "description": "El mejor festival de rock del año",
  "date": "2025-12-15T20:00:00.000Z",
  "venue_id": 1
}
```

**Response:**
```json
{
  "message": "Concierto creado exitosamente",
  "concert": {
    "id": 1,
    "title": "Rock Fest 2025",
    "description": "El mejor festival de rock del año",
    "date": "2025-12-15T20:00:00.000Z"
  }
}
```

**Variables guardadas:**
- `concert_id`: ID del concierto creado

**¿Qué pasa internamente?**
1. Valida que el venue exista
2. Valida traslape de horarios (±4 horas en el mismo venue)
3. Crea el concierto en `concerts`
4. Crea relación en `concert_venue_detail`
5. Crea `concert_seats` para TODOS los asientos del venue

**Verificación:**
```sql
-- Ver concierto creado
SELECT * FROM concerts WHERE id = 1;

-- Ver relación con venue
SELECT * FROM concert_venue_detail WHERE concert_id = 1;

-- Ver concert_seats creados
SELECT COUNT(*) FROM concert_seats WHERE concert_id = 1;
-- Debe ser igual a la suma de asientos de todas las secciones
```

---

**3.2 Get Concert By ID**

```http
GET http://localhost:3001/concert/{{concert_id}}
Authorization: Bearer {{auth_token}}
```

---

### 4. TICKET SERVICE (Puerto 3003)

#### Base Path: `/` (directamente)

**4.1 Get Ticket Types by Concert**

```http
GET http://localhost:3003/concert/{{concert_id}}/ticket-types
```

---

**4.2 Create Ticket Type (Admin)** ⭐

```http
POST http://localhost:3003/admin/concert/{{concert_id}}/ticket-type
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "section_id": 1,
  "name": "VIP",
  "price": 500,
  "available": 50
}
```

**Response:**
```json
{
  "message": "Tipo de ticket creado exitosamente",
  "ticketType": {
    "id": 1,
    "concert_id": 1,
    "section_id": 1,
    "name": "VIP",
    "price": 500,
    "available": 50
  }
}
```

**Variables guardadas:**
- `ticket_type_id`: ID del tipo de ticket

**Campos importantes:**
- `section_id`: Sección del venue (puede ser `null` para general)
- `price`: Precio en entero (ej: 500)
- `available`: Cantidad de tickets para vender

**Verificación:**
```sql
SELECT * FROM ticket_types WHERE concert_id = 1;
```

---

**4.5 Create Reservation** ⭐⭐

```http
POST http://localhost:3003/ticket/reserve
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "concert_id": 1,
  "ticket_type_id": 1,
  "quantity": 2
}
```

**Response:**
```json
{
  "message": "Reserva creada. Expira en 5 minutos.",
  "reservation": {
    "id": 1,
    "user_id": 1,
    "concert_id": 1,
    "status_id": 10,
    "expires_at": "2025-10-24T16:00:00.000Z"
  },
  "quantity": 2,
  "seats": [
    {"seat_id": 1, "seat_number": 1},
    {"seat_id": 2, "seat_number": 2}
  ]
}
```

**Variables guardadas:**
- `reservation_id`: ID de la reserva

**¿Qué pasa internamente?**
1. Valida que el usuario no tenga más de 5 asientos reservados
2. Verifica disponibilidad del ticket type
3. Selecciona asientos disponibles de la sección
4. Crea reserva con `expires_at` = NOW() + 5 minutos
5. Crea `reservation_seats` para cada asiento
6. Actualiza `concert_seats` status → "reserved"
7. Reduce `available` del ticket type
8. **TODO**: Publica mensaje en RabbitMQ (reserva)

**Verificación:**
```sql
-- Ver reserva
SELECT * FROM reservations WHERE id = 1;

-- Ver asientos reservados
SELECT * FROM reservation_seats WHERE reservation_id = 1;

-- Ver concert_seats marcados como reserved
SELECT cs.*, s.seat_number, sg.descripcion
FROM concert_seats cs
JOIN seats s ON s.id = cs.seat_id
JOIN status_generales sg ON sg.id = cs.status_id
WHERE cs.concert_id = 1 
  AND sg.descripcion = 'reserved';

-- Ver disponibilidad reducida
SELECT available FROM ticket_types WHERE id = 1;
```

---

**4.6 Get User Reservations**

```http
GET http://localhost:3003/ticket/reservations
Authorization: Bearer {{auth_token}}
```

---

**4.7 Release Expired Reservations (Admin)**

```http
POST http://localhost:3003/admin/tickets/release-expired
Authorization: Bearer {{auth_token}}
```

**Response:**
```json
{
  "message": "3 reservas expiradas liberadas",
  "released_reservations": 3
}
```

**¿Qué hace?**
1. Busca reservas con `expires_at < NOW()` y status "held"
2. Actualiza `concert_seats` status → "available"
3. Actualiza reserva status → "expired"
4. Elimina `reservation_seats`
5. Restaura `available` del ticket type

---

### 5. ORDER SERVICE (Puerto 3004)

#### Base Path: `/order`

**5.1 Create Order** ⭐

```http
POST http://localhost:3004/order/
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "reservation_id": 1,
  "ticket_type_id": 1,
  "quantity": 2
}
```

**Response:**
```json
{
  "message": "Orden creada. Procede a confirmar el pago.",
  "order": {
    "id": 1,
    "user_id": 1,
    "concert_id": 1,
    "reservation_id": 1,
    "status_id": 15,
    "total": 1000
  },
  "total": 1000
}
```

**Variables guardadas:**
- `order_id`: ID de la orden

**¿Qué pasa internamente?**
1. Valida que la reserva existe y no ha expirado
2. Valida que pertenece al usuario autenticado
3. Calcula total (precio × cantidad)
4. Crea orden con status "pending"
5. Crea `order_items` con los detalles
6. Copia `reservation_seats` → `order_seats`
7. **TODO**: Publica mensaje en RabbitMQ (carrito)

**Verificación:**
```sql
-- Ver orden creada
SELECT * FROM orders WHERE id = 1;

-- Ver items
SELECT * FROM order_items WHERE order_id = 1;

-- Ver asientos de la orden
SELECT * FROM order_seats WHERE order_id = 1;
```

---

**5.2 Confirm Order (Payment)** ⭐⭐⭐ **MÁS IMPORTANTE**

```http
POST http://localhost:3004/order/{{order_id}}/confirm
Authorization: Bearer {{auth_token}}
```

**Response:**
```json
{
  "message": "Orden confirmada exitosamente",
  "order": {
    "id": 1,
    "status": {"descripcion": "confirmed"},
    "total": 1000
  },
  "tickets": [
    {
      "id": 1,
      "code": "TCK-1-1-A3F9G2",
      "seat": {"seat_number": 1},
      "status": "issued"
    },
    {
      "id": 2,
      "code": "TCK-1-2-B7H4K8",
      "seat": {"seat_number": 2},
      "status": "issued"
    }
  ],
  "payment": {
    "id": 1,
    "provider": "mock",
    "amount": 1000,
    "status": "captured"
  }
}
```

**¿Qué pasa internamente?** (PROCESO CRÍTICO)
1. Valida que la orden existe y está en "pending"
2. Valida que pertenece al usuario
3. **Inicia transacción**
4. Copia `reservation_seats` → `order_seats`
5. Actualiza `concert_seats` status → **"occupied"** (PERMANENTE)
6. Actualiza orden status → **"confirmed"**
7. **Genera tickets** (uno por asiento)
   - Crea registro en `tickets`
   - Genera código único: `TCK-{orderId}-{index}-{random}`
   - Asigna status "issued"
8. Crea registro de pago simulado en `payments`
   - Provider: "mock"
   - Status: "captured"
9. **TODO**: Consume mensaje de RabbitMQ (carrito)
10. **Commit transacción**

**Verificación:**
```sql
-- Orden confirmada
SELECT o.*, sg.descripcion as status
FROM orders o
JOIN status_generales sg ON sg.id = o.status_id
WHERE o.id = 1;
-- status debe ser 'confirmed'

-- Tickets generados
SELECT * FROM tickets WHERE order_id = 1;
-- Debe haber 2 tickets con códigos únicos

-- Asientos ocupados
SELECT cs.*, s.seat_number, sg.descripcion
FROM concert_seats cs
JOIN seats s ON s.id = cs.seat_id
JOIN status_generales sg ON sg.id = cs.status_id
WHERE cs.id IN (
  SELECT concert_seat_id FROM order_seats WHERE order_id = 1
);
-- status debe ser 'occupied'

-- Pago registrado
SELECT * FROM payments WHERE order_id = 1;
-- provider='mock', status='captured'
```

---

**5.3 Get Order By ID**

```http
GET http://localhost:3004/order/{{order_id}}
Authorization: Bearer {{auth_token}}
```

---

**5.4 Get User Orders**

```http
GET http://localhost:3004/order/orders/user/{{user_id}}
Authorization: Bearer {{auth_token}}
```

---

**5.5 Get All Orders (Admin)**

```http
GET http://localhost:3004/order/admin/orders
Authorization: Bearer {{auth_token}}
```

---

**5.6 Get Sales by Concert (Admin)**

```http
GET http://localhost:3004/order/admin/concert/{{concert_id}}/sales
Authorization: Bearer {{auth_token}}
```

---

### 6. NOTIFICATION SERVICE (Puerto 3005)

#### Base Path: `/notification`

**6.1 Send Tickets Email**

```http
POST http://localhost:3005/notification/order/{{order_id}}/send-tickets
Authorization: Bearer {{auth_token}}
```

---

**6.2 Send Confirmation Email**

```http
POST http://localhost:3005/notification/order/{{order_id}}/send-confirmation
Authorization: Bearer {{auth_token}}
```

---

**6.3 Get Notifications**

```http
GET http://localhost:3005/notification/notifications
Authorization: Bearer {{auth_token}}
```

---

## 🧪 ESCENARIOS DE PRUEBA

### Escenario 1: Flujo Feliz Completo ✅

**Objetivo:** Compra exitosa de tickets de principio a fin

**Secuencia:**
```
1. Login Admin (1.2)
2. Get All Venues (2.1)
3. Get Venue Sections (2.3)
4. Create Concert (3.3)
5. Create Ticket Type (4.2)
6. Create Reservation (4.5)
7. Create Order (5.1)
8. Confirm Order (5.2)
9. Get Order By ID (5.3)
10. Send Tickets Email (6.1)
```

**Resultado esperado:**
- ✅ Todos los endpoints responden 200/201
- ✅ Tickets generados con códigos únicos
- ✅ Asientos marcados como "occupied"
- ✅ Pago registrado como "captured"

---

### Escenario 2: Reserva Expirada ⏰

**Objetivo:** Probar liberación de reservas expiradas

**Pasos:**
1. Create Reservation (4.5)
2. Esperar 6 minutos O ejecutar:
   ```sql
   UPDATE reservations 
   SET expires_at = NOW() - INTERVAL '1 minute' 
   WHERE id = 1;
   ```
3. Release Expired Reservations (4.7)
4. Verificar:
   - Reserva status → "expired"
   - Asientos → "available"
   - Ticket type available restaurado

---

### Escenario 3: Sin Disponibilidad 📉

**Objetivo:** Probar manejo de tickets agotados

**Pasos:**
1. Create Ticket Type con `available: 2`
2. Create Reservation de 2 tickets → ✅ Éxito
3. Create Reservation de 1 ticket → ❌ Error
4. Verificar mensaje: "Solo hay 0 tickets disponibles"

---

### Escenario 4: Traslape de Horarios 🚫

**Objetivo:** Validar traslape de conciertos

**Pasos:**
1. Create Concert: fecha 2025-12-15 20:00, venue 1 → ✅
2. Create Concert: fecha 2025-12-15 21:30, venue 1 → ❌
3. Verificar error: "Traslape de horario detectado"

**Regla:** ±4 horas en el mismo venue

---

### Escenario 5: Límite de 5 Reservas 🚫

**Objetivo:** Validar límite de asientos por usuario

**Pasos:**
1. Create Reservation: 2 tickets → Total: 2
2. Create Reservation: 2 tickets → Total: 4  
3. Create Reservation: 2 tickets → ❌ Error
4. Verificar: "Tienes 4 asientos reservados. Máximo: 5"

---

## 🔍 VERIFICACIÓN DE BASE DE DATOS

### Ver estructura completa

```sql
-- Ver todas las tablas
\dt

-- Ver usuarios
SELECT * FROM users;

-- Ver roles
SELECT * FROM roles;

-- Ver status
SELECT dominio, descripcion FROM status_generales ORDER BY dominio;

-- Ver venues con secciones
SELECT v.*, COUNT(vs.id) as total_secciones
FROM venues v
LEFT JOIN venue_sections vs ON vs.venue_id = v.id
GROUP BY v.id;

-- Ver conciertos con venues
SELECT c.*, v.name as venue_name
FROM concerts c
JOIN concert_venue_detail cvd ON cvd.concert_id = c.id
JOIN venues v ON v.id = cvd.venue_id;
```

### Verificar reserva activa

```sql
SELECT 
  r.id,
  r.expires_at,
  sg.descripcion as status,
  u.email,
  c.title as concert,
  COUNT(rs.id) as asientos
FROM reservations r
JOIN status_generales sg ON sg.id = r.status_id
JOIN users u ON u.id = r.user_id
JOIN concerts c ON c.id = r.concert_id
LEFT JOIN reservation_seats rs ON rs.reservation_id = r.id
WHERE r.id = 1
GROUP BY r.id, r.expires_at, sg.descripcion, u.email, c.title;
```

### Verificar orden confirmada

```sql
SELECT 
  o.id,
  o.total,
  sg.descripcion as status,
  COUNT(DISTINCT t.id) as tickets_generados,
  p.provider,
  p.amount as pago
FROM orders o
JOIN status_generales sg ON sg.id = o.status_id
LEFT JOIN tickets t ON t.order_id = o.id
LEFT JOIN payments p ON p.order_id = o.id
WHERE o.id = 1
GROUP BY o.id, o.total, sg.descripcion, p.provider, p.amount;
```

---

## 🐛 TROUBLESHOOTING

### Error: "Token inválido o expirado"

**Solución:**
1. Re-ejecutar Login Admin (1.2)
2. Verificar que se guardó: `{{auth_token}}` en Postman
3. Verificar header: `Authorization: Bearer {{auth_token}}`

---

### Error: "Solo hay 0 tickets disponibles"

**Causas:**
1. Reservas no liberadas
2. Tickets agotados

**Solución:**
```
1. Ejecutar Release Expired Reservations (4.7)
2. Verificar: SELECT available FROM ticket_types WHERE id = X;
```

---

### Error: "Traslape de horario detectado"

**Solución:**
- Cambiar fecha (>4 horas de diferencia)
- Usar otro venue
- Eliminar concierto conflictivo

---

### Concert seats no se crearon

**Verificación:**
```sql
SELECT COUNT(*) FROM concert_seats WHERE concert_id = 1;
```

**Causa:** Venue sin secciones/asientos

**Solución:**
1. Create Section (2.7) para el venue
2. Volver a crear el concierto

---

### Orden no genera tickets

**Verificación:**
```sql
SELECT * FROM tickets WHERE order_id = 1;
```

**Causa:** Error en la transacción

**Solución:**
1. Ver logs del servidor
2. Verificar status_generales tiene dominios: ticket, payment
3. Reintentar confirmación

---

## ✅ CHECKLIST FINAL

Antes de dar por completado:

**Base de Datos:**
- [ ] Usuario admin existe
- [ ] Al menos 1 venue con secciones
- [ ] Asientos creados para las secciones
- [ ] Status_generales poblado

**Servicios:**
- [ ] Todos los 6 servicios corriendo
- [ ] Conexión a BD funcionando
- [ ] Sin errores en logs

**Flujo:**
- [ ] Login funciona
- [ ] Crear concierto genera concert_seats
- [ ] Crear tipo de ticket exitoso
- [ ] Reserva crea reservation_seats
- [ ] Confirmar orden genera tickets
- [ ] Códigos de tickets únicos

---

## 📞 AYUDA ADICIONAL

**Ver logs de servicios:**
```bash
# En cada terminal donde corre el servicio
# Los errores aparecerán aquí
```

**Reiniciar base de datos:**
```sql
-- CUIDADO: Borra todo
DROP DATABASE ticketapp;
CREATE DATABASE ticketapp;
\c ticketapp
\i schema.sql
```

**Recursos:**
- GitHub del proyecto
- Documentación de PostgreSQL
- Postman Learning Center

---

🎉 **¡Listo para testing!** Empieza con el endpoint **1.2 Login Admin** y sigue la secuencia.