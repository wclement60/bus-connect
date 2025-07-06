import { supabase } from './supabase';

// ========== SERVICES POUR LES ALERTES PRIORITAIRES ==========

// Obtenir les alertes actives pour un utilisateur
export const getUserActiveAlerts = async (userId = null) => {
  try {
    const user = userId || (await supabase.auth.getUser()).data.user;
    if (!user) return [];

    const userIdToUse = userId || user.id;

    const { data, error } = await supabase
      .rpc('get_user_active_alerts', { p_user_id: userIdToUse });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des alertes:', error);
    throw error;
  }
};

// Créer une nouvelle alerte (admin seulement)
export const createPriorityAlert = async (alertData) => {
  try {
    const { data, error } = await supabase
      .rpc('create_priority_alert', {
        p_user_id: alertData.user_id,
        p_alert_type: alertData.alert_type,
        p_title: alertData.title,
        p_message: alertData.message,
        p_severity: alertData.severity || 'high',
        p_can_appeal: alertData.can_appeal !== false,
        p_expires_at: alertData.expires_at || null,
        p_metadata: alertData.metadata || {}
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la création de l\'alerte:', error);
    throw error;
  }
};

// Obtenir toutes les alertes (admin seulement)
export const getAllAlerts = async (filters = {}) => {
  try {
    let query = supabase
      .from('priority_alerts')
      .select(`
        *,
        user:users!priority_alerts_user_id_fkey(
          id,
          first_name,
          last_name,
          email,
          avatar_url
        ),
        created_by_user:users!priority_alerts_created_by_fkey(
          first_name,
          last_name
        ),
        resolved_by_user:users!priority_alerts_resolved_by_fkey(
          first_name,
          last_name
        )
      `);

    // Appliquer les filtres
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.alert_type) {
      query = query.eq('alert_type', filters.alert_type);
    }
    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des alertes admin:', error);
    throw error;
  }
};

// Marquer une alerte comme acquittée
export const acknowledgeAlert = async (alertId) => {
  try {
    const { data, error } = await supabase
      .from('priority_alerts')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de l\'acquittement de l\'alerte:', error);
    throw error;
  }
};

// Résoudre une alerte (admin seulement)
export const resolveAlert = async (alertId, adminResponse = null) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Non autorisé');

    const { data, error } = await supabase
      .from('priority_alerts')
      .update({ 
        is_active: false,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        metadata: adminResponse ? { admin_response: adminResponse } : {}
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la résolution de l\'alerte:', error);
    throw error;
  }
};

// Modifier une alerte (admin seulement)
export const updateAlert = async (alertId, updates) => {
  try {
    const { data, error } = await supabase
      .from('priority_alerts')
      .update(updates)
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la modification de l\'alerte:', error);
    throw error;
  }
};

// ========== SERVICES POUR LES APPELS ==========

// Créer un appel
export const createAppeal = async (alertId, appealData) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Non autorisé');

    const { data, error } = await supabase
      .from('alert_appeals')
      .insert({
        alert_id: alertId,
        user_id: user.id,
        reason: appealData.reason,
        additional_info: appealData.additional_info
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la création de l\'appel:', error);
    throw error;
  }
};

// Obtenir les appels pour un utilisateur
export const getUserAppeals = async (userId = null) => {
  try {
    const user = userId || (await supabase.auth.getUser()).data.user;
    if (!user) return [];

    const userIdToUse = userId || user.id;

    const { data, error } = await supabase
      .from('alert_appeals')
      .select(`
        *,
        alert:priority_alerts(
          id,
          title,
          alert_type,
          severity
        ),
        reviewed_by_user:users!alert_appeals_reviewed_by_fkey(
          first_name,
          last_name
        )
      `)
      .eq('user_id', userIdToUse)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des appels:', error);
    throw error;
  }
};

// Obtenir tous les appels (admin seulement)
export const getAllAppeals = async (filters = {}) => {
  try {
    let query = supabase
      .from('alert_appeals')
      .select(`
        *,
        user:users!alert_appeals_user_id_fkey(
          id,
          first_name,
          last_name,
          email,
          avatar_url
        ),
        alert:priority_alerts(
          id,
          title,
          alert_type,
          severity,
          message
        ),
        reviewed_by_user:users!alert_appeals_reviewed_by_fkey(
          first_name,
          last_name
        )
      `);

    // Appliquer les filtres
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des appels admin:', error);
    throw error;
  }
};

