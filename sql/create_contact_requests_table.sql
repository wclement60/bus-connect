-- Create contact_requests table for storing contact form submissions
CREATE TABLE IF NOT EXISTS public.contact_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    network_id TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    object TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'resolved', 'rejected')),
    admin_notes TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS contact_requests_user_id_idx ON public.contact_requests (user_id);

-- Create index on created_at for sorting by date
CREATE INDEX IF NOT EXISTS contact_requests_created_at_idx ON public.contact_requests (created_at);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS contact_requests_status_idx ON public.contact_requests (status);

-- Set up RLS (Row Level Security)
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Create policy for insertion (anyone can submit a contact request)
CREATE POLICY "Anyone can submit a contact request" 
    ON public.contact_requests FOR INSERT 
    TO authenticated, anon
    WITH CHECK (true);

-- Create policy for users to read their own contact requests
CREATE POLICY "Users can view their own contact requests" 
    ON public.contact_requests FOR SELECT 
    TO authenticated
    USING (user_id = auth.uid());

-- Create policy for admins to manage all contact requests
CREATE POLICY "Admins can manage all contact requests" 
    ON public.contact_requests FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND modtools = 1
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.contact_requests TO anon, authenticated;
GRANT ALL ON public.contact_requests TO service_role;

-- Add comment
COMMENT ON TABLE public.contact_requests IS 'Table for storing contact form submissions from users'; 