-- Créer le bucket uploads pour stocker les images du forum
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads', 
  true,
  5242880, -- 5MB en bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
);

-- Créer les politiques RLS pour permettre l'upload et la lecture
-- Politique pour permettre à tous les utilisateurs authentifiés d'uploader
CREATE POLICY "Allow authenticated users to upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'uploads' 
  AND auth.role() = 'authenticated'
);

-- Politique pour permettre à tous de lire les fichiers publics
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (
  bucket_id = 'uploads'
);

-- Politique pour permettre aux utilisateurs de supprimer leurs propres fichiers
CREATE POLICY "Allow users to delete own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
); 