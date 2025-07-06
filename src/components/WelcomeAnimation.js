import React, { useEffect, useState } from 'react';

const WelcomeAnimation = ({ firstName }) => {
  const [stage, setStage] = useState('entering'); // 'entering', 'visible', 'leaving'

  useEffect(() => {
    const enterTimer = setTimeout(() => setStage('visible'), 500); // Durée de l'animation d'entrée
    const visibleTimer = setTimeout(() => setStage('leaving'), 3500); // Temps visible
    
    // Le parent (contexte) gère maintenant la suppression du composant
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(visibleTimer);
    };
  }, []); // Pas de dépendances, l'animation se joue une fois par montage

  const containerClasses = {
    entering: 'opacity-100',
    visible: 'opacity-100',
    leaving: 'opacity-0'
  };

  const textContainerClasses = {
    entering: 'opacity-0 scale-95',
    visible: 'opacity-100 scale-100',
    leaving: 'opacity-0 scale-95'
  };

  if (stage === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ease-in-out ${containerClasses[stage]}`}
      style={{
        backgroundColor: '#d0e0f8', // Un bleu ciel clair pour le fond
      }}
    >
      {/* Superposition de l'image de nuages */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/images/welcome.png')`,
          animation: 'cloudMove 4.5s ease-out forwards',
          opacity: 1,
        }}
      ></div>
      
      {/* Contenu textuel */}
      <div className={`relative text-center transform transition-all duration-700 ease-out ${textContainerClasses[stage]}`}>
        <h1 className="text-5xl md:text-7xl font-bold mb-2 text-white" style={{ textShadow: '0 4px 15px rgba(0, 0, 0, 0.2)' }}>
          Hey {firstName},
        </h1>
        <h2 className="text-3xl md:text-5xl font-medium text-white" style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.15)' }}>
          tu nous as manqué !
        </h2>
        <p className="mt-8 text-xl md:text-2xl text-white/80 font-light">
          Bon voyage avec <span className="font-semibold text-white">Bus Connect</span>
        </p>
      </div>

      <style>
        {`
          @keyframes cloudMove {
            from {
              transform: scale(1.2) translate(0, 20px);
              opacity: 0;
            }
            to {
              transform: scale(1) translate(0, 0);
              opacity: 0.7;
            }
          }
        `}
      </style>
    </div>
  );
};

export default WelcomeAnimation; 