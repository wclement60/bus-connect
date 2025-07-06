// Service pour gérer l'affichage de la modal de bienvenue
const APP_VERSION = 'v4.0.0'; // Version actuelle de l'application
const WELCOME_VERSION_KEY = 'bus_connect_welcome_version'; // Clé pour le localStorage

/**
 * Vérifie si la modal de bienvenue doit être affichée
 * @returns {boolean} True si la modal doit être affichée, false sinon
 */
export const shouldShowWelcomeModal = () => {
  // Récupérer la dernière version pour laquelle la modal a été affichée
  const lastShownVersion = localStorage.getItem(WELCOME_VERSION_KEY);
  
  // Si la version stockée est différente de la version actuelle, afficher la modal
  return lastShownVersion !== APP_VERSION;
};

/**
 * Marque la modal comme affichée pour la version actuelle
 */
export const markWelcomeModalAsShown = () => {
  localStorage.setItem(WELCOME_VERSION_KEY, APP_VERSION);
};

/**
 * Force l'affichage de la modal de bienvenue lors du prochain chargement
 */
export const resetWelcomeModal = () => {
  localStorage.removeItem(WELCOME_VERSION_KEY);
};

export default {
  shouldShowWelcomeModal,
  markWelcomeModalAsShown,
  resetWelcomeModal,
  APP_VERSION
}; 