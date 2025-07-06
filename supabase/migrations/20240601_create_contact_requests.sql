-- Ce script est idempotent. Il peut être exécuté plusieurs fois sans causer d'erreur.

-- 1. Supprimer les anciennes politiques de sécurité (si elles existent)
DROP POLICY IF EXISTS "Anyone can submit a contact request" ON public.contact_requests;
DROP POLICY IF EXISTS "Users can view their own contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Admins can manage all contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Users can update their own read status" ON public.contact_requests;

-- 2. Supprimer la table si elle existe pour la recréer proprement
DROP TABLE IF EXISTS public.contact_requests;

-- 3. Créer la table des demandes de contact avec la structure correcte
CREATE TABLE public.contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    network_id TEXT, -- Peut être NULL si non spécifié
    object TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response TEXT, -- Réponse de l'administrateur
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_read_by_user BOOLEAN DEFAULT FALSE NOT NULL
);

-- 4. Ajouter des commentaires pour la clarté
COMMENT ON TABLE public.contact_requests IS 'Table pour stocker les soumissions du formulaire de contact.';
COMMENT ON COLUMN public.contact_requests.is_read_by_user IS 'Indique si la réponse de l''administrateur a été lue par l''utilisateur.';

-- 5. Activer la sécurité au niveau des lignes (RLS)
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- 6. Créer les politiques de sécurité
-- Les utilisateurs authentifiés et anonymes peuvent créer des demandes.
CREATE POLICY "Anyone can submit a contact request"
    ON public.contact_requests FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

-- Les utilisateurs authentifiés peuvent voir leurs propres demandes.
CREATE POLICY "Users can view their own contact requests"
    ON public.contact_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Les utilisateurs peuvent marquer les messages comme lus.
CREATE POLICY "Users can update their own read status"
    ON public.contact_requests FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Les administrateurs (modtools=1) ont un accès complet.
CREATE POLICY "Admins can manage all contact requests"
    ON public.contact_requests FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.modtools = 1
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.modtools = 1
        )
    );

-- 7. Recréer les index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_contact_requests_user_id ON public.contact_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at ON public.contact_requests(created_at DESC); 