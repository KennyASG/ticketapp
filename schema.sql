-- ============================
--  Creación de la DB
-- ============================

-- CREATE DATABASE ticketapp;
-- \c ticketapp;

-- ============================
--  Tabla centralizada de estados
-- ============================
CREATE TABLE IF NOT EXISTS status_generales (
  id SERIAL PRIMARY KEY,
  dominio VARCHAR(50) NOT NULL,
  descripcion VARCHAR(50) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (dominio, descripcion)
);

-- ============================
--  Roles y usuarios
-- ============================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    description VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token VARCHAR(6) NOT NULL DEFAULT '000000',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================
--  Venues, secciones y asientos
-- ============================
CREATE TABLE venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(250),
    city VARCHAR(120),
    country VARCHAR(120),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE venue_sections (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (venue_id, name),
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);

-- Asientos físicos en cada sección
CREATE TABLE seats (
    id SERIAL PRIMARY KEY,
    section_id INTEGER NOT NULL,
    seat_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES venue_sections(id) ON DELETE CASCADE,
    UNIQUE (section_id, seat_number)
);

-- ============================
--  Conciertos y relación con venues
-- ============================
CREATE TABLE concerts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(200) NOT NULL,
    date TIMESTAMP NOT NULL,
    status_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

CREATE TABLE concert_venue_detail (
    id SERIAL PRIMARY KEY,
    concert_id INTEGER NOT NULL,
    venue_id INTEGER NOT NULL,
    UNIQUE (concert_id, venue_id),
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);

-- Proyección de asientos en un concierto específico
CREATE TABLE concert_seats (
    id SERIAL PRIMARY KEY,
    concert_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES status_generales(id),
    UNIQUE (concert_id, seat_id)
);

-- ============================
--  Tipos de tickets
-- ============================
CREATE TABLE ticket_types (
    id SERIAL PRIMARY KEY,
    concert_id INTEGER NOT NULL,
    section_id INTEGER NULL,
    name VARCHAR(100) NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    available INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES venue_sections(id) ON DELETE SET NULL
);

-- ============================
--  Reservas temporales
-- ============================
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    concert_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

-- ============================
--  Órdenes y detalle
-- ============================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    concert_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    ticket_type_id INTEGER NOT NULL,
    seat_id INTEGER NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE SET NULL
);

-- ============================
--  Tickets emitidos
-- ============================
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    ticket_type_id INTEGER NOT NULL,
    seat_id INTEGER NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    status_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE SET NULL,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

-- ============================
--  Pagos
-- ============================
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    provider VARCHAR(50) DEFAULT 'mock',
    amount INTEGER NOT NULL CHECK (amount >= 0),
    status_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

-- ============================
--  Notificaciones
-- ============================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    order_id INTEGER,
    type VARCHAR(30) NOT NULL CHECK (type IN ('send_tickets','send_confirmation')),
    status_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

-- ============================
-- Estados para CONCERTS
-- ============================
INSERT INTO status_generales (dominio, descripcion, activo) VALUES
('concert', 'scheduled', TRUE),
('concert', 'on_sale', TRUE),
('concert', 'sold_out', TRUE),
('concert', 'completed', TRUE),
('concert', 'canceled', TRUE);

-- ============================
-- Estados para ORDERS
-- ============================
INSERT INTO status_generales (dominio, descripcion, activo) VALUES
('order', 'pending', TRUE),
('order', 'confirmed', TRUE),
('order', 'canceled', TRUE),
('order', 'failed', TRUE);

-- ============================
-- Estados para TICKETS
-- ============================
INSERT INTO status_generales (dominio, descripcion, activo) VALUES
('ticket', 'issued', TRUE),
('ticket', 'redeemed', TRUE),
('ticket', 'canceled', TRUE);

-- ============================
-- Estados para PAYMENTS
-- ============================
INSERT INTO status_generales (dominio, descripcion, activo) VALUES
('payment', 'created', TRUE),
('payment', 'authorized', TRUE),
('payment', 'captured', TRUE),
('payment', 'failed', TRUE);

-- ============================
-- Estados para RESERVATIONS
-- ============================
INSERT INTO status_generales (dominio, descripcion, activo) VALUES
('reservation', 'held', TRUE),
('reservation', 'expired', TRUE),
('reservation', 'confirmed', TRUE),
('reservation', 'canceled', TRUE);

-- ============================
-- Estados para SEATS
-- ============================
INSERT INTO status_generales (dominio, descripcion, activo) VALUES
('seat', 'available', TRUE),
('seat', 'reserved', TRUE),
('seat', 'occupied', TRUE);

-- ============================
-- Estados para NOTIFICATIONS
-- ============================
INSERT INTO status_generales (dominio, descripcion, activo) VALUES
('notification', 'queued', TRUE),
('notification', 'sent', TRUE),
('notification', 'failed', TRUE);



-- INSERCION INICIAL
-- ============================
-- INSERTS DE DATOS INICIALES
-- ============================

-- ============================
-- 1. ROLES
-- ============================
INSERT INTO roles (description) VALUES
('admin'),
('user');

