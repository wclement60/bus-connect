import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const WelcomeModal = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 5;

  // Fermer la modal avec la touche Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    {
      title: "Bienvenue sur Bus Connect v4 !",
      content: (
        <div className="space-y-2">
          <p className="text-xs sm:text-sm">
            Découvrez la nouvelle version <span className="font-bold">bêta</span> de Bus Connect.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
            <h4 className="font-semibold text-blue-700 dark:text-blue-300 text-xs sm:text-sm mb-1">Version bêta</h4>
            <p className="text-xs text-blue-600 dark:text-blue-200">
              Version en test. Vos retours nous aideront à l'améliorer.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Design repensé",
      content: (
        <div className="space-y-2">
          <p className="text-xs sm:text-sm">
            Interface plus intuitive et moderne pour une meilleure expérience.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-white dark:bg-dark-700 p-2 rounded-lg shadow-sm">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] flex items-center justify-center mb-1">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path>
                </svg>
              </div>
              <h5 className="font-medium text-xs">Plus intuitif</h5>
              <p className="text-xs text-gray-500 dark:text-gray-400">Navigation simplifiée</p>
            </div>
            <div className="bg-white dark:bg-dark-700 p-2 rounded-lg shadow-sm">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] flex items-center justify-center mb-1">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"></path>
                </svg>
              </div>
              <h5 className="font-medium text-xs">Plus moderne</h5>
              <p className="text-xs text-gray-500 dark:text-gray-400">Interface élégante</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Plus rapide",
      content: (
        <div className="space-y-2">
          <p className="text-xs sm:text-sm">
            Application optimisée pour de meilleures performances.
          </p>
          <div className="flex items-center space-x-2 bg-green-50 dark:bg-green-900/30 p-2 rounded-lg">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path>
            </svg>
            <div>
              <h5 className="font-medium text-green-700 dark:text-green-300 text-xs">Performances</h5>
              <p className="text-xs text-green-600 dark:text-green-200">Réactivité accrue</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Créez votre compte",
      content: (
        <div className="space-y-2">
          <p className="text-xs sm:text-sm">
            Profitez de toutes les fonctionnalités avec un compte.
          </p>
          <div className="bg-white dark:bg-dark-700 p-2 rounded-lg shadow-sm">
            <h4 className="font-semibold mb-2 bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] bg-clip-text text-transparent text-xs">Avantages</h4>
            <ul className="space-y-2">
              <li className="flex items-start">
                <svg className="w-4 h-4 text-[#07d6fb] mr-1 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                <div>
                  <span className="font-medium text-xs">Favoris</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Synchronisés sur tous vos appareils</p>
                </div>
              </li>
              <li className="flex items-start">
                <svg className="w-4 h-4 text-[#ff66c4] mr-1 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                <div>
                  <span className="font-medium text-xs">Bientôt</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Justificatifs et info trafic</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Nouveautés à venir",
      content: (
        <div className="space-y-2">
          <p className="text-xs">
            Prochaines fonctionnalités :
          </p>
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-start">
              <div className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mr-1 mt-0.5 flex-shrink-0">
                <svg className="w-2 h-2 text-purple-600 dark:text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div>
                <span className="font-medium text-xs">Itinéraires</span>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mr-1 mt-0.5 flex-shrink-0">
                <svg className="w-2 h-2 text-amber-600 dark:text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div>
                <span className="font-medium text-xs">Justificatifs</span>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-1 mt-0.5 flex-shrink-0">
                <svg className="w-2 h-2 text-blue-600 dark:text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div>
                <span className="font-medium text-xs">CONNECT+</span>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-4 h-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mr-1 mt-0.5 flex-shrink-0">
                <svg className="w-2 h-2 text-red-600 dark:text-red-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                </svg>
              </div>
              <div>
                <span className="font-medium text-xs">Info trafic</span>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div 
        className="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-[90%] sm:max-w-xs overflow-hidden transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec gradient */}
        <div className="bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] p-2 sm:p-4">
          <div className="flex justify-between items-center">
            <img 
              src="/logo_white.svg" 
              alt="Bus Connect Logo" 
              className="h-8 sm:h-14 w-auto"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/120x40?text=Bus+Connect';
              }}
            />
            <div className="flex items-center gap-1">
              <div className="bg-white/20 px-2 py-0.5 rounded-full text-xs text-white font-medium">
                v4 Bêta
              </div>
              <button 
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                aria-label="Fermer"
              >
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Contenu */}
        <div className="p-3 sm:p-4">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mb-2 bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] bg-clip-text text-transparent">
            {steps[currentStep].title}
          </h3>
          <div className="text-gray-600 dark:text-gray-300">
            {steps[currentStep].content}
          </div>
        </div>
        
        {/* Indicateurs d'étapes */}
        <div className="flex justify-center space-x-1.5 px-3 pb-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div 
              key={index}
              className={`h-1 rounded-full transition-all duration-300 ${
                index === currentStep 
                  ? 'w-3 sm:w-4 bg-gradient-to-r from-[#07d6fb] to-[#ff66c4]' 
                  : 'w-1 sm:w-1.5 bg-gray-300 dark:bg-gray-600'
              }`}
            ></div>
          ))}
        </div>
        
        {/* Footer avec boutons */}
        <div className="px-3 py-2 bg-gray-50 dark:bg-dark-700 flex justify-between items-center">
          <button 
            onClick={handlePrevious}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              currentStep === 0 
                ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
            }`}
            disabled={currentStep === 0}
          >
            Précédent
          </button>
          <button 
            onClick={handleNext}
            className="px-4 py-1.5 bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity animate-pulse relative group"
          >
            <span className="relative z-10">{currentStep === totalSteps - 1 ? "Commencer" : "Suivant"}</span>
            <span className="absolute right-1.5 top-1/2 transform -translate-y-1/2 translate-x-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal; 