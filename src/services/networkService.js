import { supabase, getCachedData, invalidateCache } from './supabase';

/**
 * Récupère tous les réseaux avec les détails de l'agence et les informations de favori.
 * Les données sont mises en cache. Jointure manuelle en JS pour plus de robustesse.
 * @param {Array} favoriteNetworkIds - Optionnel. Liste des IDs des réseaux favoris pour marquer les réseaux.
 * @returns {Promise<Array>} Liste des réseaux avec détails.
 */
export const getAllNetworksWithDetails = async (favoriteNetworkIds = []) => {
  // Utilisation d'une nouvelle clé de cache pour refléter la nouvelle logique de jointure
  return getCachedData('allNetworksWithAgencyJoin', { favIds: JSON.stringify(favoriteNetworkIds.sort()) }, async () => {
    try {
      const { data: networksData, error: networksError } = await supabase
        .from('networks')
        .select('*') // Sélectionner toutes les colonnes de networks
        .order('network_name', { ascending: true });

      if (networksError) {
        console.error("Erreur lors de la récupération des réseaux (service - step 1):", networksError);
        throw networksError;
      }

      if (!networksData || networksData.length === 0) {
        return [];
      }

      // Récupérer toutes les agences pour la jointure.
      // Note: si la table agency est très volumineuse, cela pourrait être moins performant.
      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agency')
        .select('agency_id, network_id, agency_name, network_type'); // Champs nécessaires

      if (agenciesError) {
        console.error("Erreur lors de la récupération des agences (service - step 2):", agenciesError);
        // Continuer sans les données d'agence si la récupération échoue,
        // agency_name sera 'Inconnu' pour ces cas.
      }

      // Enrichir les données des réseaux avec les informations de l'agence et le statut de favori
      const networksWithDetails = networksData.map(network => {
        const matchingAgency = agenciesData?.find(
          agency => String(agency.network_id) === String(network.network_id) // Jointure sur network_id
        );
        return {
          ...network,
          agency_name: matchingAgency?.agency_name || 'Inconnu',
          network_type: matchingAgency?.network_type || null,
          is_favorite: favoriteNetworkIds.includes(network.network_id)
        };
      });
      
      return networksWithDetails;
    } catch (error) {
      console.error('Erreur dans getAllNetworksWithDetails (manual join):', error);
      return []; // Retourner un tableau vide en cas d'erreur pour la stabilité du cache
    }
  });
};

/**
 * Invalide le cache pour tous les réseaux.
 * Utile si les données des réseaux ou des agences sont modifiées de manière globale.
 */
export const invalidateAllNetworksCache = () => {
  invalidateCache('allNetworksWithAgencyJoin'); // Utiliser la nouvelle clé de cache
}; 