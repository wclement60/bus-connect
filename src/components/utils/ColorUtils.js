/**
 * Fonctions utilitaires pour la manipulation des couleurs
 */

/**
 * Détermine si une couleur hexadécimale est foncée
 * @param {string} hexColor - Couleur hexadécimale sans le #
 * @returns {boolean} - true si la couleur est foncée, false sinon
 */
export function isColorDark(hexColor) {
  if (!hexColor) return true;
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

/**
 * Assombrit une couleur hexadécimale
 * @param {string} color - Couleur hexadécimale sans le #
 * @param {number} darkenAmount - Facteur d'assombrissement (défaut: 0.85)
 * @param {string} defaultColor - Couleur par défaut si color est undefined (défaut: '000000')
 * @returns {string} - Couleur assombrie en hexadécimal sans le #
 */
export function darkenColor(color, darkenAmount = 0.85, defaultColor = '000000') {
  // Si pas de couleur, retourne la couleur par défaut
  if (!color) return defaultColor;
  
  try {
    // Convertir la couleur hex en RGB
    const r = parseInt(color.slice(0, 2), 16);
    const g = parseInt(color.slice(2, 4), 16);
    const b = parseInt(color.slice(4, 6), 16);
    
    // Assombrir 
    const darkenR = Math.floor(r * darkenAmount);
    const darkenG = Math.floor(g * darkenAmount);
    const darkenB = Math.floor(b * darkenAmount);
    
    // Convertir en hex et retourner
    return `${darkenR.toString(16).padStart(2, '0')}${darkenG.toString(16).padStart(2, '0')}${darkenB.toString(16).padStart(2, '0')}`;
  } catch (error) {
    return defaultColor;
  }
} 