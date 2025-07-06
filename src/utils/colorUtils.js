/**
 * Darkens a hex color string (without '#').
 * @param {string} color - The hex color string.
 * @param {number} [amount=0.85] - The percentage to darken.
 * @returns {string} The darkened hex color string.
 */
export const darkenColor = (color, amount = 0.85) => {
  if (!color) return '6B7280';
  
  const hex = color.replace('#', '');
  if (!/^[0-9A-Fa-f]{3,6}$/i.test(hex)) return '6B7280';

  let fullHex = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  
  const darkenR = Math.max(0, Math.floor(r * amount));
  const darkenG = Math.max(0, Math.floor(g * amount));
  const darkenB = Math.max(0, Math.floor(b * amount));
  
  return `${darkenR.toString(16).padStart(2, '0')}${darkenG.toString(16).padStart(2, '0')}${darkenB.toString(16).padStart(2, '0')}`;
};

/**
 * Determines contrast text color ('#000000' or '#FFFFFF') for a hex color string.
 * @param {string} bgColor - The hex background color string.
 * @returns {string} '#000000' for black or '#FFFFFF' for white.
 */
export const getContrastTextColor = (bgColor) => {
  if (!bgColor) return '#FFFFFF';
  
  const hex = bgColor.replace('#', '');
  if (!/^[0-9A-Fa-f]{3,6}$/i.test(hex)) return '#FFFFFF';
  
  let fullHex = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

/**
 * Returns safe background and text colors. Handles white/null colors.
 * Background color is returned without '#'.
 * @param {string} color - The hex color string from the API.
 * @returns {{background: string, text: string}} An object with safe background and text colors.
 */
export const getSafeLineColors = (color) => {
    const defaultBg = '6B7280'; // gray-500
    const defaultText = '#FFFFFF';
    
    if (!color) {
        return { background: defaultBg, text: defaultText };
    }

    const upperCaseColor = color.toUpperCase().replace('#', '');
    const whiteColors = ['FFF', 'FFFFFF'];

    if (whiteColors.includes(upperCaseColor)) {
        return { background: defaultBg, text: defaultText };
    }

    return {
        background: upperCaseColor,
        text: getContrastTextColor(upperCaseColor)
    };
} 