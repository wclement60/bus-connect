import React from 'react';

const sizesMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

/**
 * Composant d'indicateur de chargement animé
 * @param {Object} props - Les propriétés du composant
 * @param {string} [props.size='md'] - Taille du spinner (xs, sm, md, lg, xl)
 * @param {string} [props.color='currentColor'] - Couleur du spinner
 * @param {string} [props.className=''] - Classes CSS additionnelles
 */
const LoadingSpinner = ({ size = 'md', color = 'currentColor', className = '' }) => {
  const sizeClass = sizesMap[size] || sizesMap.md;

  return (
    <svg 
      className={`animate-spin ${sizeClass} ${className}`} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke={color} 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill={color} 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

export default LoadingSpinner; 