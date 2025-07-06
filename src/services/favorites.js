import { supabase } from './supabase';
import { getCurrentUser } from './auth';
import { getCachedData, invalidateCache } from './supabase';

/**
 * Récupère tous les réseaux favoris de l'utilisateur
 * @returns {Promise<Array>} Liste des réseaux favoris
 */
export const getFavoriteNetworks = async () => {
  const user = await getCurrentUser();
  if (!user) return [];

  return getCachedData('favoriteNetworks', { userId: user.id }, async () => {
    try {
      // 1. Récupérer les réseaux favoris avec leur date de création
      const { data: favoriteNetworks, error: favError } = await supabase
        .from('favorite_networks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (favError) throw favError;
      if (!favoriteNetworks || favoriteNetworks.length === 0) return [];

      // 2. Récupérer les informations des réseaux (pour la région)
      const networkIds = favoriteNetworks.map(network => network.network_id);
      const { data: networksData, error: networksError } = await supabase
        .from('networks')
        .select('network_id, region, network_name')
        .in('network_id', networkIds);

      if (networksError) throw networksError;

      // 3. Récupérer les informations des agences
      const { data: agencyData, error: agencyError } = await supabase
        .from('agency')
        .select('agency_id, network_id, agency_name, network_type')
        .in('network_id', networkIds);

      if (agencyError) throw agencyError;

      // 4. Combiner toutes les données
      const networksWithInfo = favoriteNetworks.map(network => {
        const networkInfo = networksData.find(n => n.network_id === network.network_id);
        const agencyInfo = agencyData.find(agency => agency.network_id === network.network_id);
        return {
          ...network,
          network_name: networkInfo?.network_name || 'Nom Inconnu',
          agency_name: agencyInfo?.agency_name || 'Inconnu',
          region: networkInfo?.region || '',
          network_type: agencyInfo?.network_type || null
        };
      });

      return networksWithInfo;
    } catch (error) {
      // console.error('Erreur lors de la récupération des réseaux favoris (fonction cachée):', error); // Debug
      return []; // Retourner un tableau vide en cas d'erreur pour éviter de casser le cache avec une erreur
    }
  });
};

/**
 * Ajoute un réseau aux favoris
 * @param {string} networkId - ID du réseau
 * @returns {Promise<Object>} Le réseau ajouté
 */
export const addFavoriteNetwork = async (networkId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Vous devez être connecté pour ajouter un favori');

  // Vérifier si le réseau est déjà en favori
  const { data: existing } = await supabase
    .from('favorite_networks')
    .select('*')
    .eq('user_id', user.id)
    .eq('network_id', networkId)
    .single();

  if (existing) return existing;

  // Ajouter le réseau aux favoris avec la date de création
  const { data, error } = await supabase
    .from('favorite_networks')
    .insert([{ 
      user_id: user.id, 
      network_id: networkId,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) throw error;
  invalidateCache('favoriteNetworks'); // Invalider le cache
  // Potentiellement invalider le cache pour isNetworkFavorite si vous l'utilisez intensivement et le mettez en cache
  // invalidateCache(`isFavorite_${networkId}`); 
  return data;
};

/**
 * Supprime un réseau des favoris
 * @param {string} networkId - ID du réseau
 * @returns {Promise<void>}
 */
export const removeFavoriteNetwork = async (networkId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Vous devez être connecté pour supprimer un favori');

  // Supprimer d'abord toutes les lignes favorites de ce réseau
  const { error: linesError } = await supabase
    .from('favorite_lines')
    .delete()
    .eq('user_id', user.id)
    .eq('network_id', networkId);

  if (linesError) throw linesError;

  // Puis supprimer le réseau des favoris
  const { error: networkError } = await supabase
    .from('favorite_networks')
    .delete()
    .eq('user_id', user.id)
    .eq('network_id', networkId);

  if (networkError) throw networkError;
  
  invalidateCache('favoriteNetworks'); // Invalider le cache
  // invalidateCache(`isFavorite_${networkId}`);
};

/**
 * Vérifie si un réseau est en favori
 * @param {string} networkId - ID du réseau
 * @returns {Promise<boolean>} True si le réseau est en favori
 */
export const isNetworkFavorite = async (networkId) => {
  const user = await getCurrentUser();
  if (!user) return false;

  // Optionnel: Mettre en cache cette fonction si elle est appelée très fréquemment
  // return getCachedData(`isFavorite_${networkId}`, { userId: user.id }, async () => {
    const { data, error } = await supabase
      .from('favorite_networks')
      .select('id')
      .eq('user_id', user.id)
      .eq('network_id', networkId)
      .single();

    // PGRST116 signifie "exact PgrstFormat specified but no rows found" - ce n'est pas une erreur ici.
    if (error && error.code !== 'PGRST116') throw error; 
    return !!data;
  // });
};

/**
 * Récupère toutes les lignes favorites de l'utilisateur
 * @param {string} networkId - ID du réseau (optionnel)
 * @returns {Promise<Array>} Liste des lignes favorites
 */
export const getFavoriteLines = async (networkId = null) => {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    // D'abord, récupérer les lignes favorites
    let query = supabase
      .from('favorite_lines')
      .select('*')
      .eq('user_id', user.id);

    if (networkId) {
      query = query.eq('network_id', networkId);
    }

    const { data: favoriteLines, error } = await query;

    if (error) throw error;
    if (!favoriteLines || favoriteLines.length === 0) return [];

    // Ensuite, récupérer les informations détaillées des lignes depuis la table routes
    // Pour chaque ligne favorite, on va chercher son nom long
    const lineIds = favoriteLines.map(line => line.line_id);
    const networkIds = [...new Set(favoriteLines.map(line => line.network_id))];

    const { data: routesData, error: routesError } = await supabase
      .from('routes')
      .select('route_id, route_long_name, network_id')
      .in('route_id', lineIds)
      .in('network_id', networkIds);

    if (routesError) {
      console.error('Erreur lors de la récupération des détails des lignes:', routesError);
      return favoriteLines;
    }

    // Fusionner les données pour avoir le route_long_name
    const enhancedFavoriteLines = favoriteLines.map(favLine => {
      const routeInfo = routesData.find(route => 
        route.route_id === favLine.line_id && 
        route.network_id === favLine.network_id
      );
      
      return {
        ...favLine,
        line_long_name: routeInfo ? routeInfo.route_long_name : undefined
      };
    });

    return enhancedFavoriteLines;
  } catch (error) {
    console.error('Erreur lors de la récupération des lignes favorites:', error);
    return [];
  }
};

/**
 * Ajoute une ligne aux favoris
 * @param {Object} line - Informations de la ligne
 * @returns {Promise<Object>} La ligne ajoutée
 */
export const addFavoriteLine = async (line) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Vous devez être connecté pour ajouter un favori');

  const { networkId, lineId, lineName, lineColor } = line;

  // Vérifier si la ligne est déjà en favori
  const { data: existing } = await supabase
    .from('favorite_lines')
    .select('*')
    .eq('user_id', user.id)
    .eq('network_id', networkId)
    .eq('line_id', lineId)
    .single();

  if (existing) return existing;

  // Ajouter la ligne aux favoris
  const { data, error } = await supabase
    .from('favorite_lines')
    .insert([{
      user_id: user.id,
      network_id: networkId,
      line_id: lineId,
      line_name: lineName,
      line_color: lineColor
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Supprime une ligne des favoris
 * @param {string} networkId - ID du réseau
 * @param {string} lineId - ID de la ligne
 * @returns {Promise<void>}
 */
export const removeFavoriteLine = async (networkId, lineId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Vous devez être connecté pour supprimer un favori');

  const { error } = await supabase
    .from('favorite_lines')
    .delete()
    .eq('user_id', user.id)
    .eq('network_id', networkId)
    .eq('line_id', lineId);

  if (error) throw error;
};

/**
 * Vérifie si une ligne est en favori
 * @param {string} networkId - ID du réseau
 * @param {string} lineId - ID de la ligne
 * @returns {Promise<boolean>} True si la ligne est en favori
 */
export const isLineFavorite = async (networkId, lineId) => {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('favorite_lines')
    .select('id')
    .eq('user_id', user.id)
    .eq('network_id', networkId)
    .eq('line_id', lineId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
};

/**
 * Récupère tous les arrêts favoris de l'utilisateur
 * @param {string} networkId - ID du réseau (optionnel)
 * @returns {Promise<Array>} Liste des arrêts favoris
 */
export const getFavoriteStops = async (networkId = null) => {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase
    .from('favorite_stops')
    .select('*')
    .eq('user_id', user.id);

  if (networkId) {
    query = query.eq('network_id', networkId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

/**
 * Ajoute un arrêt aux favoris
 * @param {Object} stop - Informations de l'arrêt
 * @returns {Promise<Object>} L'arrêt ajouté
 */
export const addFavoriteStop = async (stop) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Vous devez être connecté pour ajouter un favori');

  const { networkId, stopId, stopName, stopLat, stopLon } = stop;

  // Vérifier si l'arrêt est déjà en favori
  const { data: existing } = await supabase
    .from('favorite_stops')
    .select('*')
    .eq('user_id', user.id)
    .eq('network_id', networkId)
    .eq('stop_id', stopId)
    .single();

  if (existing) return existing;

  // Ajouter l'arrêt aux favoris
  const { data, error } = await supabase
    .from('favorite_stops')
    .insert([{
      user_id: user.id,
      network_id: networkId,
      stop_id: stopId,
      stop_name: stopName,
      stop_lat: stopLat,
      stop_lon: stopLon
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Supprime un arrêt des favoris
 * @param {string} networkId - ID du réseau
 * @param {string} stopId - ID de l'arrêt
 * @returns {Promise<void>}
 */
export const removeFavoriteStop = async (networkId, stopId) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Vous devez être connecté pour supprimer un favori');

  const { error } = await supabase
    .from('favorite_stops')
    .delete()
    .eq('user_id', user.id)
    .eq('network_id', networkId)
    .eq('stop_id', stopId);

  if (error) throw error;
};

/**
 * Vérifie si un arrêt est en favori
 * @param {string} networkId - ID du réseau
 * @param {string} stopId - ID de l'arrêt
 * @returns {Promise<boolean>} True si l'arrêt est en favori
 */
export const isStopFavorite = async (networkId, stopId) => {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('favorite_stops')
    .select('id')
    .eq('user_id', user.id)
    .eq('network_id', networkId)
    .eq('stop_id', stopId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}; 