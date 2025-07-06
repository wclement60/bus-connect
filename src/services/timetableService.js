import { supabase, getCachedData, invalidateCache } from './supabase';

/**
 * Récupère tous les stop_times (avec pagination gérée en interne) pour une liste donnée d'arrêts et un réseau.
 * Les résultats sont mis en cache.
 * @param {string} networkId - L'ID du réseau.
 * @param {Array<string>} stopIdsArray - Un tableau d'IDs d'arrêts.
 * @returns {Promise<Array>} Liste des stop_times (trip_id, stop_id).
 */
export const fetchAllStopTimesForStops = async (networkId, stopIdsArray) => {
  if (!networkId || !stopIdsArray || stopIdsArray.length === 0) {
    return [];
  }

  // Trier les stopIds pour assurer une clé de cache cohérente
  const sortedStopIds = [...stopIdsArray].sort().join(',');
  const cacheKey = `allStopTimesForStops-${networkId}-${sortedStopIds}`;

  return getCachedData(cacheKey, { /* Les paramètres sont déjà dans la clé */ }, async () => {
    console.log(`[Cache Miss] Exécution de fetchAllStopTimesForStops pour network: ${networkId}, stops: ${sortedStopIds.substring(0,100)}...`);
    const allStopTimesEntries = [];
    let page = 0;
    const pageSize = 1000; // Limite Supabase par requête
    let moreDataToFetch = true;

    while (moreDataToFetch) {
      const { data: pageData, error: fetchError } = await supabase
        .from('stop_times')
        .select('trip_id, stop_id') // Uniquement les colonnes nécessaires
        .in('stop_id', stopIdsArray) // Utiliser le tableau original non trié pour la requête IN
        .eq('network_id', networkId)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        console.error(
          `Erreur lors de la récupération paginée des stop_times (page ${page}):`,
          fetchError
        );
        throw fetchError; // Propager l'erreur pour que getCachedData ne mette pas en cache un résultat partiel/erroné
      }

      if (pageData && pageData.length > 0) {
        allStopTimesEntries.push(...pageData);
      }

      if (!pageData || pageData.length < pageSize) {
        moreDataToFetch = false;
      }
      page++;
    }
    console.log(`fetchAllStopTimesForStops: ${allStopTimesEntries.length} entrées récupérées.`);
    return allStopTimesEntries;
  });
};

/**
 * Invalide le cache pour fetchAllStopTimesForStops.
 * @param {string} networkId
 * @param {Array<string>} stopIdsArray
 */
export const invalidateAllStopTimesCache = (networkId, stopIdsArray) => {
  if (!networkId || !stopIdsArray || stopIdsArray.length === 0) return;
  const sortedStopIds = [...stopIdsArray].sort().join(',');
  const cacheKey = `allStopTimesForStops-${networkId}-${sortedStopIds}`;
  invalidateCache(cacheKey);
  console.log(`Cache invalidé pour : ${cacheKey}`);
}; 