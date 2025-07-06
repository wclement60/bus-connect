import { supabase } from './supabase';
import { getCachedData, invalidateCache } from './supabase';

/**
 * Inscrit un nouvel utilisateur avec un email et un mot de passe.
 * Gère le cas où l'utilisateur existe déjà.
 * @param {string} email - L'email de l'utilisateur
 * @param {string} password - Le mot de passe de l'utilisateur
 * @param {object} userData - Données optionnelles de l'utilisateur
 * @returns {Promise} - La promesse de la réponse de Supabase en cas de succès
 * @throws {Error} - Lance une erreur si l'utilisateur existe déjà ou si une autre erreur survient.
 */
export const signUp = async (email, password, userData = {}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData,
    },
  });

  if (error) {
    // Gérer les erreurs retournées par Supabase
    if (error.message.includes('User already registered') || error.message.includes('already registered')) {
      throw new Error('Un compte existe déjà avec cette adresse email.');
    }
    // Pour les autres erreurs (mot de passe trop court, etc.)
    throw new Error(error.message);
  }

  // Cas spécifique de Supabase : si un utilisateur existe mais n'a pas confirmé son email,
  // `signUp` peut ne pas renvoyer d'erreur, mais renvoyer un utilisateur sans session.
  // On traite ce cas comme un "utilisateur existant".
  if (data.user && !data.session) {
    throw new Error('Un compte existe déjà avec cette adresse email.');
  }
  
  // Si l'objet `user` est vide, c'est une anomalie.
  if (!data.user) {
    throw new Error("L'inscription a échoué pour une raison inconnue. Veuillez réessayer.");
  }

  // Créer le code de parrainage pour le nouvel utilisateur
  try {
    const { data: referralCodeData, error: referralError } = await supabase
      .rpc('create_referral_code_for_user', { user_id_param: data.user.id });
    
    if (referralError) {
      console.error('Erreur lors de la création du code de parrainage:', referralError);
      // On ne fait pas échouer l'inscription pour ça
    }
  } catch (referralErr) {
    console.error('Erreur lors de la création du code de parrainage:', referralErr);
    // On ne fait pas échouer l'inscription pour ça
  }

  // En cas de succès pour un nouvel utilisateur
  return data;
};

/**
 * Connecte un utilisateur avec un email et un mot de passe
 * @param {string} email - L'email de l'utilisateur
 * @param {string} password - Le mot de passe de l'utilisateur
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
};

/**
 * Déconnecte l'utilisateur actuellement connecté
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  invalidateCache('user');
  invalidateCache('profile');
  invalidateCache('preferences');
  if (error) throw error;
};

/**
 * Récupère l'utilisateur actuellement connecté
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const getCurrentUser = async () => {
  return getCachedData('user', {}, async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  });
};

/**
 * Récupère la session actuelle
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

/**
 * Met à jour le profil de l'utilisateur
 * @param {object} updates - Les mises à jour à appliquer au profil
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const updateProfile = async (updates) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Utilisateur non connecté');

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id);
  
  if (error) throw error;
  invalidateCache('profile');
  return { success: true };
};

/**
 * Récupère le profil de l'utilisateur actuel
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const getProfile = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  return getCachedData('profile', { userId: user.id }, async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  });
};

/**
 * Récupère les préférences de l'utilisateur actuel
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const getUserPreferences = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  return getCachedData('preferences', { userId: user.id }, async () => {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  });
};

/**
 * Met à jour les préférences de l'utilisateur
 * @param {object} updates - Les mises à jour à appliquer aux préférences
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const updateUserPreferences = async (updates) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Utilisateur non connecté');

  const prefs = await getUserPreferences();
  
  if (!prefs) {
    // Créer les préférences si elles n'existent pas
    const { error } = await supabase
      .from('user_preferences')
      .insert([{ user_id: user.id, ...updates }]);
    
    if (error) throw error;
  } else {
    // Mettre à jour les préférences existantes
    const { error } = await supabase
      .from('user_preferences')
      .update(updates)
      .eq('user_id', user.id);
    
    if (error) throw error;
  }
  invalidateCache('preferences');
};

/**
 * Réinitialise le mot de passe de l'utilisateur
 * @param {string} email - L'email de l'utilisateur
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const resetPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) throw error;
};

/**
 * Met à jour le mot de passe de l'utilisateur
 * @param {string} password - Le nouveau mot de passe
 * @returns {Promise} - La promesse de la réponse de Supabase
 */
export const updatePassword = async (password) => {
  const { error } = await supabase.auth.updateUser({
    password,
  });
  invalidateCache('user');
  if (error) throw error;
};

/**
 * Récupère les utilisateurs dont c'est l'anniversaire aujourd'hui
 * @returns {Promise} - La promesse de la liste des utilisateurs
 */
export const getTodayBirthdays = async () => {
  try {
    const { data, error } = await supabase
      .rpc('get_today_birthdays');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des anniversaires:', error);
    return [];
  }
}; 