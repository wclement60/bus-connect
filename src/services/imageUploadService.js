import { supabase } from './supabase';

// Configuration
const BUCKET_NAME = 'uploads'; // Utiliser le bucket uploads existant
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

// Vérifier que le bucket existe
export const checkImageBucket = async () => {
  try {
    // Tester l'accès au bucket
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1 });
    
    if (error) {
      console.error('Bucket non accessible:', error);
      return false;
    }
    
    console.log('Bucket uploads accessible');
    return true;
  } catch (error) {
    console.error('Erreur lors de la vérification du bucket:', error);
    return false;
  }
};

// Valider le fichier
export const validateImageFile = (file) => {
  const errors = [];
  
  // Vérifier le type
  if (!ALLOWED_TYPES.includes(file.type)) {
    errors.push('Format non supporté. Utilisez JPG, PNG ou GIF.');
  }
  
  // Vérifier la taille
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`Fichier trop volumineux. Maximum ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Service d'upload d'images
export const uploadImage = async (file, userId) => {
  try {
    // Validation du fichier
    if (!file) {
      return { success: false, error: 'Aucun fichier sélectionné' };
    }

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Type de fichier non autorisé. Utilisez JPG, PNG ou GIF.' };
    }

    // Vérifier la taille (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { success: false, error: 'Fichier trop volumineux. Maximum 5MB.' };
    }

    // Générer un nom de fichier unique
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

    // Créer un chemin pour les images du forum
    const forumImagePath = `forum-images/${fileName}`;

    // Upload vers Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(forumImagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Erreur upload Supabase:', error);
      return { success: false, error: 'Erreur lors de l\'upload' };
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(forumImagePath);

    return {
      success: true,
      url: publicUrl,
      path: forumImagePath
    };

  } catch (error) {
    console.error('Erreur dans uploadImage:', error);
    return { success: false, error: 'Erreur inattendue lors de l\'upload' };
  }
};

// Supprimer une image
export const deleteImage = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Erreur suppression image:', error);
      return { success: false, error: 'Erreur lors de la suppression' };
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur dans deleteImage:', error);
    return { success: false, error: 'Erreur inattendue lors de la suppression' };
  }
};

// Vérifier le bucket au démarrage
checkImageBucket(); 