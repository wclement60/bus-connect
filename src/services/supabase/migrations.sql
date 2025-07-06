-- Drop existing tables if they exist
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS transfers CASCADE;
DROP TABLE IF EXISTS stop_times CASCADE;
DROP TABLE IF EXISTS stops CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS calendar_dates CASCADE;
DROP TABLE IF EXISTS calendar CASCADE;
DROP TABLE IF EXISTS agency CASCADE;
DROP TABLE IF EXISTS shapes CASCADE;
DROP TABLE IF EXISTS networks CASCADE;

-- Create networks table
CREATE TABLE networks (
    network_id TEXT PRIMARY KEY,
    network_name TEXT NOT NULL,
    network_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create agency table
CREATE TABLE agency (
    agency_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    agency_name TEXT NOT NULL,
    agency_url TEXT NOT NULL,
    agency_timezone TEXT NOT NULL,
    agency_lang TEXT,
    agency_phone TEXT,
    agency_fare_url TEXT,
    agency_email TEXT,
    PRIMARY KEY (agency_id, network_id)
);

-- Create calendar table
CREATE TABLE calendar (
    service_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    monday BOOLEAN NOT NULL,
    tuesday BOOLEAN NOT NULL,
    wednesday BOOLEAN NOT NULL,
    thursday BOOLEAN NOT NULL,
    friday BOOLEAN NOT NULL,
    saturday BOOLEAN NOT NULL,
    sunday BOOLEAN NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    PRIMARY KEY (service_id, network_id)
);

-- Create calendar_dates table
CREATE TABLE calendar_dates (
    service_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    date DATE NOT NULL,
    exception_type INTEGER NOT NULL,
    PRIMARY KEY (service_id, date, network_id)
);

-- Create routes table
CREATE TABLE routes (
    route_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    agency_id TEXT,
    route_short_name TEXT,
    route_long_name TEXT,
    route_desc TEXT,
    route_type INTEGER NOT NULL,
    route_url TEXT,
    route_color TEXT,
    route_text_color TEXT,
    PRIMARY KEY (route_id, network_id),
    FOREIGN KEY (agency_id, network_id) REFERENCES agency(agency_id, network_id)
);

-- Create stops table
CREATE TABLE stops (
    stop_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    stop_code TEXT,
    stop_name TEXT NOT NULL,
    stop_desc TEXT,
    stop_lat DECIMAL(9,6) NOT NULL,
    stop_lon DECIMAL(9,6) NOT NULL,
    zone_id TEXT,
    stop_url TEXT,
    location_type INTEGER,
    parent_station TEXT,
    wheelchair_boarding INTEGER,
    stop_timezone TEXT,
    PRIMARY KEY (stop_id, network_id)
);

-- Create stop_times table
CREATE TABLE stop_times (
    trip_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    arrival_time TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    stop_id TEXT,
    stop_sequence INTEGER NOT NULL,
    stop_headsign TEXT,
    pickup_type INTEGER,
    drop_off_type INTEGER,
    shape_dist_traveled DECIMAL(10,2),
    timepoint INTEGER,
    PRIMARY KEY (trip_id, stop_sequence, network_id),
    FOREIGN KEY (stop_id, network_id) REFERENCES stops(stop_id, network_id)
);

-- Create shapes table
CREATE TABLE shapes (
    shape_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    shape_pt_lat DECIMAL(9,6) NOT NULL,
    shape_pt_lon DECIMAL(9,6) NOT NULL,
    shape_pt_sequence INTEGER NOT NULL,
    shape_dist_traveled DECIMAL(10,2),
    PRIMARY KEY (shape_id, shape_pt_sequence, network_id)
);

-- Create transfers table
CREATE TABLE transfers (
    from_stop_id TEXT,
    to_stop_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    transfer_type INTEGER,
    min_transfer_time INTEGER,
    PRIMARY KEY (from_stop_id, to_stop_id, network_id),
    FOREIGN KEY (from_stop_id, network_id) REFERENCES stops(stop_id, network_id),
    FOREIGN KEY (to_stop_id, network_id) REFERENCES stops(stop_id, network_id)
);

-- Create trips table
CREATE TABLE trips (
    trip_id TEXT,
    network_id TEXT REFERENCES networks(network_id),
    route_id TEXT,
    service_id TEXT,
    trip_headsign TEXT,
    trip_short_name TEXT,
    direction_id INTEGER,
    block_id TEXT,
    shape_id TEXT,
    wheelchair_accessible INTEGER,
    bikes_allowed INTEGER,
    PRIMARY KEY (trip_id, network_id),
    FOREIGN KEY (route_id, network_id) REFERENCES routes(route_id, network_id),
    FOREIGN KEY (service_id, network_id) REFERENCES calendar(service_id, network_id)
); 