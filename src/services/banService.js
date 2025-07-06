import { supabase } from './supabase';

// Bannir un utilisateur
export const banUser = async (userId, banData) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Non autorisé');

    const { data, error } = await supabase
      .from('forum_bans')
      .insert({
        user_id: userId,
        banned_by: user.id,
        reason: banData.reason,
        message: banData.message,
        expires_at: banData.duration === 'permanent' ? null : banData.expires_at
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors du bannissement:', error);
    throw error;
  }
};

// Débannir un utilisateur
export const unbanUser = async (userId) => {
  try {
    const { error } = await supabase
      .from('forum_bans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erreur lors du débannissement:', error);
    throw error;
  }
};

// Obtenir la liste des bannissements actifs
export const getActiveBans = async () => {
  try {
    const { data, error } = await supabase
      .from('forum_bans')
      .select(`
        *,
        user:users!forum_bans_user_id_fkey(
          id,
          first_name,
          last_name,
          email,
          avatar_url
        ),
        banned_by_user:users!forum_bans_banned_by_fkey(
          first_name,
          last_name
        )
      `)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération des bannissements:', error);
    throw error;
  }
};

// Obtenir l'historique des bannissements d'un utilisateur
export const getUserBanHistory = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('forum_bans')
      .select(`
        *,
        banned_by_user:users!forum_bans_banned_by_fkey(
          first_name,
          last_name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    throw error;
  }
};

// Vérifier si un utilisateur est banni
export const checkUserBanned = async (userId) => {
  try {
    const { data, error } = await supabase
      .rpc('is_user_banned', { p_user_id: userId });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la vérification du bannissement:', error);
    return false;
  }
};

// Obtenir les détails du bannissement actif
export const getActiveBan = async (userId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_active_ban', { p_user_id: userId });

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Erreur lors de la récupération du bannissement actif:', error);
    return null;
  }
}; 