-- Migration pour créer les tables du forum
-- Exécuter ce script dans Supabase SQL Editor

-- 1. Table des catégories principales du forum
CREATE TABLE IF NOT EXISTS public.forum_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT, -- Nom de l'icône (ex: 'chat', 'info', 'help')
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 2. Table des sous-catégories du forum
CREATE TABLE IF NOT EXISTS public.forum_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.forum_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    UNIQUE(category_id, name)
);

-- 3. Table des sujets/posts du forum
CREATE TABLE IF NOT EXISTS public.forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcategory_id UUID REFERENCES public.forum_subcategories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_reply_at TIMESTAMPTZ DEFAULT NOW(),
    last_reply_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 4. Table des réponses/commentaires
CREATE TABLE IF NOT EXISTS public.forum_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
    parent_reply_id UUID REFERENCES public.forum_replies(id) ON DELETE CASCADE, -- Pour les réponses imbriquées
    content TEXT NOT NULL,
    author_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table pour les likes/reactions sur les posts et réponses
CREATE TABLE IF NOT EXISTS public.forum_likes (
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

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_forum_subcategories_category_id ON public.forum_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_subcategory_id ON public.forum_posts(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id ON public.forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_last_reply_at ON public.forum_posts(last_reply_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post_id ON public.forum_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author_id ON public.forum_replies(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_likes_post_id ON public.forum_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_likes_reply_id ON public.forum_likes(reply_id);

-- Fonctions pour mettre à jour automatiquement les timestamps
CREATE OR REPLACE FUNCTION update_forum_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at sur les posts
CREATE TRIGGER update_forum_posts_updated_at
    BEFORE UPDATE ON public.forum_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_forum_updated_at();

-- Trigger pour mettre à jour updated_at sur les réponses
CREATE TRIGGER update_forum_replies_updated_at
    BEFORE UPDATE ON public.forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_forum_updated_at();

-- Fonction pour mettre à jour last_reply_at sur les posts
CREATE OR REPLACE FUNCTION update_post_last_reply()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.forum_posts 
        SET last_reply_at = NEW.created_at,
            last_reply_by = NEW.author_id
        WHERE id = NEW.post_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour last_reply_at quand une nouvelle réponse est ajoutée
CREATE TRIGGER update_post_last_reply_trigger
    AFTER INSERT ON public.forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_post_last_reply();

-- Activer RLS sur toutes les tables
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour forum_categories
-- Lecture : Tout le monde peut voir les catégories actives
CREATE POLICY "Everyone can view active categories" ON public.forum_categories
    FOR SELECT USING (is_active = true);

-- Gestion : Seuls les admins (modtools = 1) peuvent créer/modifier/supprimer
CREATE POLICY "Admins can manage categories" ON public.forum_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND modtools = 1
        )
    );

-- Politiques RLS pour forum_subcategories
-- Lecture : Tout le monde peut voir les sous-catégories actives
CREATE POLICY "Everyone can view active subcategories" ON public.forum_subcategories
    FOR SELECT USING (is_active = true);

-- Gestion : Seuls les admins peuvent créer/modifier/supprimer
CREATE POLICY "Admins can manage subcategories" ON public.forum_subcategories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND modtools = 1
        )
    );

-- Politiques RLS pour forum_posts
-- Lecture : Tout le monde peut voir les posts
CREATE POLICY "Everyone can view posts" ON public.forum_posts
    FOR SELECT USING (true);

-- Création : Seuls les utilisateurs connectés peuvent créer des posts
CREATE POLICY "Authenticated users can create posts" ON public.forum_posts
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- Mise à jour : Les auteurs peuvent modifier leurs posts, les admins peuvent tout modifier
CREATE POLICY "Authors and admins can update posts" ON public.forum_posts
    FOR UPDATE USING (
        auth.uid() = author_id OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND modtools = 1
        )
    );

-- Suppression : Seuls les admins peuvent supprimer
CREATE POLICY "Admins can delete posts" ON public.forum_posts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND modtools = 1
        )
    );

-- Politiques RLS pour forum_replies
-- Lecture : Tout le monde peut voir les réponses
CREATE POLICY "Everyone can view replies" ON public.forum_replies
    FOR SELECT USING (true);

-- Création : Seuls les utilisateurs connectés peuvent créer des réponses
CREATE POLICY "Authenticated users can create replies" ON public.forum_replies
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- Mise à jour : Les auteurs peuvent modifier leurs réponses, les admins peuvent tout modifier
CREATE POLICY "Authors and admins can update replies" ON public.forum_replies
    FOR UPDATE USING (
        auth.uid() = author_id OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND modtools = 1
        )
    );

-- Suppression : Seuls les admins peuvent supprimer
CREATE POLICY "Admins can delete replies" ON public.forum_replies
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND modtools = 1
        )
    );

-- Politiques RLS pour forum_likes
-- Lecture : Tout le monde peut voir les likes (pour compter)
CREATE POLICY "Everyone can view likes" ON public.forum_likes
    FOR SELECT USING (true);

-- Gestion : Seuls les utilisateurs connectés peuvent gérer leurs likes
CREATE POLICY "Users can manage their own likes" ON public.forum_likes
    FOR ALL TO authenticated USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Insérer quelques catégories par défaut
INSERT INTO public.forum_categories (name, description, icon, sort_order) VALUES
('Général', 'Discussions générales sur les transports', 'chat', 1),
('Aide et Support', 'Questions et assistance technique', 'help', 2),
('Suggestions', 'Vos idées d''amélioration', 'lightbulb', 3),
('Actualités', 'Informations sur les réseaux de transport', 'newspaper', 4)
ON CONFLICT (name) DO NOTHING;

-- Insérer quelques sous-catégories par défaut
INSERT INTO public.forum_subcategories (category_id, name, description, sort_order)
SELECT 
    c.id,
    sub.name,
    sub.description,
    sub.sort_order
FROM public.forum_categories c
CROSS JOIN (VALUES 
    ('Général', 'Discussions libres', 'Partagez vos expériences de transport', 1),
    ('Général', 'Horaires et trajets', 'Questions sur les horaires et itinéraires', 2),
    ('Aide et Support', 'Problèmes techniques', 'Signaler des bugs ou dysfonctionnements', 1),
    ('Aide et Support', 'Comment utiliser l''app', 'Aide pour utiliser l''application', 2),
    ('Suggestions', 'Nouvelles fonctionnalités', 'Proposez de nouvelles fonctionnalités', 1),
    ('Suggestions', 'Améliorations UI/UX', 'Suggestions d''amélioration de l''interface', 2),
    ('Actualités', 'Mises à jour', 'Annonces des nouvelles versions', 1),
    ('Actualités', 'Nouveaux réseaux', 'Annonces d''ajout de nouveaux réseaux', 2)
) sub(cat_name, name, description, sort_order)
WHERE c.name = sub.cat_name
ON CONFLICT (category_id, name) DO NOTHING;

-- Commentaires sur les tables
COMMENT ON TABLE public.forum_categories IS 'Catégories principales du forum';
COMMENT ON TABLE public.forum_subcategories IS 'Sous-catégories du forum';
COMMENT ON TABLE public.forum_posts IS 'Sujets/posts du forum';
COMMENT ON TABLE public.forum_replies IS 'Réponses aux posts du forum';
COMMENT ON TABLE public.forum_likes IS 'Likes sur les posts et réponses'; 