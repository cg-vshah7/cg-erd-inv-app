-- PostgreSQL initialization script
-- Runs once when the container is first created
-- Installs extensions required by the application

-- Trigram similarity search on serial_number (FR-016)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- UUID generation for all primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
