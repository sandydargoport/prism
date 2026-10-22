-- 0035_bus_trip_history.sql
--
-- What the arrival prediction learns from and is measured against, kept for
-- the history window after the trace itself is gone.
--
-- bus_trips is one summary row per route per day the provider reported a
-- trip, written once the day is over. `outcome` says whether the bus actually
-- ran, so a holiday or a cancelled trip is recorded as not having run instead
-- of as a trip that took no time. No coordinates and no names: the vehicle
-- number as reported, and the driver as a keyed hash.
--
-- bus_eta_snapshots records the projected arrival at the household's stop at
-- fixed lead times (20, 15, 10, 5 and 2 minutes). The actual arrival is not
-- copied here; it is read from bus_stop_visits, so there is one record of it.
--
-- Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS bus_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  route_id uuid NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  trip_date date NOT NULL,
  day_of_week integer NOT NULL,
  direction varchar(10),
  outcome varchar(10) NOT NULL,
  stops_visited integer NOT NULL,
  total_stops integer NOT NULL,
  -- Stops passed without the doors opening: fewer riders, a bus that makes up time.
  stops_skipped integer,
  started_at timestamp,
  finished_at timestamp,
  vehicle_key varchar(64),
  driver_key varchar(64),
  weather varchar(10),
  temperature_c real,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS bus_trips_route_date_idx ON bus_trips (route_id, trip_date);
CREATE INDEX IF NOT EXISTS bus_trips_trip_date_idx ON bus_trips (trip_date);

CREATE TABLE IF NOT EXISTS bus_eta_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  route_id uuid NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  trip_date date NOT NULL,
  stop_key varchar(128) NOT NULL,
  horizon_min integer NOT NULL,
  made_at timestamp NOT NULL,
  predicted_at timestamp NOT NULL,
  model varchar(20) DEFAULT 'planned' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS bus_eta_snapshots_route_date_stop_horizon_idx
  ON bus_eta_snapshots (route_id, trip_date, stop_key, horizon_min);
CREATE INDEX IF NOT EXISTS bus_eta_snapshots_trip_date_idx ON bus_eta_snapshots (trip_date);
