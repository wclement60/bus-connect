-- Script SQL pour corriger les problèmes du forum
-- À exécuter dans Supabase SQL Editor

-- 1. Fonction pour incrémenter le compteur de vues (simplifiée)
CREATE OR REPLACE FUNCTION increment_post_view_count(post_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.forum_posts 
  SET view_count = view_count + 1 
  WHERE id = post_id;
$$;

-- 2. Vérifier que la table forum_likes existe bien
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'forum_likes') THEN
        -- Si la table n'existe pas, la créer
        CREATE TABLE public.forum_likes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
            post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
            reply_id UUID REFERENCES public.forum_replies(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT forum_likes_check CHECK (
                (post_id IS NOT NULL AND reply_id IS NULL) OR 
                (post_id IS NULL AND reply_id IS NOT NULL)
            ),
            UNIQUE(user_id, post_id),
            UNIQUE(user_id, reply_id)
        );
        
        -- Activer RLS
        ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;
        
        -- Politique pour que tout le monde puisse voir les likes
        CREATE POLICY "Everyone can view likes" ON public.forum_likes
            FOR SELECT USING (true);
        
        -- Politique pour que les users connectés gèrent leurs likes
        CREATE POLICY "Users can manage their own likes" ON public.forum_likes
            FOR ALL TO authenticated USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
            
        RAISE NOTICE 'Table forum_likes créée avec succès';
    ELSE
        RAISE NOTICE 'Table forum_likes existe déjà';
    END IF;
END
$$;

-- 3. Vérifier les permissions sur forum_likes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_likes TO authenticated;
GRANT SELECT ON public.forum_likes TO anon;

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_forum_likes_post_id ON public.forum_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_likes_reply_id ON public.forum_likes(reply_id);
CREATE INDEX IF NOT EXISTS idx_forum_likes_user_id ON public.forum_likes(user_id);

-- Vérification finale
SELECT 'Forum setup completed successfully!' as status; 