
-- ============================
--  Creacion de la DB
-- ============================

CREATE DATABASE IF NOT EXISTS ticketapp;    
USE ticketapp;

-- ============================
--  Tabla centralizada de estados
-- ============================
CREATE TABLE IF NOT EXISTS status_generales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dominio VARCHAR(50) NOT NULL,        -- entidad (concert, order, ticket, etc.)
  descripcion VARCHAR(50) NOT NULL,    -- valor (scheduled, pending, etc.)
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (dominio, descripcion)
);

-- ============================
--  Roles y usuarios
-- ============================
CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    description VARCHAR(20),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role_id     INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    user_id     INT NOT NULL,
    token       VARCHAR(6) NOT NULL DEFAULT '000000',
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================
--  Venues, secciones y asientos
-- ============================
CREATE TABLE venues (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(150) NOT NULL,
    address     VARCHAR(250),
    city        VARCHAR(120),
    country     VARCHAR(120),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE venue_sections (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    venue_id    INT NOT NULL,
    name        VARCHAR(100) NOT NULL,       -- VIP, General, etc.
    capacity    INTEGER NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (venue_id, name),
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);

-- Asientos físicos en cada sección
CREATE TABLE seats (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    section_id  INT NOT NULL,
    -- row_label   VARCHAR(10),   -- fila opcional (ej. A, B, C)
    seat_number INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (section_id) REFERENCES venue_sections(id) ON DELETE CASCADE,
    UNIQUE (section_id, seat_number)
);

-- ============================
--  Conciertos y relación con venues
-- ============================
CREATE TABLE concerts (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    title       VARCHAR(100) NOT NULL,
    description VARCHAR(200) NOT NULL,
    date        TIMESTAMP NOT NULL,
    status_id   INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

CREATE TABLE concert_venue_detail (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    concert_id  INT NOT NULL,
    venue_id    INT NOT NULL,
    UNIQUE (concert_id, venue_id),
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);

-- Proyección de asientos en un concierto específico
CREATE TABLE concert_seats (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    concert_id  INT NOT NULL,
    seat_id     INT NOT NULL,
    status_id   INT NOT NULL,
    updated_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES status_generales(id),
    UNIQUE (concert_id, seat_id)
);

-- ============================
--  Tipos de tickets
-- ============================
CREATE TABLE ticket_types (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    concert_id  INT NOT NULL,
    section_id  INT NULL,
    name        VARCHAR(100) NOT NULL,
    price       INTEGER NOT NULL CHECK (price >= 0),
    available   INTEGER NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES venue_sections(id) ON DELETE SET NULL
);

-- ============================
--  Reservas temporales
-- ============================
CREATE TABLE reservations (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    user_id     INT NOT NULL,
    concert_id  INT NOT NULL,
    status_id   INT NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

-- ============================
--  Órdenes y detalle
-- ============================
CREATE TABLE orders (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    user_id     INT NOT NULL,
    concert_id  INT NOT NULL,
    status_id   INT NOT NULL,
    total       INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

CREATE TABLE order_items (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    order_id     INT NOT NULL,
    ticket_type_id INT NOT NULL,
    seat_id      INT NULL, -- si es asiento numerado
    quantity     INTEGER NOT NULL CHECK (quantity > 0),
    unit_price   INTEGER NOT NULL CHECK (unit_price >= 0),
    created_at   TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE SET NULL
);

-- ============================
--  Tickets emitidos
-- ============================
CREATE TABLE tickets (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    order_id    INT NOT NULL,
    ticket_type_id INT NOT NULL,
    seat_id     INT NULL,
    code        VARCHAR(100) UNIQUE NOT NULL,
    status_id   INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE SET NULL,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

-- ============================
--  Pagos
-- ============================
CREATE TABLE payments (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    order_id    INT NOT NULL,
    provider    VARCHAR(50) DEFAULT 'mock',
    amount      INTEGER NOT NULL CHECK (amount >= 0),
    status_id   INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);

-- ============================
--  Notificaciones
-- ============================
CREATE TABLE notifications (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    user_id     INT NOT NULL,
    order_id    INT,
    type        VARCHAR(30) NOT NULL CHECK (type IN ('send_tickets','send_confirmation')),
    status_id   INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES status_generales(id)
);