// Traiter un appel (admin seulement)
export const processAppeal = async (appealId, decision, adminResponse) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Non autorisé');

    const { data, error } = await supabase
      .from('alert_appeals')
      .update({
        status: decision, // 'approved' ou 'rejected'
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_response: adminResponse
      })
      .eq('id', appealId)
      .select()
      .single();

    if (error) throw error;

    // Si l'appel est approuvé, résoudre l'alerte
    if (decision === 'approved' && data.alert_id) {
      await resolveAlert(data.alert_id, 'Appel approuvé: ' + adminResponse);
    }

    return data;
  } catch (error) {
    console.error('Erreur lors du traitement de l\'appel:', error);
    throw error;
  }
};

// ========== SERVICES POUR LE TCHAT D'APPEL ==========

// Obtenir les messages d'un appel
export const getAppealMessages = async (appealId) => {
  try {
    const { data, error } = await supabase
      .from('alert_appeal_messages')
      .select(`
        *,
        sender:users!alert_appeal_messages_sender_id_fkey(
          id,
          first_name,
          last_name,
          avatar_url,
          modtools
        )
      `)
      .eq('appeal_id', appealId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    throw error;
  }
};

// Envoyer un message dans un appel
export const sendAppealMessage = async (appealId, message) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Non autorisé');

    // Vérifier si l'utilisateur est admin
    const { data: profile } = await supabase
      .from('users')
      .select('modtools')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.modtools === 1;

    const { data, error } = await supabase
      .from('alert_appeal_messages')
      .insert({
        appeal_id: appealId,
        sender_id: user.id,
        message: message,
        is_admin: isAdmin,
        read_by_user: !isAdmin, // L'utilisateur a lu son propre message
        read_by_admin: isAdmin   // L'admin a lu son propre message
      })
      .select(`
        *,
        sender:users!alert_appeal_messages_sender_id_fkey(
          id,
          first_name,
          last_name,
          avatar_url,
          modtools
        )
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    throw error;
  }
};

// Marquer les messages comme lus
export const markMessagesAsRead = async (appealId, isAdmin = false) => {
  try {
    const updateField = isAdmin ? 'read_by_admin' : 'read_by_user';
    
    const { error } = await supabase
      .from('alert_appeal_messages')
      .update({ [updateField]: true })
      .eq('appeal_id', appealId)
      .eq(updateField, false);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erreur lors du marquage des messages comme lus:', error);
    throw error;
  }
};

// Obtenir le nombre de messages non lus pour un appel
export const getUnreadMessageCount = async (appealId, isAdmin = false) => {
  try {
    const readField = isAdmin ? 'read_by_admin' : 'read_by_user';
    
    const { count, error } = await supabase
      .from('alert_appeal_messages')
      .select('*', { count: 'exact', head: true })
      .eq('appeal_id', appealId)
      .eq(readField, false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Erreur lors de la récupération du nombre de messages non lus:', error);
    return 0;
  }
};

// ========== FONCTIONS UTILITAIRES ==========

// Rechercher des utilisateurs pour créer des alertes
export const searchUsers = async (searchTerm) => {
  try {
    if (!searchTerm || searchTerm.length < 2) return [];

    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, avatar_url, modtools')
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la recherche d\'utilisateurs:', error);
    throw error;
  }
};

// Statistiques pour l'admin
export const getAlertStats = async () => {
  try {
    const { data: activeAlerts, error: activeError } = await supabase
      .from('priority_alerts')
      .select('severity', { count: 'exact', head: true })
      .eq('is_active', true);

    const { data: pendingAppeals, error: appealsError } = await supabase
      .from('alert_appeals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (activeError || appealsError) throw activeError || appealsError;

    return {
      activeAlerts: activeAlerts || 0,
      pendingAppeals: pendingAppeals || 0
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    return { activeAlerts: 0, pendingAppeals: 0 };
  }
}; 