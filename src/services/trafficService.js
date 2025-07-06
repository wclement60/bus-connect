// Service pour gérer les informations de trafic depuis l'API Oise Mobilité
const API_BASE_URL = 'https://api.oisemob.cityway.fr/disrupt/api/v1/fr';

// Fonction pour récupérer toutes les perturbations
export const getDisruptions = async () => {
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
    return result.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des perturbations:', error);
    throw error;
  }
};

// Fonction pour formater la date
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const options = { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleString('fr-FR', options);
};

// Fonction pour obtenir la couleur de sévérité
export const getSeverityColor = (severity) => {
  switch (severity) {
    case 'high':
      return 'text-red-600 bg-red-50';
    case 'medium':
      return 'text-orange-600 bg-orange-50';
    case 'low':
      return 'text-yellow-600 bg-yellow-50';
    default:
      return 'text-blue-600 bg-blue-50';
  }
};

// Fonction pour obtenir l'icône du mode de transport
export const getTransportModeIcon = (mode) => {
  switch (mode) {
    case 'BUS':
      return '🚌';
    case 'TAD':
      return '🚖'; // Transport à la demande
    case 'TRAM':
      return '🚊';
    case 'METRO':
      return '🚇';
    case 'TRAIN':
      return '🚂';
    default:
      return '🚍';
  }
};

// Fonction pour obtenir l'icône de l'effet
export const getEffectIcon = (effectCode) => {
  switch (effectCode) {
    case 'ModifiedSchedule':
      return '🕐';
    case 'NoService':
      return '❌';
    case 'ReducedService':
      return '⚠️';
    case 'Detour':
      return '↩️';
    case 'OtherEffect':
    default:
      return 'ℹ️';
  }
};

// Fonction pour grouper les perturbations par réseau
export const groupDisruptionsByNetwork = (disruptions) => {
  const grouped = {};
  
  disruptions.forEach(disruption => {
    // Récupérer tous les réseaux uniques affectés
    const networks = new Set();
    disruption.affectedLines?.forEach(line => {
      if (line.networkName) {
        networks.add(line.networkName);
      }
    });
    
    // Ajouter la perturbation à chaque réseau concerné
    networks.forEach(networkName => {
      if (!grouped[networkName]) {
        grouped[networkName] = [];
      }
      grouped[networkName].push(disruption);
    });
  });
  
  return grouped;
};

// Fonction pour vérifier si une perturbation est active
export const isDisruptionActive = (disruption) => {
  const now = new Date();
  const start = new Date(disruption.effectiveStartDate);
  const end = new Date(disruption.effectiveEndDate);
  return now >= start && now <= end;
};

// Fonction pour filtrer les perturbations par recherche
export const filterDisruptions = (disruptions, searchTerm) => {
  if (!searchTerm) return disruptions;
  
  const search = searchTerm.toLowerCase();
  return disruptions.filter(disruption => {
    // Recherche dans le titre
    if (disruption.title?.toLowerCase().includes(search)) return true;
    
    // Recherche dans la description
    if (disruption.description?.toLowerCase().includes(search)) return true;
    
    // Recherche dans les lignes affectées
    return disruption.affectedLines?.some(line => 
      line.name?.toLowerCase().includes(search) ||
      line.number?.toLowerCase().includes(search) ||
      line.networkName?.toLowerCase().includes(search)
    );
  });
};

// Fonction pour compter le nombre de perturbations actives
export const getActiveDisruptionsCount = async () => {
  try {
    const disruptions = await getDisruptions();
    const activeDisruptions = disruptions.filter(disruption => isDisruptionActive(disruption));
    return activeDisruptions.length;
  } catch (error) {
    console.error('Erreur lors du comptage des perturbations:', error);
    return 0;
  }
}; 