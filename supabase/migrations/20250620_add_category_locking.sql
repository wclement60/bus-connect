-- Ajouter le champ is_locked aux catégories
ALTER TABLE forum_categories 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Ajouter le champ is_locked aux sous-catégories  
ALTER TABLE forum_subcategories
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Commenter pour décrire le champ
COMMENT ON COLUMN forum_categories.is_locked IS 'Si true, empêche la création de nouveaux posts dans cette catégorie';
COMMENT ON COLUMN forum_subcategories.is_locked IS 'Si true, empêche la création de nouveaux posts dans cette sous-catégorie'; 