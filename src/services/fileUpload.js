import { supabase } from './supabase';

/**
 * Validates a file to ensure it's a safe image
 * @param {File} file - The file to validate
 * @returns {Promise<boolean>} - True if valid, throws error if invalid
 */
export const validateImageSecurity = async (file) => {
  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La taille maximale du fichier est de 5 Mo');
  }

  // Check file type using both MIME type and extension
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
  if (!validMimeTypes.includes(file.type)) {
    throw new Error('Format de fichier non supporté. Utilisez JPEG, PNG, JPG ou GIF.');
  }

  // Verify file extension
  const fileName = file.name.toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
  if (!validExtensions.some(ext => fileName.endsWith(ext))) {
    throw new Error('Extension de fichier non supportée');
  }

  // Use the browser's engine to verify it's a valid image by trying to load it.
  // This is more robust than checking file signatures (magic numbers).
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        resolve(true);
      };
      
      img.onerror = () => {
        reject(new Error("Le fichier n'est pas une image valide ou est corrompu."));
      };
      
      // Use base64 data URL instead of object URL for better mobile compatibility
      img.src = e.target.result;
    };
    
    reader.onerror = () => {
      reject(new Error("Erreur lors de la lecture du fichier."));
    };
    
    // Read the file as base64 data URL
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads a profile photo to Supabase storage
 * @param {File} file - The file to upload
 * @param {string} userId - The user ID to associate with the file
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export const uploadProfilePhoto = async (file, userId) => {
  // Validate file security
  await validateImageSecurity(file);

  try {
    // Generate a unique file name with user ID and timestamp
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    // Upload the file
    const { data, error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Erreur lors du téléchargement:', uploadError);
      
      if (uploadError.statusCode === 404) {
        throw new Error('Le bucket de stockage "user-avatars" n\'existe pas. Veuillez contacter l\'administrateur pour créer ce bucket.');
      }
      
      throw uploadError;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Deletes an old profile photo from Supabase storage
 * @param {string} fileUrl - The public URL of the file to delete
 * @returns {Promise<void>}
 */
export const deleteOldProfilePhoto = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    // Extract the file path from the URL
    const storageUrl = supabase.storage.from('user-avatars').getPublicUrl('').data.publicUrl;
    const filePath = fileUrl.replace(storageUrl, '');
    
    if (filePath) {
      // Delete the file
      const { error } = await supabase.storage
        .from('user-avatars')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting old profile photo:', error);
      }
    }
  } catch (error) {
    console.error('Error processing delete operation:', error);
  }
}; 