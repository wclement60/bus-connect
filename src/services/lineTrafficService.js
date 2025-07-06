// Service pour gérer les informations de trafic spécifiques aux lignes
import { supabase } from './supabase';

const API_BASE_URL = 'https://api.oisemob.cityway.fr/disrupt/api/v1/fr';

/**
 * Récupère le network_code pour un réseau donné
 * @param {string} networkId - L'ID du réseau (ex: "AXO")
 * @returns {Promise<number|null>} Le network_code ou null si non trouvé
 */
export const getNetworkCode = async (networkId) => {
  try {
    const { data, error } = await supabase
      .from('agency')
      .select('network_code')
      .eq('network_id', networkId)
      .limit(1)
      .single();

    if (error) {
      console.error('Erreur lors de la récupération du network_code:', error);
      return null;
    }

    return data?.network_code || null;
  } catch (error) {
    console.error('Erreur lors de la récupération du network_code:', error);
    return null;
  }
};

/**
 * Récupère les perturbations pour un réseau spécifique
 * @param {number} networkCode - Le code du réseau dans l'API (ex: 51 pour AXO)
 * @returns {Promise<Array>} Liste des perturbations
 */
export const getDisruptionsForNetwork = async (networkCode) => {
  try {
    const response = await fetch(`${API_BASE_URL}/disruptions`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    const allDisruptions = result.data || [];
    
    // Filtrer les perturbations pour le réseau spécifique
    const networkDisruptions = allDisruptions.filter(disruption => 
      disruption.affectedLines?.some(line => line.networkId === networkCode)
    );
    
    return networkDisruptions;
  } catch (error) {
    console.error('Erreur lors de la récupération des perturbations:', error);
    return [];
  }
};

/**
 * Récupère les perturbations pour une ligne spécifique
 * @param {string} networkId - L'ID du réseau (ex: "AXO")
 * @param {string} lineNumber - Le numéro de la ligne (ex: "B")
 * @returns {Promise<Array>} Liste des perturbations affectant cette ligne
 */
export const getDisruptionsForLine = async (networkId, lineNumber) => {
  try {
    // D'abord récupérer le network_code
    const networkCode = await getNetworkCode(networkId);
    if (!networkCode) {
      console.warn(`Aucun network_code trouvé pour le réseau ${networkId}`);
      return [];
    }

    // Récupérer les perturbations du réseau
    const networkDisruptions = await getDisruptionsForNetwork(networkCode);
    
    // Filtrer par ligne spécifique
    const lineDisruptions = networkDisruptions.filter(disruption =>
      disruption.affectedLines?.some(line => 
        line.networkId === networkCode && 
        (line.number === lineNumber || line.code === lineNumber)
      )
    );
    
    return lineDisruptions;
  } catch (error) {
    console.error('Erreur lors de la récupération des perturbations de ligne:', error);
    return [];
  }
};

/**
 * Vérifie si une perturbation est actuellement active
 * @param {Object} disruption - L'objet perturbation
 * @returns {boolean} True si la perturbation est active
 */
export const isDisruptionActive = (disruption) => {
  const now = new Date();
  const startDate = new Date(disruption.effectiveStartDate);
  const endDate = new Date(disruption.effectiveEndDate);
  
  return now >= startDate && now <= endDate;
};

/**
 * Formate une perturbation pour l'affichage dans les horaires
 * @param {Object} disruption - L'objet perturbation
 * @returns {Object} Perturbation formatée
 */
export const formatDisruptionForDisplay = (disruption) => {
  return {
    id: disruption.id,
    title: disruption.title,
    description: disruption.description,
    type: disruption.type,
    severity: disruption.severity,
    isActive: isDisruptionActive(disruption),
    startDate: disruption.effectiveStartDate,
    endDate: disruption.effectiveEndDate,
    affectedLines: disruption.affectedLines?.map(line => ({
      number: line.number,
      name: line.name,
      color: line.color
    })) || []
  };
};

/**
 * Récupère et formate les perturbations pour une ligne
 * @param {string} networkId - L'ID du réseau
 * @param {string} lineNumber - Le numéro de la ligne
 * @returns {Promise<Array>} Liste des perturbations formatées
 */
export const getFormattedDisruptionsForLine = async (networkId, lineNumber) => {
  try {
    const disruptions = await getDisruptionsForLine(networkId, lineNumber);
    return disruptions
      .filter(isDisruptionActive) // Ne garder que les perturbations actives
      .map(formatDisruptionForDisplay)
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)); // Trier par date récente
  } catch (error) {
    console.error('Erreur lors du formatage des perturbations:', error);
    return [];
  }
}; 