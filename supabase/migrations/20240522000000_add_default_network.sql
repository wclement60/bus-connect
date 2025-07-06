-- Add default_network_id column to user profiles
ALTER TABLE public.profiles 
ADD COLUMN default_network_id text REFERENCES public.networks(network_id) ON DELETE SET NULL;

-- Add function to update default network
CREATE OR REPLACE FUNCTION public.set_default_network(
  user_id uuid,
  network_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET default_network_id = network_id
  WHERE id = user_id;
END;
$$; 