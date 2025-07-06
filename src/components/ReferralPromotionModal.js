import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MODAL_KEYS, markModalAsSeen, hasSeenModal } from '../utils/modalUtils';
import { FaGift, FaRankingStar } from "react-icons/fa6";

const ReferralPromotionModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Ne montrer cette modal que si l'utilisateur est connecté
    if (!user) return;
    
    // Vérifier si l'utilisateur a déjà vu la modal de promotion du parrainage
    if (!hasSeenModal(MODAL_KEYS.REFERRAL_PROMOTION)) {
      // Afficher la modal après un délai pour une meilleure UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000); // Réduit à 2 secondes maintenant qu'il n'y a plus de modal sondage
      
      return () => clearTimeout(timer);
    }
  }, [user]);
  
  const handleClose = () => {
    setIsOpen(false);
    markModalAsSeen(MODAL_KEYS.REFERRAL_PROMOTION);
  };
  
  const handleGoToReferral = () => {
    markModalAsSeen(MODAL_KEYS.REFERRAL_PROMOTION);
    navigate('/account');
    setIsOpen(false);
    
    // Attendre que la navigation soit terminée puis scroller vers la section parrainage
    setTimeout(() => {
      // Changer d'onglet vers parrainage dans la page Account
      const parrainageTab = document.querySelector('[data-tab="parrainage"]');
      
      if (parrainageTab) {
        parrainageTab.click();
        
        // Scroller vers la section après un court délai
        setTimeout(() => {
          const section = document.querySelector('[data-section="parrainage"]');
          
          if (section) {
            section.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
          
          // Faire clignoter le code de parrainage pour attirer l'attention
          setTimeout(() => {
            const codeElement = document.querySelector('[data-referral-code]');
            
            if (codeElement) {
              codeElement.classList.add('animate-pulse-highlight');
              setTimeout(() => {
                codeElement.classList.remove('animate-pulse-highlight');
              }, 3000);
            }
          }, 800);
        }, 300);
      }
    }, 200);
  };
  
  const nextPage = () => {
    setCurrentPage(2);
  };
  
  const prevPage = () => {
    setCurrentPage(1);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full mx-4 overflow-hidden shadow-2xl transform transition-all">
          {/* Header avec gradient */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 p-4 text-center relative">
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 text-white/80 hover:text-white text-xl font-bold w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <FaGift className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Gagnez des récompenses !
            </h2>
          </div>

          {/* Contenu avec pagination */}
          <div className="p-4">
            {currentPage === 1 ? (
              // Page 1 : Introduction
              <div className="space-y-4">
                <div className="text-center space-y-3">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                    🎉 Gagnez des points ensemble !
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Partagez votre code sur <strong>Facebook, Instagram, Snapchat, TikTok, WhatsApp</strong> ou par SMS ! 
                    Quand quelqu'un s'inscrit avec votre code, <strong>vous gagnez tous les deux 1 point</strong> ! 
                    C'est gagnant-gagnant ! 🤝
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <FaRankingStar className="w-4 h-4 text-green-600 dark:text-green-300" />
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">1 point par inscription</p>
                  </div>

                  <div className="flex flex-col items-center gap-1 text-center">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <FaGift className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">Récompenses mensuelles</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1 text-center">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                      </svg>
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">Classement mensuel</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={nextPage}
                    className="flex-1 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                  >
                    Comment ça marche ?
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              // Page 2 : Détails
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">
                    💡 Comment ça marche ?
                  </h4>
                  <div className="space-y-2 text-xs text-blue-700 dark:text-blue-300">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">1.</span>
                      <span>Récupérez votre code unique</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">2.</span>
                      <span>Partagez-le avec vos amis sur les réseaux sociaux</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">3.</span>
                      <span>Ils s'inscrivent avec votre code lors de leur inscription</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      <span><strong>Vous gagnez 1 point, ils gagnent aussi 1 point !</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={prevPage}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Retour
                  </button>
                  
                  <button
                    onClick={handleGoToReferral}
                    className="flex-1 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                  >
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
                      />
                    </svg>
                    Voir mon code
                  </button>
                </div>
                
                <button
                  onClick={handleClose}
                  className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors text-sm"
                >
                  Plus tard
                </button>
              </div>
            )}

            {/* Indicateur de page */}
            <div className="flex justify-center space-x-2 mt-4">
              <div className={`w-2 h-2 rounded-full transition-colors ${currentPage === 1 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <div className={`w-2 h-2 rounded-full transition-colors ${currentPage === 2 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReferralPromotionModal; 