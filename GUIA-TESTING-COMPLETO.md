# 🎯 GUÍA COMPLETA DE TESTING - TicketApp
## Sistema de Reserva de Tickets para Conciertos con Microservicios

---

## 📋 TABLA DE CONTENIDOS

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación de la Colección](#instalación-de-la-colección)
3. [Configuración Inicial](#configuración-inicial)
4. [Flujo Completo de Testing](#flujo-completo-de-testing)
5. [Guía Endpoint por Endpoint](#guía-endpoint-por-endpoint)
6. [Escenarios de Prueba Avanzados](#escenarios-de-prueba-avanzados)
7. [Verificación de Redis y RabbitMQ](#verificación-de-redis-y-rabbitmq)
8. [Troubleshooting](#troubleshooting)

---

## ✅ REQUISITOS PREVIOS

### 1. Software Necesario

```bash
# Verificar instalaciones
node --version    # >= 16.x
npm --version     # >= 8.x
docker --version  # >= 20.x
psql --version    # >= 13.x
```

### 2. Servicios Corriendo

```bash
# PostgreSQL
docker ps | grep postgres

# Redis
docker ps | grep redis

# RabbitMQ
docker ps | grep rabbitmq
```

### 3. Base de Datos Inicializada

```sql
-- Verificar estructura
\dt

-- Debe mostrar todas las tablas:
-- users, roles, venues, venue_sections, seats
-- concerts, concert_venue_detail, concert_seats
-- ticket_types, reservations, reservation_seats
-- orders, order_items, order_seats
-- tickets, payments, notifications
-- status_generales, password_resets
```

### 4. Datos Iniciales

```sql
-- Verificar usuario admin
SELECT * FROM users WHERE email = 'admin@example.com';

-- Verificar roles
SELECT * FROM roles;

-- Verificar venue de prueba
SELECT * FROM venues LIMIT 1;

-- Verificar status
SELECT dominio, descripcion FROM status_generales;
```

---

## 📥 INSTALACIÓN DE LA COLECCIÓN

### Paso 1: Importar en Postman

1. Abrir Postman Desktop
2. Click en **Import** (esquina superior izquierda)
3. Seleccionar el archivo: `TicketApp_Postman_Collection.json`
4. Click en **Import**

### Paso 2: Crear Environment

1. Click en **Environments** (panel izquierdo)
2. Click en **+** para crear nuevo environment
3. Nombre: `TicketApp Local`
4. Agregar variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| base_url | http://localhost:3000 | http://localhost:3000 |
| auth_token | | |
| user_id | | |
| concert_id | | |
| venue_id | 1 | 1 |
| section_id | | |
| ticket_type_id | | |
| reservation_id | | |
| order_id | | |

5. Click en **Save**
6. Seleccionar el environment en el dropdown superior derecho

---

## ⚙️ CONFIGURACIÓN INICIAL

### 1. Verificar Conectividad

```bash
# Desde terminal
curl http://localhost:3000/health

# Respuesta esperada:
# { "status": "ok", "timestamp": "..." }
```

### 2. Verificar Microservicios

```bash
# Auth Service
curl http://localhost:3001/health

# Concert Service
curl http://localhost:3002/health

# Ticket Service
curl http://localhost:3003/health

# Order Service
curl http://localhost:3004/health

# Notification Service
curl http://localhost:3005/health
```

### 3. Verificar Redis

```bash
# Conectar a Redis
docker exec -it <redis-container> redis-cli

# Dentro de Redis CLI
PING
# Respuesta: PONG

# Verificar cachés
KEYS *
```

### 4. Verificar RabbitMQ

- Abrir navegador: http://localhost:15672
- Login: guest / guest
- Verificar que existan las colas:
  - `RESERVA_QUEUE`
  - `CARRITO_QUEUE`

---

## 🎯 FLUJO COMPLETO DE TESTING

### Diagrama del Flujo

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE TESTING COMPLETO                │
└─────────────────────────────────────────────────────────────┘

FASE 1: AUTENTICACIÓN
├─► 1.2 Login Admin ──────────► Obtiene TOKEN
├─► 1.4 Get Current User ─────► Verifica autenticación
└─► Variables guardadas: auth_token, user_id

FASE 2: SETUP DE INFRAESTRUCTURA (Admin)
├─► 2.1 Get All Venues ───────► Obtiene venue_id existente
├─► 2.3 Get Venue Sections ───► Obtiene section_id
└─► Variables guardadas: venue_id, section_id

FASE 3: CREAR EVENTO (Admin)
├─► 3.2 Create Concert ───────► Crea concert + concert_seats
├─► 3.3 Get Concert By ID ────► Verifica creación
├─► 4.2 Create Ticket Type ───► Define precios y secciones
├─► 4.1 Get Concert Ticket Types ──► Verifica tipos
└─► Variables guardadas: concert_id, ticket_type_id

FASE 4: PROCESO DE COMPRA (Usuario)
├─► 6.1 Create Reservation ───► Reserva temporal (5 min)
│   ├─► Asientos marcados como "reserved"
│   ├─► Mensaje enviado a RabbitMQ (RESERVA_QUEUE)
│   └─► Variables: reservation_id
│
├─► 6.3 Create Order ─────────► Orden con status "pending"
│   ├─► Vincula reserva con orden
│   ├─► Mensaje a RabbitMQ (CARRITO_QUEUE)
│   └─► Variables: order_id
│
└─► 6.4 Confirm Order ────────► Procesa pago
    ├─► Genera tickets con códigos únicos
    ├─► Asientos → "occupied"
    ├─► Crea registro de pago (mock)
    ├─► Consume mensaje de RabbitMQ
    └─► Status orden → "confirmed"

FASE 5: POST-COMPRA
├─► 6.6 Get Order By ID ──────► Ver tickets generados
├─► 7.1 Send Tickets Email ───► Enviar boletos
└─► 7.2 Send Confirmation ────► Confirmación de compra

FASE 6: REPORTES (Admin)
├─► 6.7 Get All Orders
└─► 6.8 Get Sales by Concert
```

---

## 📖 GUÍA ENDPOINT POR ENDPOINT

### FASE 1: AUTENTICACIÓN ⚡

---

#### **1.2 Login Admin** 🔐

**¿Qué hace?**
Autentica al usuario administrador y obtiene el token JWT necesario para todos los endpoints subsiguientes.

**Request:**
```json
POST /auth/login
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response Esperado:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

**Validaciones Automáticas:**
- ✅ Token tiene formato JWT (3 partes)
- ✅ Token se guarda en `{{auth_token}}`
- ✅ User ID se guarda en `{{user_id}}`

**Verificación Manual:**
```javascript
// En Tests de Postman (ya incluido)
pm.test('✅ Token es válido', () => {
    const parts = jsonData.token.split('.');
    pm.expect(parts.length).to.equal(3);
});
```

**⚠️ IMPORTANTE:** Este paso es OBLIGATORIO. Sin el token, todos los demás endpoints fallarán con `401 Unauthorized`.

**Problemas Comunes:**
- ❌ Error 401: Credenciales incorrectas
  - **Solución:** Verificar que el usuario admin existe en BD
  - `SELECT * FROM users WHERE email = 'admin@example.com';`
  
- ❌ Error 500: Base de datos no conectada
  - **Solución:** Verificar que PostgreSQL está corriendo
  - `docker ps | grep postgres`

---

#### **1.3 Login User** 👤

**¿Cuándo usar?**
Para probar el flujo desde la perspectiva de un usuario regular (no admin).

**Prerequisito:**
Ejecutar primero `1.1 Register User` para crear el usuario de prueba.

**Request:**
```json
POST /auth/login
{
  "email": "user.test@example.com",
  "password": "password123"
}
```

**Diferencia con Login Admin:**
- Admin: Puede crear conciertos, venues, y ver todas las órdenes
- User: Solo puede hacer reservas y ver sus propias órdenes

---

#### **1.4 Get Current User** ℹ️

**¿Qué hace?**
Verifica que el token actual es válido y obtiene información del usuario autenticado.

**Request:**
```http
GET /auth/me
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
{
  "id": 1,
  "name": "Admin",
  "email": "admin@example.com",
  "role": "admin"
}
```

**¿Para qué sirve?**
- Verificar que la sesión sigue activa
- Obtener role del usuario actual
- Debug de problemas de autenticación

---

### FASE 2: SETUP DE INFRAESTRUCTURA 🏗️

---

#### **2.1 Get All Venues** 🏟️

**¿Qué hace?**
Obtiene la lista de venues (lugares donde se realizan conciertos) disponibles en el sistema.

**Request:**
```http
GET /venues
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
[
  {
    "id": 1,
    "name": "Arena Central",
    "address": "Av. Principal 123",
    "city": "Ciudad Capital",
    "country": "Guatemala",
    "sections": [
      {
        "id": 1,
        "name": "VIP",
        "capacity": 100
      },
      {
        "id": 2,
        "name": "General",
        "capacity": 500
      }
    ]
  }
]
```

**Validación Automática:**
- ✅ Guarda automáticamente el primer `venue_id` encontrado

**Verificación en BD:**
```sql
-- Ver todos los venues
SELECT v.*, 
       (SELECT COUNT(*) FROM venue_sections WHERE venue_id = v.id) as total_sections
FROM venues v;

-- Ver secciones de un venue
SELECT * FROM venue_sections WHERE venue_id = 1;

-- Ver asientos de una sección
SELECT COUNT(*) as total_asientos 
FROM seats 
WHERE section_id = 1;
```

**¿Por qué es importante?**
El `venue_id` es requerido para crear conciertos. Cada venue tiene secciones (VIP, General, etc.) y cada sección tiene asientos físicos.

---

#### **2.2 Create Venue (Admin)** 🏗️

**¿Cuándo usar?**
Solo si necesitas crear un venue nuevo. Normalmente ya existe uno de la inicialización.

**Request:**
```json
POST /admin/venues
{
  "name": "Estadio Nacional",
  "address": "Av. Principal 123",
  "city": "Ciudad Capital",
  "country": "Guatemala"
}
```

**Response Esperado:**
```json
{
  "id": 2,
  "name": "Estadio Nacional",
  "address": "Av. Principal 123",
  "city": "Ciudad Capital",
  "country": "Guatemala"
}
```

**⚠️ Siguiente paso obligatorio:**
Después de crear un venue, DEBES crear sus secciones con `2.4 Create Section`.

---

#### **2.3 Get Venue Sections** 🎫

**¿Qué hace?**
Obtiene todas las secciones (zonas) de un venue específico.

**Request:**
```http
GET /venues/{{venue_id}}/sections
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
[
  {
    "id": 1,
    "venue_id": 1,
    "name": "VIP",
    "capacity": 100,
    "seats": [
      { "id": 1, "seat_number": 1 },
      { "id": 2, "seat_number": 2 },
      // ... hasta 100
    ]
  },
  {
    "id": 2,
    "venue_id": 1,
    "name": "General",
    "capacity": 500,
    "seats": [...]
  }
]
```

**Validación Automática:**
- ✅ Guarda el primer `section_id` en las variables

**¿Por qué es importante?**
El `section_id` es necesario para:
1. Crear tipos de tickets específicos por sección
2. Asignar precios diferentes según la zona
3. Controlar la disponibilidad por área

**Verificación:**
```sql
-- Ver detalles de una sección
SELECT vs.*, COUNT(s.id) as asientos_totales
FROM venue_sections vs
LEFT JOIN seats s ON s.section_id = vs.id
WHERE vs.id = 1
GROUP BY vs.id;
```

---

#### **2.4 Create Section (Admin)** ➕

**¿Qué hace?**
Crea una nueva sección en un venue Y automáticamente genera todos los asientos físicos.

**Request:**
```json
POST /admin/venues/{{venue_id}}/sections
{
  "name": "Platinum",
  "capacity": 50
}
```

**Response Esperado:**
```json
{
  "section": {
    "id": 3,
    "venue_id": 1,
    "name": "Platinum",
    "capacity": 50
  },
  "seatsCreated": 50
}
```

**¿Qué sucede internamente?**
```javascript
1. Crea registro en venue_sections
2. Genera 50 registros en tabla seats:
   - seat_number: 1, 2, 3, ..., 50
   - section_id: 3
```

**Verificación:**
```sql
-- Verificar que se crearon los asientos
SELECT section_id, COUNT(*) as total_asientos
FROM seats
WHERE section_id = 3
GROUP BY section_id;
```

---

### FASE 3: CREAR EVENTO 🎵

---

#### **3.2 Create Concert (Admin)** 🎸

**¿Qué hace?**
Crea un nuevo concierto y automáticamente genera la proyección de asientos (`concert_seats`) para ese evento específico.

**Request:**
```json
POST /admin/concerts
{
  "title": "Concierto Rock 2025",
  "description": "El mejor concierto de rock del año",
  "date": "2025-12-15T20:00:00Z",
  "venue_id": {{venue_id}}
}
```

**Response Esperado:**
```json
{
  "concert_id": 5,
  "title": "Concierto Rock 2025",
  "date": "2025-12-15T20:00:00.000Z",
  "venue": {
    "id": 1,
    "name": "Arena Central"
  },
  "concert_seats_created": 600,
  "message": "Concierto creado exitosamente con 600 asientos"
}
```

**¿Qué sucede internamente?**

```javascript
PASO 1: Validar traslape de horarios
- Busca conciertos en el mismo venue
- Rango: ±4 horas de la fecha solicitada
- Si existe traslape → ERROR 400

PASO 2: Crear concierto
- INSERT en tabla concerts
- Status: "scheduled" (de status_generales)

PASO 3: Crear concert_venue_detail
- Vincula concert con venue

PASO 4: Crear concert_seats (IMPORTANTE)
- Por CADA seat del venue:
  * Crea concert_seat con status "available"
  * seat_id = asiento físico
  * concert_id = concierto actual
- Total: Todos los asientos del venue (600 en este ejemplo)
```

**Verificación en BD:**
```sql
-- Ver el concierto creado
SELECT c.*, v.name as venue_name
FROM concerts c
JOIN concert_venue_detail cvd ON cvd.concert_id = c.id
JOIN venues v ON v.id = cvd.venue_id
WHERE c.id = 5;

-- Verificar concert_seats creados
SELECT 
    cs.concert_id,
    s.section_id,
    vs.name as section_name,
    COUNT(*) as asientos_disponibles
FROM concert_seats cs
JOIN seats s ON s.id = cs.seat_id
JOIN venue_sections vs ON vs.id = s.section_id
WHERE cs.concert_id = 5
  AND cs.status_id = (SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'available')
GROUP BY cs.concert_id, s.section_id, vs.name;
```

**Validaciones Automáticas:**
- ✅ `concert_id` guardado en variables
- ✅ `concert_seats_created > 0`

**Problemas Comunes:**

**❌ Error: "Traslape de horario detectado"**
```
Causa: Ya existe un concierto en el mismo venue dentro de ±4 horas
Solución:
1. Cambiar fecha del concierto (> 4 horas de diferencia)
2. Usar otro venue_id
3. Eliminar concierto conflictivo
```

**❌ Error: "Venue no encontrado"**
```
Causa: venue_id no existe en BD
Solución:
1. Ejecutar 2.1 Get All Venues
2. Usar un venue_id válido
3. O crear nuevo venue con 2.2 Create Venue
```

**❌ concert_seats_created = 0**
```
Causa: El venue no tiene secciones o asientos
Solución:
1. Verificar: SELECT * FROM venue_sections WHERE venue_id = X;
2. Verificar: SELECT * FROM seats WHERE section_id IN (SELECT id FROM venue_sections WHERE venue_id = X);
3. Si no hay asientos, crear sección: 2.4 Create Section
```

---

#### **3.3 Get Concert By ID** 🔍

**¿Qué hace?**
Obtiene información detallada de un concierto específico.

**Request:**
```http
GET /concerts/{{concert_id}}
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
{
  "id": 5,
  "title": "Concierto Rock 2025",
  "description": "El mejor concierto de rock del año",
  "date": "2025-12-15T20:00:00.000Z",
  "status": {
    "descripcion": "scheduled"
  },
  "venue": {
    "id": 1,
    "name": "Arena Central",
    "address": "Av. Principal 123",
    "city": "Ciudad Capital"
  },
  "ticket_types": [
    {
      "id": 10,
      "name": "VIP",
      "price": 500.00,
      "available": 50
    }
  ],
  "available_seats": 600
}
```

**¿Para qué sirve?**
- Verificar que el concierto se creó correctamente
- Ver estadísticas de disponibilidad
- Obtener información para mostrar al usuario

---

#### **4.2 Create Ticket Type (Admin)** 🎟️

**¿Qué hace?**
Define un tipo de ticket con precio y disponibilidad para una sección específica del concierto.

**Request:**
```json
POST /admin/concerts/{{concert_id}}/ticket-types
{
  "name": "VIP",
  "price": 500.00,
  "available": 50,
  "section_id": {{section_id}}
}
```

**Response Esperado:**
```json
{
  "id": 10,
  "concert_id": 5,
  "section_id": 1,
  "name": "VIP",
  "price": 500.00,
  "available": 50
}
```

**¿Qué significa cada campo?**

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `name` | Nombre comercial del ticket | "VIP", "General", "Platinum" |
| `price` | Precio unitario | 500.00 |
| `available` | Cantidad de tickets disponibles para vender | 50 |
| `section_id` | Sección del venue asociada | 1 (VIP) |

**¿Por qué `available` puede ser menor que la capacidad de la sección?**
```javascript
Sección VIP tiene 100 asientos
Pero solo pones 50 tickets disponibles

Razones válidas:
- Asientos reservados para prensa/VIPs
- Venta por fases (primera fase: 50, segunda fase: 25, etc.)
- Control de aforo por seguridad
- Asientos con visibilidad obstruida
```

**Relación con concert_seats:**
```javascript
Cuando se crea el tipo de ticket:
1. NO se modifican los concert_seats todavía
2. Los concert_seats siguen con status "available"
3. Solo cuando alguien RESERVA, se marcan como "reserved"
4. Y cuando CONFIRMA la orden, se marcan como "occupied"
```

**Verificación:**
```sql
-- Ver tipos de tickets de un concierto
SELECT tt.*, vs.name as section_name
FROM ticket_types tt
JOIN venue_sections vs ON vs.id = tt.section_id
WHERE tt.concert_id = 5;

-- Ver cuántos asientos disponibles hay realmente
SELECT COUNT(*) as asientos_disponibles
FROM concert_seats cs
JOIN seats s ON s.id = cs.seat_id
WHERE cs.concert_id = 5
  AND s.section_id = 1
  AND cs.status_id = (SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'available');
```

**Validaciones Automáticas:**
- ✅ `ticket_type_id` guardado en variables
- ✅ `available <= capacity` de la sección

**⚠️ IMPORTANTE:**
Debes crear un ticket_type por cada sección que quieras vender. Ejemplo:
- VIP: precio 500, disponibles 50
- General: precio 100, disponibles 300
- Platinum: precio 1000, disponibles 20

---

#### **4.4 Get Available Seats** 💺

**¿Qué hace?**
Obtiene todos los asientos disponibles de una sección específica para un concierto.

**Request:**
```http
GET /concerts/{{concert_id}}/sections/{{section_id}}/available-seats
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
[
  {
    "concert_seat_id": 101,
    "seat_id": 1,
    "seat_number": 1,
    "section_name": "VIP",
    "status": "available"
  },
  {
    "concert_seat_id": 102,
    "seat_id": 2,
    "seat_number": 2,
    "section_name": "VIP",
    "status": "available"
  },
  // ... más asientos
]
```

**¿Para qué sirve?**
- Mostrar al usuario qué asientos puede seleccionar
- Frontend puede dibujar mapa de asientos
- Validar disponibilidad antes de reservar

**Estados posibles de un asiento:**

| Status | Descripción | ¿Puede reservarse? |
|--------|-------------|-------------------|
| `available` | Disponible para reservar | ✅ SÍ |
| `reserved` | Reservado temporalmente (5 min) | ❌ NO |
| `occupied` | Vendido definitivamente | ❌ NO |
| `in_cart` | En carrito de otro usuario | ⚠️ Depende de la lógica |

---

### FASE 4: PROCESO DE COMPRA 🛒

---

#### **6.1 Create Reservation** 📝

**¿Qué hace?**
Crea una reserva temporal de tickets que expira en 5 minutos. Los asientos se marcan como "reserved" y se publica un mensaje en RabbitMQ.

**Request:**
```json
POST /tickets/reserve
{
  "concert_id": {{concert_id}},
  "ticket_type_id": {{ticket_type_id}},
  "quantity": 2
}
```

**Response Esperado:**
```json
{
  "reservation_id": 15,
  "user_id": 1,
  "concert_id": 5,
  "status": "active",
  "expires_at": "2025-10-24T15:45:00.000Z",
  "seats": [
    {
      "concert_seat_id": 101,
      "seat_id": 1,
      "seat_number": 1,
      "section_name": "VIP"
    },
    {
      "concert_seat_id": 102,
      "seat_id": 2,
      "seat_number": 2,
      "section_name": "VIP"
    }
  ]
}
```

**¿Qué sucede internamente?**

```javascript
PASO 1: Validaciones
- Usuario no puede tener más de 5 asientos reservados activos
- Verificar que ticket_type tiene availability >= quantity
- Verificar que existen suficientes asientos disponibles en la sección

PASO 2: Validar disponibilidad con matriz de bloqueo
- Llama a validateSeatAvailability()
- Verifica que los asientos NO estén:
  * Ya reservados por otro usuario
  * Ya vendidos (occupied)
  * Bloqueados en Redis

PASO 3: Crear reserva
- INSERT en reservations
- expires_at = NOW() + 5 minutos
- status: "active"

PASO 4: Crear reservation_seats
- Por cada asiento seleccionado:
  * INSERT en reservation_seats
  * UPDATE concert_seat status → "reserved"

PASO 5: Reducir disponibilidad
- ticket_type.available -= quantity

PASO 6: Publicar en RabbitMQ
- Cola: RESERVA_QUEUE
- Mensaje: { reservationId, userId, seatIds, timestamp }
- TTL: 5 minutos
```

**Validaciones Automáticas:**
- ✅ `reservation_id` guardado
- ✅ `expires_at` es ~5 minutos en el futuro
- ✅ Asientos asignados correctamente

**Verificación en BD:**
```sql
-- Ver la reserva creada
SELECT r.*, 
       u.email as user_email,
       c.title as concert_title
FROM reservations r
JOIN users u ON u.id = r.user_id
JOIN concerts c ON c.id = r.concert_id
WHERE r.id = 15;

-- Ver asientos reservados
SELECT rs.*, s.seat_number, vs.name as section_name
FROM reservation_seats rs
JOIN seats s ON s.id = rs.seat_id
JOIN venue_sections vs ON vs.id = s.section_id
WHERE rs.reservation_id = 15;

-- Ver status de concert_seats
SELECT cs.id, cs.seat_id, s.seat_number, sg.descripcion as status
FROM concert_seats cs
JOIN seats s ON s.id = cs.seat_id
JOIN status_generales sg ON sg.id = cs.status_id
WHERE cs.id IN (101, 102);
```

**Verificación en RabbitMQ:**
```bash
# Abrir Management UI
# http://localhost:15672

# Buscar cola: RESERVA_QUEUE
# Debería tener 1 mensaje
# TTL: 5 minutos (300,000 ms)
```

**Problemas Comunes:**

**❌ Error: "Solo hay 0 tickets disponibles"**
```
Causas posibles:
1. ticket_type.available = 0 (agotado)
2. Reservas anteriores no liberadas
3. Todos los asientos ya están ocupados

Solución:
1. Ejecutar 6.2 Release Expired Reservations
2. Verificar: SELECT available FROM ticket_types WHERE id = X;
3. Verificar asientos: 
   SELECT COUNT(*) FROM concert_seats 
   WHERE concert_id = X AND status_id = (SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'available');
```

**❌ Error: "Tienes X asientos reservados. Máximo: 5"**
```
Causa: El usuario ya tiene 5 reservas activas
Solución:
1. Esperar a que expiren (5 minutos)
2. O ejecutar 6.2 Release Expired Reservations
3. O confirmar/cancelar reservas anteriores
```

**❌ Error: "No hay asientos disponibles en esta sección"**
```
Causa: Todos los asientos de la sección están reservados u ocupados
Solución:
1. Intentar con otra sección
2. Esperar a que expiren reservas
3. Verificar con 4.4 Get Available Seats
```

---

#### **6.2 Release Expired Reservations** 🔄

**¿Qué hace?**
Libera todas las reservas que hayan expirado (>5 minutos). Esto restaura:
- `available` del ticket_type
- Status de concert_seats → "available"
- Status de reservation → "expired"

**Request:**
```http
POST /tickets/release-expired
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
{
  "released": 3,
  "message": "3 reservas expiradas liberadas exitosamente"
}
```

**¿Cuándo ejecutarlo?**
- Normalmente esto lo ejecuta un CRON JOB cada minuto
- Manualmente: Para testing o debug
- Antes de probar nuevas reservas si algo falló

**Verificación:**
```sql
-- Ver reservas expiradas liberadas
SELECT r.id, r.expires_at, sg.descripcion as status
FROM reservations r
JOIN status_generales sg ON sg.id = r.status_id
WHERE r.expires_at < NOW()
  AND sg.descripcion = 'expired';

-- Verificar que ticket_type recuperó availability
SELECT available FROM ticket_types WHERE id = 10;
```

---

#### **6.3 Create Order** 🛒

**¿Qué hace?**
Crea una orden de compra a partir de una reserva. La orden queda en estado "pending" esperando confirmación de pago.

**Request:**
```json
POST /orders
{
  "reservation_id": {{reservation_id}},
  "items": [
    {
      "ticket_type_id": {{ticket_type_id}},
      "quantity": 2
    }
  ],
  "merchandise_items": []
}
```

**Response Esperado:**
```json
{
  "order_id": 25,
  "user_id": 1,
  "concert_id": 5,
  "reservation_id": 15,
  "total": 1000.00,
  "status": "pending",
  "items": [
    {
      "ticket_type_id": 10,
      "quantity": 2,
      "unit_price": 500.00,
      "subtotal": 1000.00
    }
  ],
  "seats": [
    { "seat_id": 1, "seat_number": 1 },
    { "seat_id": 2, "seat_number": 2 }
  ]
}
```

**¿Qué sucede internamente?**

```javascript
PASO 1: Validar reserva
- Verificar que reservation existe
- Verificar que NO ha expirado
- Verificar que pertenece al usuario actual
- Verificar que status = "active"

PASO 2: Crear orden
- INSERT en orders
- status: "pending"
- total: Suma de items

PASO 3: Crear order_items
- Por cada item en el request:
  * INSERT en order_items
  * Guardar ticket_type_id, quantity, unit_price

PASO 4: Crear order_seats
- Por cada reservation_seat:
  * INSERT en order_seats
  * Vincular asiento con la orden

PASO 5: Publicar en RabbitMQ
- Cola: CARRITO_QUEUE
- Mensaje: { orderId, reservationId, userId, total, timestamp }
- TTL: 5 minutos (igual que la reserva)
```

**Validaciones Automáticas:**
- ✅ `order_id` guardado
- ✅ `status` es "pending"
- ✅ `total` es correcto

**Verificación en BD:**
```sql
-- Ver la orden creada
SELECT o.*, 
       sg.descripcion as status,
       c.title as concert_title
FROM orders o
JOIN status_generales sg ON sg.id = o.status_id
JOIN concerts c ON c.id = o.concert_id
WHERE o.id = 25;

-- Ver items de la orden
SELECT oi.*, tt.name as ticket_type_name
FROM order_items oi
JOIN ticket_types tt ON tt.id = oi.ticket_type_id
WHERE oi.order_id = 25;

-- Ver asientos de la orden
SELECT os.*, s.seat_number
FROM order_seats os
JOIN seats s ON s.id = os.seat_id
WHERE os.order_id = 25;
```

**⚠️ Diferencia entre Reserva y Orden:**

| Concepto | Reserva | Orden |
|----------|---------|-------|
| **Propósito** | Bloquear asientos temporalmente | Compra formal |
| **Duración** | 5 minutos | Permanente (después de confirmar) |
| **Status de asientos** | "reserved" | "reserved" → "occupied" (al confirmar) |
| **Genera tickets** | NO | SÍ (al confirmar) |
| **Cobra dinero** | NO | SÍ (al confirmar) |

**Problemas Comunes:**

**❌ Error: "La reserva ha expirado"**
```
Causa: Han pasado >5 minutos desde que se creó la reserva
Solución:
1. Crear nueva reserva (6.1)
2. Luego crear orden con la nueva reservation_id
```

**❌ Error: "Reserva no encontrada"**
```
Causa: reservation_id no existe o es incorrecto
Solución:
1. Verificar: SELECT * FROM reservations WHERE id = X;
2. Si no existe, crear nueva reserva
```

---

#### **6.4 Confirm Order (Simular Pago)** 💳

**¿Qué hace?**
Confirma la orden, simula el pago, genera los tickets y actualiza todo el sistema. Este es el paso MÁS CRÍTICO.

**Request:**
```http
POST /orders/{{order_id}}/confirm
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
{
  "message": "Orden confirmada exitosamente",
  "order": {
    "id": 25,
    "user_id": 1,
    "concert_id": 5,
    "total": 1000.00,
    "status": {
      "descripcion": "confirmed"
    },
    "concert": {
      "id": 5,
      "title": "Concierto Rock 2025",
      "date": "2025-12-15T20:00:00.000Z"
    }
  },
  "tickets": [
    {
      "id": 50,
      "code": "TCK-25-1-A3F9G2",
      "ticket_type_id": 10,
      "seat": {
        "id": 1,
        "seat_number": 1
      },
      "status": "issued"
    },
    {
      "id": 51,
      "code": "TCK-25-2-B7H4K8",
      "ticket_type_id": 10,
      "seat": {
        "id": 2,
        "seat_number": 2
      },
      "status": "issued"
    }
  ],
  "payment": {
    "id": 10,
    "order_id": 25,
    "provider": "mock",
    "amount": 1000.00,
    "status": "captured"
  }
}
```

**¿Qué sucede internamente?** (PROCESO COMPLETO)

```javascript
PASO 1: Validar orden
- Verificar que orden existe
- Verificar que pertenece al usuario
- Verificar que status = "pending" (no puede confirmar 2 veces)

PASO 2: Iniciar transacción de BD
- BEGIN TRANSACTION
- Todo o nada (atomicidad)

PASO 3: Copiar reservation_seats → order_seats
- Por cada asiento de la reserva:
  * INSERT en order_seats
  * Vincular con la orden actual

PASO 4: Actualizar concert_seats → OCCUPIED (PERMANENTE)
- UPDATE concert_seats
  SET status_id = (SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'occupied')
  WHERE id IN (concert_seat_ids de la orden)

PASO 5: Actualizar orden → CONFIRMED
- UPDATE orders
  SET status_id = (SELECT id FROM status_generales WHERE dominio = 'order' AND descripcion = 'confirmed')
  WHERE id = 25

PASO 6: Crear tickets (uno por cada asiento)
- Para asiento 1:
  * INSERT en tickets
  * code = generateTicketCode(25, 1) → "TCK-25-1-A3F9G2"
  * status: "issued"
- Para asiento 2:
  * INSERT en tickets
  * code = generateTicketCode(25, 2) → "TCK-25-2-B7H4K8"
  * status: "issued"

PASO 7: Crear registro de pago (simulado)
- INSERT en payments
- provider: "mock" (simula MercadoPago/Stripe)
- amount: 1000.00
- status: "captured"

PASO 8: TODO - Consumir de RabbitMQ
- Buscar mensaje en CARRITO_QUEUE con orderId = 25
- Marcarlo como procesado (ACK)
- Eliminar de la cola

PASO 9: Commit transacción
- COMMIT
- Si algo falla, ROLLBACK automático

PASO 10: Retornar respuesta completa
```

**Validaciones Automáticas:**
- ✅ Tickets generados = quantity
- ✅ Cada código de ticket es único
- ✅ Status de orden = "confirmed"
- ✅ Registro de pago existe
- ✅ Asientos actualizados a "occupied"

**Verificación COMPLETA en BD:**

```sql
-- 1. Ver orden confirmada
SELECT o.*, sg.descripcion as status
FROM orders o
JOIN status_generales sg ON sg.id = o.status_id
WHERE o.id = 25;
-- Debe mostrar status = 'confirmed'

-- 2. Ver tickets generados
SELECT t.*, s.seat_number, sg.descripcion as status
FROM tickets t
JOIN seats s ON s.id = t.seat_id
JOIN status_generales sg ON sg.id = t.status_id
WHERE t.order_id = 25;
-- Debe mostrar 2 tickets con códigos únicos

-- 3. Ver asientos ocupados
SELECT cs.id, s.seat_number, sg.descripcion as status
FROM concert_seats cs
JOIN seats s ON s.id = cs.seat_id
JOIN status_generales sg ON sg.id = cs.status_id
WHERE cs.concert_id = 5
  AND cs.id IN (SELECT concert_seat_id FROM order_seats WHERE order_id = 25);
-- Debe mostrar status = 'occupied'

-- 4. Ver pago registrado
SELECT p.*, sg.descripcion as payment_status
FROM payments p
JOIN status_generales sg ON sg.id = p.status_id
WHERE p.order_id = 25;
-- Debe mostrar provider = 'mock', amount = 1000.00

-- 5. Verificar que reservation_seats se copiaron a order_seats
SELECT 
    rs.reservation_id,
    rs.seat_id,
    os.order_id,
    os.seat_id as order_seat_id
FROM reservation_seats rs
LEFT JOIN order_seats os ON os.seat_id = rs.seat_id
WHERE rs.reservation_id = 15;
```

**Verificación en RabbitMQ:**

```bash
# Abrir Management UI: http://localhost:15672
# Ir a Queues → CARRITO_QUEUE
# El mensaje con orderId = 25 debe:
#   - Estar marcado como "Ready" ANTES de confirmar
#   - Estar "Acknowledged" DESPUÉS de confirmar
#   - O estar eliminado (consumido)
```

**Verificación de Códigos de Ticket:**

Cada ticket tiene un código único generado así:
```javascript
function generateTicketCode(orderId, ticketIndex) {
    const prefix = "TCK";
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${orderId}-${ticketIndex}-${random}`;
}

// Ejemplos:
// TCK-25-1-A3F9G2
// TCK-25-2-B7H4K8
```

**Formato del código:**
- `TCK`: Prefijo fijo
- `25`: Order ID
- `1`: Índice del ticket (1, 2, 3...)
- `A3F9G2`: Random alfanumérico

**Verificar unicidad:**
```sql
-- Verificar que NO haya códigos duplicados
SELECT code, COUNT(*) as duplicados
FROM tickets
GROUP BY code
HAVING COUNT(*) > 1;
-- Debe retornar 0 filas
```

**Problemas Comunes:**

**❌ Error: "Orden no encontrada o no pertenece al usuario"**
```
Causa: order_id incorrecto o pertenece a otro usuario
Solución:
1. Verificar: SELECT * FROM orders WHERE id = 25;
2. Verificar que user_id coincide con el usuario autenticado
```

**❌ Error: "La orden ya fue confirmada"**
```
Causa: Intentas confirmar una orden que ya tiene status = 'confirmed'
Solución:
1. No es necesario confirmar de nuevo
2. Usa 6.6 Get Order By ID para ver los tickets
```

**❌ Error de transacción: "Rollback executed"**
```
Causas posibles:
1. Asientos ya están ocupados
2. Problema con status_generales
3. Error en creación de tickets

Solución:
1. Ver logs del servidor para detalles exactos
2. Verificar integridad de datos:
   SELECT * FROM status_generales WHERE dominio IN ('order', 'ticket', 'payment', 'seat');
3. Reintentar con nueva orden
```

**❌ Tickets no tienen códigos o son NULL**
```
Causa: Función generateTicketCode() falló
Solución:
1. Verificar logs del servidor
2. Verificar: SELECT * FROM tickets WHERE code IS NULL;
3. Si existen, eliminar y volver a confirmar
```

---

### FASE 5: POST-COMPRA 📧

---

#### **6.6 Get Order By ID** 🔍

**¿Qué hace?**
Obtiene información completa de una orden con todos sus tickets y detalles.

**Request:**
```http
GET /orders/{{order_id}}
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
{
  "id": 25,
  "user_id": 1,
  "concert_id": 5,
  "total": 1000.00,
  "status": {
    "descripcion": "confirmed"
  },
  "created_at": "2025-10-24T15:40:00.000Z",
  "concert": {
    "id": 5,
    "title": "Concierto Rock 2025",
    "date": "2025-12-15T20:00:00.000Z",
    "venue": {
      "name": "Arena Central"
    }
  },
  "tickets": [
    {
      "id": 50,
      "code": "TCK-25-1-A3F9G2",
      "ticket_type": {
        "name": "VIP",
        "price": 500.00
      },
      "seat": {
        "seat_number": 1,
        "section": {
          "name": "VIP"
        }
      },
      "status": "issued"
    },
    {
      "id": 51,
      "code": "TCK-25-2-B7H4K8",
      "ticket_type": {
        "name": "VIP",
        "price": 500.00
      },
      "seat": {
        "seat_number": 2,
        "section": {
          "name": "VIP"
        }
      },
      "status": "issued"
    }
  ],
  "order_seats": [
    {
      "seat_id": 1,
      "seat": {
        "seat_number": 1
      }
    },
    {
      "seat_id": 2,
      "seat": {
        "seat_number": 2
      }
    }
  ],
  "payment": {
    "provider": "mock",
    "amount": 1000.00,
    "status": "captured"
  }
}
```

**¿Para qué sirve?**
- Ver detalles completos de la compra
- Descargar/imprimir tickets
- Verificar asientos asignados
- Ver status del pago

---

#### **6.5 Get User Orders** 📋

**¿Qué hace?**
Lista todas las órdenes de un usuario específico.

**Request:**
```http
GET /orders/user/{{user_id}}
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
[
  {
    "id": 25,
    "concert": {
      "id": 5,
      "title": "Concierto Rock 2025",
      "date": "2025-12-15T20:00:00.000Z"
    },
    "status": {
      "descripcion": "confirmed"
    },
    "total": 1000.00,
    "created_at": "2025-10-24T15:40:00.000Z",
    "tickets": [
      {
        "code": "TCK-25-1-A3F9G2",
        "seat": { "seat_number": 1 }
      },
      {
        "code": "TCK-25-2-B7H4K8",
        "seat": { "seat_number": 2 }
      }
    ]
  },
  {
    "id": 24,
    "concert": {
      "id": 4,
      "title": "Concierto Pop 2025"
    },
    "status": {
      "descripcion": "pending"
    },
    "total": 200.00,
    "created_at": "2025-10-20T10:00:00.000Z"
  }
]
```

**¿Para qué sirve?**
- Ver historial de compras del usuario
- Dashboard de "Mis Tickets"
- Filtrar por status (confirmed, pending, cancelled)

---

#### **7.1 Send Tickets Email** 📧

**¿Qué hace?**
Envía los tickets de una orden por email al usuario.

**Request:**
```http
POST /orders/{{order_id}}/send-tickets
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
{
  "message": "Tickets enviados por email exitosamente",
  "email_sent_to": "user.test@example.com",
  "tickets_sent": 2,
  "notification_id": 30
}
```

**¿Qué incluye el email?**
- Códigos de tickets (QR codes)
- Información del concierto
- Asientos asignados
- Instrucciones de acceso

**Verificación:**
```sql
-- Ver notificación creada
SELECT * FROM notifications 
WHERE order_id = 25 
  AND type = 'tickets_sent';
```

---

#### **7.2 Send Confirmation Email** ✅

**¿Qué hace?**
Envía email de confirmación de compra.

**Request:**
```http
POST /orders/{{order_id}}/send-confirmation
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
{
  "message": "Confirmación enviada exitosamente",
  "email_sent_to": "user.test@example.com",
  "notification_id": 31
}
```

**¿Qué incluye el email?**
- Resumen de la compra
- Total pagado
- Fecha y lugar del evento
- Link para descargar tickets

---

### FASE 6: REPORTES ADMIN 📊

---

#### **6.7 Get All Orders (Admin)** 📋

**¿Qué hace?**
Lista TODAS las órdenes del sistema (solo administradores).

**Request:**
```http
GET /admin/orders
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
[
  {
    "id": 25,
    "user": {
      "id": 1,
      "name": "Admin",
      "email": "admin@example.com"
    },
    "concert": {
      "id": 5,
      "title": "Concierto Rock 2025"
    },
    "status": "confirmed",
    "total": 1000.00,
    "created_at": "2025-10-24T15:40:00.000Z"
  },
  // ... más órdenes
]
```

---

#### **6.8 Get Sales by Concert (Admin)** 💰

**¿Qué hace?**
Genera reporte de ventas de un concierto específico.

**Request:**
```http
GET /admin/concerts/{{concert_id}}/sales
Authorization: Bearer {{auth_token}}
```

**Response Esperado:**
```json
{
  "concert": {
    "id": 5,
    "title": "Concierto Rock 2025",
    "date": "2025-12-15T20:00:00.000Z"
  },
  "total_sales": 15000.00,
  "total_tickets_sold": 45,
  "total_orders": 12,
  "by_ticket_type": [
    {
      "ticket_type": "VIP",
      "quantity_sold": 20,
      "revenue": 10000.00
    },
    {
      "ticket_type": "General",
      "quantity_sold": 25,
      "revenue": 5000.00
    }
  ],
  "orders": [
    {
      "id": 25,
      "user": "user.test@example.com",
      "total": 1000.00,
      "tickets": 2,
      "status": "confirmed"
    }
  ]
}
```

---

## 🧪 ESCENARIOS DE PRUEBA AVANZADOS

### Escenario 1: Flujo Completo Exitoso ✅

**Objetivo:** Usuario compra tickets de principio a fin sin errores.

**Secuencia de Requests:**

```
1. Login Admin (1.2)
   → Obtiene token

2. Get All Venues (2.1)
   → venue_id = 1

3. Get Venue Sections (2.3)
   → section_id = 1

4. Create Concert (3.2)
   → concert_id = 5
   → concert_seats_created = 600

5. Create Ticket Type (4.2)
   → ticket_type_id = 10
   → name: "VIP", price: 500, available: 50

6. Login User (1.3) 
   → Token de usuario regular

7. Create Reservation (6.1)
   → reservation_id = 15
   → expires_at: +5 min
   → 2 asientos reservados

8. Create Order (6.3)
   → order_id = 25
   → status: "pending"

9. Confirm Order (6.4)
   → 2 tickets generados
   → Asientos → "occupied"
   → Pago registrado

10. Get Order By ID (6.6)
    → Ver tickets con códigos

11. Send Tickets Email (7.1)
    → Email enviado

12. Get User Orders (6.5)
    → Ver en lista de órdenes
```

**Resultado Esperado:**
- ✅ Todos los requests con status 200/201
- ✅ Tickets generados con códigos únicos
- ✅ Asientos correctamente asignados
- ✅ Email de tickets enviado

---

### Escenario 2: Reserva Expirada ⏰

**Objetivo:** Probar que las reservas se liberan después de 5 minutos.

**Pasos:**

```
1. Create Reservation (6.1)
   → reservation_id = 20
   → expires_at = NOW() + 5 min
   → ticket_type.available = 50 → 48

2. [ESPERAR 6 MINUTOS] ⏳
   O ejecutar SQL:
   UPDATE reservations 
   SET expires_at = NOW() - INTERVAL '1 minute' 
   WHERE id = 20;

3. Release Expired Reservations (6.2)
   → released = 1

4. Verificar:
   - reservation.status = "expired"
   - ticket_type.available = 48 → 50
   - concert_seats.status = "reserved" → "available"

5. Intentar Create Order (6.3) con reservation_id = 20
   → ❌ Error: "La reserva ha expirado"

6. Create Reservation (6.1) nuevamente
   → ✅ Éxito, ahora hay disponibilidad restaurada
```

**Verificación en BD:**
```sql
-- Ver reserva expirada
SELECT * FROM reservations WHERE id = 20;
-- status_id debe ser "expired"

-- Ver asientos liberados
SELECT cs.*, sg.descripcion as status
FROM concert_seats cs
JOIN status_generales sg ON sg.id = cs.status_id
WHERE cs.id IN (SELECT concert_seat_id FROM reservation_seats WHERE reservation_id = 20);
-- status debe ser "available"
```

---

### Escenario 3: Concurrencia - Dos Usuarios, Últimos Tickets 🏃‍♂️🏃‍♀️

**Objetivo:** Probar que el sistema maneja correctamente cuando dos usuarios intentan reservar los últimos tickets simultáneamente.

**Setup:**
```sql
-- Crear ticket type con solo 2 tickets disponibles
UPDATE ticket_types 
SET available = 2 
WHERE id = 10;
```

**Usuario A:**
```
1. Login User A (1.3)
2. Create Reservation (6.1)
   → quantity: 2
   → ✅ ÉXITO
   → available: 2 → 0
```

**Usuario B (inmediatamente después):**
```
3. Login User B (con otro usuario)
4. Create Reservation (6.1)
   → quantity: 1
   → ❌ ERROR: "Solo hay 0 tickets disponibles"
```

**Resultado Esperado:**
- ✅ Usuario A logra reservar (primero)
- ❌ Usuario B recibe error (no hay disponibilidad)
- ✅ Sistema previene sobreventa

**Verificación:**
```sql
-- Ver disponibilidad actual
SELECT available FROM ticket_types WHERE id = 10;
-- Debe ser 0

-- Ver reservas activas
SELECT COUNT(*) FROM reservations 
WHERE status_id = (SELECT id FROM status_generales WHERE dominio = 'reservation' AND descripcion = 'active');
-- Debe ser 1 (solo Usuario A)
```

---

### Escenario 4: Traslape de Horarios 🚫

**Objetivo:** Verificar que no se puedan crear dos conciertos en el mismo venue con horarios superpuestos.

**Pasos:**

```
1. Create Concert (3.2)
   → date: "2025-12-15T20:00:00Z"
   → venue_id: 1
   → ✅ ÉXITO: concert_id = 5

2. Create Concert (3.2) nuevamente
   → date: "2025-12-15T21:30:00Z" (1.5 horas después)
   → venue_id: 1 (mismo venue)
   → ❌ ERROR: "Traslape de horario detectado con el concierto 'Concierto Rock 2025'"

3. Create Concert (3.2) con fecha válida
   → date: "2025-12-15T16:00:00Z" (4+ horas antes)
   → venue_id: 1
   → ✅ ÉXITO: concert_id = 6
```

**Regla de Traslape:**
```javascript
Horario del concierto existente: 20:00
Rango bloqueado: 16:00 - 24:00 (±4 horas)

Válido:
- 15:59 ✅
- 00:01 (día siguiente) ✅

Inválido:
- 16:00 - 23:59 ❌
```

---

### Escenario 5: Orden Sin Confirmar (Abandono de Carrito) 🛒❌

**Objetivo:** Probar qué sucede si un usuario crea una orden pero nunca la confirma.

**Pasos:**

```
1. Create Reservation (6.1)
   → reservation_id = 30

2. Create Order (6.3)
   → order_id = 40
   → status: "pending"

3. [NO EJECUTAR Confirm Order]

4. [ESPERAR 6 MINUTOS]

5. Release Expired Reservations (6.2)
   → reservation status → "expired"
   → concert_seats → "available"
   → ticket_type.available restaurado

6. Verificar orden:
   SELECT * FROM orders WHERE id = 40;
   → status sigue siendo "pending"
   → Orden queda "huérfana" (sin procesar)

7. Intentar Confirm Order (6.4) ahora
   → ❌ ERROR: "La reserva asociada ha expirado"
```

**Limpieza Sugerida:**
```sql
-- Eliminar órdenes pending con reservas expiradas
DELETE FROM orders 
WHERE status_id = (SELECT id FROM status_generales WHERE dominio = 'order' AND descripcion = 'pending')
  AND reservation_id IN (
    SELECT id FROM reservations 
    WHERE status_id = (SELECT id FROM status_generales WHERE dominio = 'reservation' AND descripcion = 'expired')
  );
```

---

### Escenario 6: Límite de 5 Reservas por Usuario 🚫

**Objetivo:** Probar que un usuario no puede tener más de 5 asientos reservados simultáneamente.

**Pasos:**

```
1. Create Reservation #1 (6.1)
   → quantity: 2
   → Total asientos reservados: 2

2. Create Reservation #2 (6.1)
   → quantity: 2
   → Total asientos reservados: 4

3. Create Reservation #3 (6.1)
   → quantity: 2
   → ❌ ERROR: "Tienes 4 asientos reservados. Máximo: 5 por usuario"
   
4. Create Reservation #3 (ajustado) (6.1)
   → quantity: 1
   → ✅ ÉXITO
   → Total asientos reservados: 5

5. Create Reservation #4 (6.1)
   → quantity: 1
   → ❌ ERROR: "Tienes 5 asientos reservados. Máximo: 5 por usuario"

6. Confirm Order de Reservation #1 (6.4)
   → reservation → "completed"
   → Asientos ya no cuentan como "reservados"
   → Total asientos reservados: 3

7. Create Reservation #4 (intentar de nuevo) (6.1)
   → quantity: 2
   → ✅ ÉXITO (ahora hay espacio)
```

**Verificación:**
```sql
-- Ver cuántos asientos tiene reservados un usuario
SELECT COUNT(*) as asientos_reservados
FROM reservation_seats rs
JOIN reservations r ON r.id = rs.reservation_id
WHERE r.user_id = 1
  AND r.status_id = (SELECT id FROM status_generales WHERE dominio = 'reservation' AND descripcion = 'active');
```

---

## 🔧 VERIFICACIÓN DE REDIS Y RABBITMQ

### Verificar Redis 📦

**1. Conectar a Redis:**
```bash
docker exec -it <redis-container-name> redis-cli
```

**2. Comandos útiles:**
```redis
# Ver todas las keys
KEYS *

# Ver valor de una key específica
GET concerts:5

# Ver catálogos cacheados
KEYS catalog:*

# Ver TTL de una key
TTL concerts:5

# Limpiar caché
FLUSHDB
```

**3. Verificar catálogos cacheados:**
```redis
# Venues
GET catalog:venues

# Sections de un venue
GET catalog:venue:1:sections

# Ticket types de un concierto
GET catalog:concert:5:ticket_types
```

---

### Verificar RabbitMQ 🐰

**1. Acceder al Management UI:**
- URL: http://localhost:15672
- User: guest
- Password: guest

**2. Verificar colas:**

**RESERVA_QUEUE:**
- Mensajes publicados cuando se crea una reserva
- TTL: 5 minutos (300,000 ms)
- Mensaje expira automáticamente si no se consume

**CARRITO_QUEUE:**
- Mensajes publicados cuando se crea una orden
- TTL: 5 minutos
- Se consume al confirmar la orden

**3. Ver mensajes:**
```
Queues → [Nombre de cola] → Get Messages
```

**4. Estructura de mensajes:**

**RESERVA_QUEUE:**
```json
{
  "reservationId": 15,
  "userId": 1,
  "concertId": 5,
  "seatIds": [1, 2],
  "concertSeatIds": [101, 102],
  "sectionId": 1,
  "timestamp": "2025-10-24T15:40:00.000Z"
}
```

**CARRITO_QUEUE:**
```json
{
  "orderId": 25,
  "reservationId": 15,
  "userId": 1,
  "concertId": 5,
  "total": 1000.00,
  "timestamp": "2025-10-24T15:42:00.000Z"
}
```

---

## 🐛 TROUBLESHOOTING

### Problema: Token inválido o expirado 🔐

**Síntomas:**
```json
{
  "message": "Token inválido o expirado"
}
```

**Soluciones:**

1. **Re-ejecutar Login:**
   ```
   1.2 Login Admin
   → Nuevo token guardado en {{auth_token}}
   ```

2. **Verificar que el token se guardó:**
   ```
   Postman → Environments → TicketApp Local
   → Verificar que auth_token tiene valor
   ```

3. **Verificar header Authorization:**
   ```
   Headers de la request:
   Authorization: Bearer {{auth_token}}
   ```

4. **Verificar expiración del token:**
   ```javascript
   // En consola de Postman
   const token = pm.environment.get('auth_token');
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Expira:', new Date(payload.exp * 1000));
   ```

---

### Problema: "Solo hay 0 tickets disponibles" 📉

**Causas posibles:**

**1. Reservas no liberadas:**
```sql
-- Ver reservas activas que expiraron
SELECT * FROM reservations 
WHERE expires_at < NOW()
  AND status_id = (SELECT id FROM status_generales WHERE dominio = 'reservation' AND descripcion = 'active');
```

**Solución:**
```
Ejecutar: 6.2 Release Expired Reservations
```

**2. Todos los tickets vendidos:**
```sql
-- Ver disponibilidad real
SELECT available FROM ticket_types WHERE id = 10;

-- Ver asientos disponibles
SELECT COUNT(*) FROM concert_seats cs
WHERE cs.concert_id = 5
  AND cs.status_id = (SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'available');
```

**Solución:**
```
- Aumentar available del ticket_type
- O crear nuevo concierto
```

**3. Disponibilidad inicial muy baja:**
```
Al crear ticket_type, pusiste available = 2
Y ya se reservaron 2 tickets

Solución: Crear ticket_type con más disponibilidad
```

---

### Problema: "Traslape de horario detectado" 🚫

**Causa:**
Ya existe un concierto en el mismo venue dentro de ±4 horas.

**Ver conciertos existentes:**
```sql
SELECT c.id, c.title, c.date, v.name as venue_name
FROM concerts c
JOIN concert_venue_detail cvd ON cvd.concert_id = c.id
JOIN venues v ON v.id = cvd.venue_id
WHERE v.id = 1
ORDER BY c.date;
```

**Soluciones:**

1. **Cambiar fecha:**
   ```json
   // Asegurar > 4 horas de diferencia
   "date": "2025-12-16T02:00:00Z"
   ```

2. **Usar otro venue:**
   ```json
   "venue_id": 2
   ```

3. **Eliminar concierto conflictivo:**
   ```http
   DELETE /admin/concerts/:id
   ```

---

### Problema: Concert seats no se crearon 💺

**Síntomas:**
```json
{
  "concert_id": 5,
  "concert_seats_created": 0  // ❌
}
```

**Causa:**
El venue no tiene secciones o las secciones no tienen asientos.

**Diagnóstico:**
```sql
-- Ver secciones del venue
SELECT * FROM venue_sections WHERE venue_id = 1;

-- Ver asientos de las secciones
SELECT vs.id as section_id, vs.name, COUNT(s.id) as total_asientos
FROM venue_sections vs
LEFT JOIN seats s ON s.section_id = vs.id
WHERE vs.venue_id = 1
GROUP BY vs.id, vs.name;
```

**Solución:**
```
Si no hay secciones:
1. Ejecutar 2.4 Create Section
   → Esto crea la sección Y los asientos

Si hay secciones pero sin asientos:
1. Ejecutar script manual:
   INSERT INTO seats (section_id, seat_number)
   SELECT 1, generate_series(1, 100);
```

---

### Problema: Orden confirmada pero sin tickets 🎟️

**Síntomas:**
```sql
SELECT * FROM tickets WHERE order_id = 25;
-- 0 filas
```

**Diagnóstico:**
```sql
-- Ver status de la orden
SELECT o.*, sg.descripcion as status
FROM orders o
JOIN status_generales sg ON sg.id = o.status_id
WHERE o.id = 25;

-- Ver si hay errores en logs
-- (revisar consola del servidor)
```

**Posibles causas:**

1. **Función generateTicketCode() falló:**
   - Ver logs del servidor
   - Verificar que `Math.random()` funciona

2. **Status "issued" no existe:**
   ```sql
   SELECT * FROM status_generales 
   WHERE dominio = 'ticket' AND descripcion = 'issued';
   ```

**Solución:**
```sql
-- Insertar status si falta
INSERT INTO status_generales (dominio, descripcion, activo)
VALUES ('ticket', 'issued', true);

-- Luego re-confirmar orden
-- (primero cambiar status a pending)
UPDATE orders 
SET status_id = (SELECT id FROM status_generales WHERE dominio = 'order' AND descripcion = 'pending')
WHERE id = 25;
```

---

### Problema: RabbitMQ - Mensajes no se consumen 🐰

**Síntomas:**
- Mensajes quedan en "Ready" state
- No se eliminan después de confirmar orden

**Verificar:**
```bash
# Management UI: http://localhost:15672
# Queues → CARRITO_QUEUE → Messages
```

**Causa:**
El consumer de RabbitMQ no está corriendo o tiene error.

**Solución:**

1. **Verificar que el consumer está activo:**
   ```bash
   # Ver procesos de Node.js
   ps aux | grep node
   
   # Debe haber un proceso: "consumer.js" o similar
   ```

2. **Reiniciar consumer:**
   ```bash
   # Detener
   pm2 stop rabbitmq-consumer
   
   # Iniciar
   pm2 start rabbitmq-consumer
   ```

3. **Ver logs del consumer:**
   ```bash
   pm2 logs rabbitmq-consumer
   ```

4. **Consumir manualmente (testing):**
   ```javascript
   // En el código del microservicio
   channel.consume('CARRITO_QUEUE', (msg) => {
     const data = JSON.parse(msg.content.toString());
     console.log('Mensaje recibido:', data);
     channel.ack(msg); // Marcar como procesado
   });
   ```

---

### Problema: Redis no cachea catálogos 📦

**Síntomas:**
- Requests lentas
- `KEYS *` en Redis retorna 0 keys

**Verificar:**
```bash
docker exec -it <redis-container> redis-cli
PING
# Debe responder: PONG
```

**Causa:**
Redis no está conectado o no se están guardando las keys.

**Solución:**

1. **Verificar conexión en código:**
   ```javascript
   // En el microservicio
   const redis = require('redis');
   const client = redis.createClient({
     host: 'localhost',
     port: 6379
   });
   
   client.on('connect', () => {
     console.log('✅ Redis conectado');
   });
   ```

2. **Verificar que se llama a SET:**
   ```javascript
   // Ejemplo de cachear venues
   const venues = await Venue.findAll();
   await client.set('catalog:venues', JSON.stringify(venues), 'EX', 3600);
   ```

3. **Limpiar caché y re-testear:**
   ```redis
   FLUSHDB
   ```

---

## ✅ CHECKLIST FINAL

Antes de dar por completado el testing, verifica:

**Base de Datos:**
- [ ] Usuarios admin y user existen
- [ ] Al menos 1 venue con secciones
- [ ] Concert creado con concert_seats
- [ ] Ticket types creados
- [ ] Status_generales tiene todos los dominios

**APIs:**
- [ ] Login funciona y guarda token
- [ ] Crear concierto genera concert_seats
- [ ] Reserva crea reservation_seats
- [ ] Confirmar orden genera tickets con códigos únicos
- [ ] Asientos cambian de status correctamente

**Redis:**
- [ ] Conectado (PING responde PONG)
- [ ] Catálogos se cachean (KEYS catalog:*)

**RabbitMQ:**
- [ ] Colas RESERVA_QUEUE y CARRITO_QUEUE existen
- [ ] Mensajes se publican al reservar
- [ ] Mensajes se consumen al confirmar

**Flujo Completo:**
- [ ] Usuario puede registrarse
- [ ] Admin puede crear conciertos
- [ ] Usuario puede reservar tickets
- [ ] Usuario puede confirmar compra
- [ ] Tickets se generan con códigos únicos
- [ ] Emails se envían (o se registra la notificación)

---

## 📚 RECURSOS ADICIONALES

**Documentación:**
- PostgreSQL: https://www.postgresql.org/docs/
- Redis: https://redis.io/docs/
- RabbitMQ: https://www.rabbitmq.com/documentation.html
- Postman: https://learning.postman.com/

**Scripts SQL útiles:**
```sql
-- Ver resumen del sistema
SELECT 
    'Usuarios' as tabla, COUNT(*) as total FROM users
UNION ALL
SELECT 'Conciertos', COUNT(*) FROM concerts
UNION ALL
SELECT 'Órdenes confirmadas', COUNT(*) FROM orders WHERE status_id = (SELECT id FROM status_generales WHERE dominio = 'order' AND descripcion = 'confirmed')
UNION ALL
SELECT 'Tickets generados', COUNT(*) FROM tickets
UNION ALL
SELECT 'Reservas activas', COUNT(*) FROM reservations WHERE status_id = (SELECT id FROM status_generales WHERE dominio = 'reservation' AND descripcion = 'active');
```

---

## 🎉 CONCLUSIÓN

Esta guía cubre el flujo COMPLETO de testing de la aplicación de microservicios para reserva de tickets.

**Puntos clave:**
1. ⚡ Siempre empieza con Login (token requerido)
2. 🏗️ Setup de infraestructura (venues, secciones)
3. 🎵 Crear eventos (conciertos, ticket types)
4. 🛒 Proceso de compra (reservar, crear orden, confirmar)
5. 📧 Post-compra (emails, reportes)
6. 🔍 Verificar en BD, Redis y RabbitMQ

**Para cualquier problema:**
1. Revisar logs del servidor
2. Verificar datos en BD
3. Consultar sección de Troubleshooting

¡Feliz testing! 🚀