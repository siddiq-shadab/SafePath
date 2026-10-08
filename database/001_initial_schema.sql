-- ============================================================
-- SafePath
-- Initial PostgreSQL + PostGIS Schema
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- Vehicle Type
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'vehicle_type'
    ) THEN
        CREATE TYPE vehicle_type AS ENUM (
            'CAR',
            'VIP',
            'POLICE',
            'FIRE_ENGINE',
            'AMBULANCE'
        );
    END IF;
END
$$;

-- ============================================================
-- Vehicles
-- Current state of every SafePath vehicle
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_id VARCHAR(100) NOT NULL UNIQUE,

    vehicle_type vehicle_type NOT NULL DEFAULT 'CAR',

    latitude DOUBLE PRECISION,

    longitude DOUBLE PRECISION,

    speed DOUBLE PRECISION NOT NULL DEFAULT 0,

    heading DOUBLE PRECISION NOT NULL DEFAULT 0,

    accuracy DOUBLE PRECISION,

    current_location geometry(Point, 4326),

    last_online TIMESTAMPTZ,

    current_online BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vehicles_latitude_range
        CHECK (
            latitude IS NULL
            OR (
                latitude >= -90
                AND latitude <= 90
            )
        ),

    CONSTRAINT vehicles_longitude_range
        CHECK (
            longitude IS NULL
            OR (
                longitude >= -180
                AND longitude <= 180
            )
        ),

    CONSTRAINT vehicles_speed_non_negative
        CHECK (speed >= 0),

    CONSTRAINT vehicles_heading_range
        CHECK (
            heading >= 0
            AND heading < 360
        ),

    CONSTRAINT vehicles_accuracy_non_negative
        CHECK (
            accuracy IS NULL
            OR accuracy >= 0
        )
);

-- ============================================================
-- Vehicle Location History
-- Telemetry received from Flutter
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicle_locations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    vehicle_id UUID NOT NULL,

    latitude DOUBLE PRECISION NOT NULL,

    longitude DOUBLE PRECISION NOT NULL,

    position geometry(Point, 4326) NOT NULL,

    speed DOUBLE PRECISION NOT NULL DEFAULT 0,

    heading DOUBLE PRECISION NOT NULL DEFAULT 0,

    accuracy DOUBLE PRECISION,

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vehicle_locations_latitude_range
        CHECK (
            latitude >= -90
            AND latitude <= 90
        ),

    CONSTRAINT vehicle_locations_longitude_range
        CHECK (
            longitude >= -180
            AND longitude <= 180
        ),

    CONSTRAINT vehicle_locations_speed_non_negative
        CHECK (speed >= 0),

    CONSTRAINT vehicle_locations_heading_range
        CHECK (
            heading >= 0
            AND heading < 360
        ),

    CONSTRAINT vehicle_locations_accuracy_non_negative
        CHECK (
            accuracy IS NULL
            OR accuracy >= 0
        ),

    CONSTRAINT vehicle_locations_vehicle_fk
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id)
        ON DELETE CASCADE
);

-- ============================================================
-- Spatial indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vehicles_current_location
    ON vehicles
    USING GIST (current_location);

CREATE INDEX IF NOT EXISTS idx_vehicle_locations_position
    ON vehicle_locations
    USING GIST (position);

-- ============================================================
-- Vehicle lookup indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type
    ON vehicles(vehicle_type);

CREATE INDEX IF NOT EXISTS idx_vehicles_current_online
    ON vehicles(current_online);

CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id
    ON vehicle_locations(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_locations_recorded_at
    ON vehicle_locations(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_recorded
    ON vehicle_locations(vehicle_id, recorded_at DESC);

COMMIT;