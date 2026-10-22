-- 0034_live_vehicle_tracking.sql
--
-- Live bus positions from a provider that speaks the neutral contract
-- (src/lib/validations/liveVehicle.ts). vehicle_tracks is one vehicle on one
-- trip on one day, vehicle_fixes its positions; both are the exact trace and
-- are deleted after the trace retention window. bus_stop_visits holds the
-- arrival and departure times at each stop, kept for the longer history
-- window. bus_routes.live_match says which provider track belongs to a route.
--
-- Idempotent (safe to re-run).

ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS live_match jsonb;

CREATE TABLE IF NOT EXISTS vehicle_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  provider varchar(50) NOT NULL,
  external_key varchar(128) NOT NULL,
  trip_date date NOT NULL,
  direction varchar(10),
  label varchar(100),
  route_id uuid REFERENCES bus_routes(id) ON DELETE SET NULL,
  vehicle jsonb,
  stops jsonb DEFAULT '[]'::jsonb NOT NULL,
  planned_start timestamp,
  planned_end timestamp,
  status varchar(30),
  progress jsonb,
  weather jsonb,
  last_fix_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_tracks_provider_key_date_idx
  ON vehicle_tracks (provider, external_key, trip_date);
CREATE INDEX IF NOT EXISTS vehicle_tracks_trip_date_idx ON vehicle_tracks (trip_date);
CREATE INDEX IF NOT EXISTS vehicle_tracks_route_id_idx ON vehicle_tracks (route_id);

CREATE TABLE IF NOT EXISTS vehicle_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  track_id uuid NOT NULL REFERENCES vehicle_tracks(id) ON DELETE CASCADE,
  ts timestamp NOT NULL,
  received_at timestamp DEFAULT now() NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading real,
  speed real,
  moving boolean,
  door_open boolean,
  ignition boolean,
  event_id varchar(128) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_fixes_track_event_idx ON vehicle_fixes (track_id, event_id);
CREATE INDEX IF NOT EXISTS vehicle_fixes_track_ts_idx ON vehicle_fixes (track_id, ts);

CREATE TABLE IF NOT EXISTS bus_stop_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  route_id uuid NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  track_id uuid REFERENCES vehicle_tracks(id) ON DELETE SET NULL,
  trip_date date NOT NULL,
  day_of_week integer NOT NULL,
  stop_key varchar(128) NOT NULL,
  stop_order integer NOT NULL,
  kind varchar(10),
  planned_at timestamp,
  arrived_at timestamp,
  departed_at timestamp,
  source varchar(10) DEFAULT 'vendor' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS bus_stop_visits_route_date_stop_idx
  ON bus_stop_visits (route_id, trip_date, stop_key);
CREATE INDEX IF NOT EXISTS bus_stop_visits_trip_date_idx ON bus_stop_visits (trip_date);
