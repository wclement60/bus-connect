/**
 * Utilitaires pour gérer les modales et leur état dans localStorage
 */

// Clés localStorage pour les différentes modales
export const MODAL_KEYS = {
  REFERRAL_PROMOTION: 'hasSeenReferralPromo',
  WELCOME: 'welcomeModalShown_v4' // Clé pour la modal de bienvenue
};

/**
 * Réinitialise une modal spécifique
 * @param {string} modalKey - La clé de la modal à réinitialiser
 */
export const resetModal = (modalKey) => {
  localStorage.removeItem(modalKey);
  console.log(`✅ Modal "${modalKey}" réinitialisée`);
};

/**
 * Réinitialise toutes les modales
 */
export const resetAllModals = () => {
  Object.values(MODAL_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('✅ Toutes les modales ont été réinitialisées');
  console.log('🔄 Rechargez la page pour les voir réapparaître');
};

/**
 * Vérifie l'état d'une modal
 * @param {string} modalKey - La clé de la modal à vérifier
 * @returns {boolean} - true si la modal a été vue, false sinon
 */
export const hasSeenModal = (modalKey) => {
  return localStorage.getItem(modalKey) === 'true';
};

/**
 * Marque une modal comme vue
 * @param {string} modalKey - La clé de la modal à marquer
 */
export const markModalAsSeen = (modalKey) => {
  localStorage.setItem(modalKey, 'true');
};

/**
 * Affiche l'état de toutes les modales
 */
export const showModalStatus = () => {
  console.log('📊 État des modales :');
  Object.entries(MODAL_KEYS).forEach(([name, key]) => {
    const seen = hasSeenModal(key);
    console.log(`  ${name}: ${seen ? '✅ Vue' : '❌ Non vue'}`);
  });
};

// Fonctions spécifiques pour chaque modal
export const resetReferralModal = () => resetModal(MODAL_KEYS.REFERRAL_PROMOTION);
export const resetWelcomeModal = () => resetModal(MODAL_KEYS.WELCOME);

// Expose les fonctions globalement pour la console
if (typeof window !== 'undefined') {
  window.modalUtils = {
    resetReferralModal,
    resetWelcomeModal,
    resetAllModals,
    showModalStatus,
    resetModal,
    hasSeenModal,
    markModalAsSeen
  };
} 