-- Create the traffic_info table
CREATE TABLE IF NOT EXISTS public.traffic_info (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone DEFAULT now(),
    network_id text NOT NULL,
    route_id text,
    direction_id integer,
    stop_id text,
    type text NOT NULL CHECK (type IN ('Travaux', 'Arrêt non desservi', 'Information')),
    message text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    active boolean DEFAULT true
);

-- Set up RLS (Row Level Security) policies similar to other tables
ALTER TABLE public.traffic_info ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users with modtools = 1
CREATE POLICY "Enable CRUD for users with modtools" ON public.traffic_info
    USING (auth.uid() IN (SELECT id FROM users WHERE modtools = 1))
    WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE modtools = 1));

-- Create policy for authenticated users (SELECT only)
CREATE POLICY "Enable SELECT for authenticated users" ON public.traffic_info
    FOR SELECT
    USING (true);

-- Add comment to the table
COMMENT ON TABLE public.traffic_info IS 'Stores information about traffic conditions affecting stops or routes'; 