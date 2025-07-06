import React from 'react';
import { darkenColor } from './utils';

const LoadingSkeleton = ({ trips, currentTripIndex, lineInfo }) => {
  return (
    <div className={`bg-[#F6F6F6] rounded-lg p-4 md:p-6 animate-pulse`} style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="space-y-[2.75rem]" style={{ paddingLeft: '5.5rem' }}>
        {[...Array(8)].map((_, index) => (
          <div key={index} className="relative min-h-[3.5rem] flex" style={{ marginTop: index > 0 ? '-1.75rem' : '0' }}>
            {/* Colonne des horaires */}
            <div 
              className="absolute" 
              style={{ 
                left: '-5.5rem',
                width: '5rem',
                textAlign: 'right',
                paddingRight: '1rem'
              }}
            >
              <div className="h-6 w-12 bg-gray-200 rounded font-bold"></div>
            </div>
            
            {/* Colonne de la timeline */}
            <div className="flex flex-col items-center relative" style={{ width: "24px" }}>
              {/* Trait vertical */}
              {index < 7 && (
                <div 
                  className="absolute bg-gray-200" 
                  style={{ 
                    top: index === 0 ? '20px' : '12px',
                    bottom: '-38px',
                    width: '4px',
                    left: '10px',
                    zIndex: 0
                  }}
                />
              )}
              
              {/* Point d'arrêt */}
              <div className="relative flex items-center justify-center w-5 h-5" style={{ zIndex: 1 }}>
                <div 
                  className={`
                    rounded-full bg-gray-200 relative
                    ${index === 0 ? 'w-5 h-5' : 'w-3 h-3'}
                  `}
                  style={{ 
                    zIndex: 1
                  }}
                />
              </div>
            </div>
            
            {/* Colonne du nom d'arrêt et des infos */}
            <div className="ml-2 md:ml-4 flex-1">
              <div className="bg-white/60 shadow-sm rounded-lg px-2 md:px-3 py-2" style={{ height: '100%', width: '100%' }}>
                <div className="flex flex-col">
                  {/* Nom de l'arrêt */}
                  <div className="h-5 w-40 bg-gray-200 rounded mb-1"></div>
                  
                  {/* Ville */}
                  <div className="h-3 w-24 bg-gray-100 rounded mb-2"></div>
                  
                  {/* Badges de connexion */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[...Array(index % 3 + 1)].map((_, i) => (
                      <div key={i} className="h-5 w-8 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                  
                  {/* Statut */}
                  <div className="h-3 w-28 bg-gray-100 rounded mt-2"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadingSkeleton; 