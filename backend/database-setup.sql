-- Crear base de datos
CREATE DATABASE seguridad;

-- Conectar a la base de datos
\c seguridad;

-- Crear tabla usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'editor', 'lector')),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_fecha_creacion ON usuarios(fecha_creacion);

-- Insertar usuarios de ejemplo con contraseñas encriptadas (password123)
INSERT INTO usuarios (nombre, email, password, rol) VALUES
('Administrador Sistema', 'admin@sistema.com', '$2b$10$rOJ0hs3Z8x/CxAhxZQOYa.6h5Y5sV7XcQ4Y8n2cE1m3K8j6W9vU4K', 'admin'),
('Editor Principal', 'editor@sistema.com', '$2b$10$rOJ0hs3Z8x/CxAhxZQOYa.6h5Y5sV7XcQ4Y8n2cE1m3K8j6W9vU4K', 'editor'),
('Lector Demo', 'lector@sistema.com', '$2b$10$rOJ0hs3Z8x/CxAhxZQOYa.6h5Y5sV7XcQ4Y8n2cE1m3K8j6W9vU4K', 'lector'),
('Juan Pérez', 'juan.perez@email.com', '$2b$10$rOJ0hs3Z8x/CxAhxZQOYa.6h5Y5sV7XcQ4Y8n2cE1m3K8j6W9vU4K', 'editor'),
('María González', 'maria.gonzalez@email.com', '$2b$10$rOJ0hs3Z8x/CxAhxZQOYa.6h5Y5sV7XcQ4Y8n2cE1m3K8j6W9vU4K', 'lector');

-- Verificar que se crearon los datos
SELECT 
    id, 
    nombre, 
    email, 
    rol, 
    fecha_creacion 
FROM usuarios 
ORDER BY fecha_creacion DESC;

-- Mostrar estadísticas por rol
SELECT 
    rol, 
    COUNT(*) as cantidad 
FROM usuarios 
GROUP BY rol 
ORDER BY cantidad DESC;