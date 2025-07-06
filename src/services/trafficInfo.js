import { supabase } from './supabase';

/**
 * Récupère les informations de trafic actives pour un réseau et une date donnés
 * @param {string} networkId - Identifiant du réseau
 * @param {string} routeId - Identifiant de la ligne (optionnel)
 * @param {number} directionId - Identifiant de la direction (optionnel)
 * @param {Date} date - Date pour laquelle récupérer les infos
 * @returns {Promise<Array>} - Liste des informations de trafic actives
 */
export const getActiveTrafficInfo = async (networkId, routeId = null, directionId = null, date = new Date()) => {
  try {
    const dateStr = date.toISOString().split('T')[0];
    
    let query = supabase
      .from('traffic_info')
      .select('*')
      .eq('network_id', networkId)
      .eq('active', true)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr);
    
    // Filtrer par ligne si spécifiée
    if (routeId) {
      query = query.or(`route_id.is.null,route_id.eq.${routeId}`);
    }
    
    // Filtrer par direction si spécifiée
    if (directionId !== null) {
      query = query.or(`direction_id.is.null,direction_id.eq.${directionId}`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des informations de trafic:', error);
    return [];
  }
};

/**
 * Vérifie si un arrêt a des informations de trafic actives
 * @param {Array} trafficInfos - Liste des informations de trafic
 * @param {string} stopId - Identifiant de l'arrêt
 * @returns {Object|null} - Première information de trafic concernant cet arrêt, ou null
 */
export const getStopTrafficInfo = (trafficInfos, stopId) => {
  if (!trafficInfos || !trafficInfos.length || !stopId) return null;
  
  return trafficInfos.find(info => 
    info.stop_id === stopId || info.stop_id === null
  ) || null;
}; 