-- ============================
-- 2. USUARIOS
-- ============================
-- Nota: Las contraseñas deben ser hasheadas antes de insertar
-- Estos son ejemplos con hashes de bcrypt para:
-- admin123: $2b$10$XqQjK6Z9X8yXZ9X8yXZ9Xe...
-- user123: $2b$10$YrRkL7A0Y9zYA0Y9zYA0Yf...
-- Deberás reemplazarlos con los hashes reales generados con bcrypt

INSERT INTO users (name, email, password, role_id) VALUES
('Admin', 'admin@example.com', '$2b$10$XqQjK6Z9X8yXZ9X8yXZ9XeuKVzW6Qq6Qq6Qq6Qq6Qq6Qq6Qq6Qq6Q', 1),
('Juan Pérez', 'juan@example.com', '$2b$10$YrRkL7A0Y9zYA0Y9zYA0YfvLW7X7Rr7Rr7Rr7Rr7Rr7Rr7Rr7Rr7R', 2),
('María López', 'maria@example.com', '$2b$10$YrRkL7A0Y9zYA0Y9zYA0YfvLW7X7Rr7Rr7Rr7Rr7Rr7Rr7Rr7Rr7R', 2);

-- ============================
-- 3. VENUES
-- ============================
INSERT INTO venues (name, address, city, country) VALUES
('Estadio Nacional', 'Av. Principal 123', 'Guatemala City', 'Guatemala'),
('Arena VIP', 'Zona 10, Calle 45', 'Guatemala City', 'Guatemala');

-- ============================
-- 4. SECCIONES DE VENUES
-- ============================
INSERT INTO venue_sections (venue_id, name, capacity) VALUES
(1, 'VIP', 100),
(1, 'General', 500),
(2, 'Premium', 50);

-- ============================
-- 5. ASIENTOS
-- ============================
-- Asientos VIP (sección 1): 100 asientos
INSERT INTO seats (section_id, seat_number)
SELECT 1, generate_series(1, 100);

-- Asientos General (sección 2): 500 asientos
INSERT INTO seats (section_id, seat_number)
SELECT 2, generate_series(1, 500);

-- Asientos Premium (sección 3): 50 asientos
INSERT INTO seats (section_id, seat_number)
SELECT 3, generate_series(1, 50);

-- ============================
-- 6. CONCIERTOS
-- ============================
-- Obtener el ID del estado 'on_sale' para concerts
INSERT INTO concerts (title, description, date, status_id) VALUES
('Rock en Español 2025', 'Los mejores exponentes del rock latino', '2025-12-15 20:00:00', 
  (SELECT id FROM status_generales WHERE dominio = 'concert' AND descripcion = 'on_sale')),
('Festival Electrónico', 'Una noche de música electrónica', '2025-11-20 22:00:00',
  (SELECT id FROM status_generales WHERE dominio = 'concert' AND descripcion = 'on_sale'));

-- ============================
-- 7. RELACIÓN CONCERT-VENUE
-- ============================
INSERT INTO concert_venue_detail (concert_id, venue_id) VALUES
(1, 1),
(2, 2);

-- ============================
-- 8. CONCERT SEATS
-- ============================
-- Asignar todos los asientos del Estadio Nacional (venue 1) al concierto 1
-- Esto incluye asientos VIP (sección 1) y General (sección 2)
INSERT INTO concert_seats (concert_id, seat_id, status_id)
SELECT 
  1 as concert_id,
  s.id as seat_id,
  (SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'available') as status_id
FROM seats s
INNER JOIN venue_sections vs ON s.section_id = vs.id
WHERE vs.venue_id = 1;

-- Asignar todos los asientos del Arena VIP (venue 2) al concierto 2
-- Esto incluye asientos Premium (sección 3)
INSERT INTO concert_seats (concert_id, seat_id, status_id)
SELECT 
  2 as concert_id,
  s.id as seat_id,
  (SELECT id FROM status_generales WHERE dominio = 'seat' AND descripcion = 'available') as status_id
FROM seats s
INNER JOIN venue_sections vs ON s.section_id = vs.id
WHERE vs.venue_id = 2;

-- ============================
-- 9. TIPOS DE TICKETS
-- ============================
INSERT INTO ticket_types (concert_id, section_id, name, price, available) VALUES
(1, 1, 'VIP - Rock en Español', 500, 100),
(1, 2, 'General - Rock en Español', 150, 500),
(2, 3, 'Premium - Festival Electrónico', 800, 50);

-- ============================
-- VERIFICACIÓN DE DATOS
-- ============================
-- Puedes ejecutar estos SELECT para verificar que todo se insertó correctamente

-- SELECT * FROM roles;
-- SELECT * FROM users;
-- SELECT * FROM venues;
-- SELECT * FROM venue_sections;
-- SELECT COUNT(*) FROM seats GROUP BY section_id;
-- SELECT * FROM concerts;
-- SELECT * FROM concert_venue_detail;
-- SELECT COUNT(*) FROM concert_seats GROUP BY concert_id;
-- SELECT * FROM ticket_types;