-- Create the delayed_trips table
CREATE TABLE IF NOT EXISTS public.delayed_trips (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone DEFAULT now(),
    network_id text NOT NULL,
    trip_id text NOT NULL,
    delay_date date NOT NULL,
    delay_minutes integer NOT NULL,
    reason text DEFAULT 'Retard'
);

-- Set up RLS (Row Level Security) policies similar to cancelled_trips
ALTER TABLE public.delayed_trips ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users with modtools = 1
CREATE POLICY "Enable CRUD for users with modtools" ON public.delayed_trips
    USING (auth.uid() IN (SELECT id FROM users WHERE modtools = 1))
    WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE modtools = 1));

-- Create policy for authenticated users (SELECT only)
CREATE POLICY "Enable SELECT for authenticated users" ON public.delayed_trips
    FOR SELECT
    USING (true);

-- Add comment to the table
COMMENT ON TABLE public.delayed_trips IS 'Stores information about trips that have a delay applied'; 