import React, { useState } from 'react';

/**
 * Composant pour afficher le logo d'un réseau de transport
 * 
 * @param {Object} props - Propriétés du composant
 * @param {string} props.networkId - Identifiant du réseau
 * @param {string} props.networkName - Nom du réseau (utilisé pour l'initiale de secours)
 * @param {string} [props.size='normal'] - Taille du logo ('small', 'normal', 'large')
 * @param {string} [props.className=''] - Classes CSS supplémentaires
 * @returns {JSX.Element} - Le composant de logo
 */
const NetworkLogo = ({ networkId, networkName, size = 'normal', className = '' }) => {
  const [imageError, setImageError] = useState(false);
  
  // Chemins possibles pour le logo (plusieurs formats)
  const logoPath = `/images/networks/${networkId.toLowerCase()}.png`;
  
  // Déterminer les classes de taille
  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    normal: 'w-10 h-10 text-base',
    large: 'w-16 h-16 text-xl',
    xl: 'w-20 h-20 text-2xl'
  };
  
  // Fallback : première lettre du nom du réseau
  const fallbackInitial = networkName ? networkName.charAt(0).toUpperCase() : networkId.charAt(0).toUpperCase();
  
  // Couleurs pour le cercle de fallback
  const bgColorClass = 'bg-blue-100';
  const textColorClass = 'text-blue-600';
  
  // Si l'image a échoué à charger ou n'est pas disponible, afficher l'initiale
  if (imageError) {
    return (
      <div className={`${sizeClasses[size] || sizeClasses.normal} ${bgColorClass} rounded-full flex items-center justify-center ${className}`}>
        <span className={`${textColorClass} font-bold`}>{fallbackInitial}</span>
      </div>
    );
  }
  
  // Essayer d'afficher le logo
  return (
    <div className={`${sizeClasses[size] || sizeClasses.normal} rounded-full flex items-center justify-center overflow-hidden ${className}`}>
      <img
        src={logoPath}
        alt={`Logo ${networkName || networkId}`}
        className="w-full h-full object-contain p-1"
        onError={() => setImageError(true)}
      />
    </div>
  );
};

export default NetworkLogo; 