ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS default_network_id VARCHAR(255);

COMMENT ON COLUMN public.user_preferences.default_network_id IS 'The default network ID for the user.'; 