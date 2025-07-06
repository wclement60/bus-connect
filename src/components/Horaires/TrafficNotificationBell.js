import React, { useState, useEffect } from 'react';
import { MdNotifications, MdWarning, MdInfo, MdError, MdClose, MdArrowForward } from 'react-icons/md';
import { FaBus } from 'react-icons/fa';
import { getSafeLineColors, darkenColor } from '../../utils/colorUtils';

const TrafficNotificationBell = ({ disruptions = [] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState(new Set());
  const [isMobile, setIsMobile] = useState(false);

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Ne pas afficher la cloche s'il n'y a pas de perturbations
  if (!disruptions || disruptions.length === 0) {
    return null;
  }

  const toggleAlert = (alertId) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  const getAlertIcon = (type, severity) => {
    if (type === 'Travaux' || severity === 'high') {
      return <MdError className="w-4 h-4 text-red-500" />;
    } else if (type === 'Arrêt non desservi' || severity === 'medium') {
      return <MdWarning className="w-4 h-4 text-orange-500" />;
    } else {
      return <MdInfo className="w-4 h-4 text-blue-500" />;
    }
  };

  const getAlertStyle = (type, severity) => {
    if (type === 'Travaux' || severity === 'high') {
      return {
        border: 'border-red-200 dark:border-red-800',
        background: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-800 dark:text-red-200'
      };
    } else if (type === 'Arrêt non desservi' || severity === 'medium') {
      return {
        border: 'border-orange-200 dark:border-orange-800',
        background: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-800 dark:text-orange-200'
      };
    } else {
      return {
        border: 'border-blue-200 dark:border-blue-800',
        background: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-800 dark:text-blue-200'
      };
    }
  };

  const cleanDescription = (description) => {
    if (!description) return '';
    
    return description
      // D'abord, convertir les balises HTML en sauts de ligne appropriés
      .replace(/<\/p>/gi, '<br><br>')                // Fin de paragraphe = double saut de ligne
      .replace(/<p[^>]*>/gi, '')                     // Début de paragraphe = rien
      .replace(/<\/li>/gi, '<br>')                   // Fin d'élément de liste = saut de ligne
      .replace(/<li[^>]*>/gi, '• ')                  // Début d'élément de liste = puce
      .replace(/<\/ul>/gi, '<br>')                   // Fin de liste = saut de ligne
      .replace(/<ul[^>]*>/gi, '<br>')                // Début de liste = saut de ligne
      .replace(/<\/strong>/gi, '</strong>')          // Garder le gras
      .replace(/<strong[^>]*>/gi, '<strong>')        // Nettoyer les attributs du strong
      .replace(/<br\s*\/?>/gi, '<br>')               // Nettoyer les br
      // Décoder les entités HTML
      .replace(/&gt;/gi, '>')
      .replace(/&lt;/gi, '<')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      // Supprimer les attributs de style qui peuvent causer des problèmes de sécurité
      .replace(/style\s*=\s*["'][^"']*["']/gi, '')
      // Supprimer toutes les autres balises HTML restantes (comme les span avec styles)
      .replace(/<(?!\/?(strong|br)\b)[^>]*>/gi, '')
      // Nettoyer les sauts de ligne multiples
      .replace(/(<br>\s*){3,}/gi, '<br><br>')        // Max 2 sauts de ligne consécutifs
      .replace(/^<br>+/gi, '')                       // Supprimer les br en début
      // Remplacer "sur le site Internet www.oise-mobilite.fr" par "sur l'application Bus Connect"
      .replace(/sur le site Internet www\.oise-mobilite\.fr/gi, 'sur l\'application Bus Connect')
      .replace(/consulter sur le site Internet www\.oise-mobilite\.fr/gi, 'consulter sur l\'application Bus Connect')
      .replace(/www\.oise-mobilite\.fr/gi, 'Bus Connect')
      // Supprimer les balises script et autres balises dangereuses
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .trim();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('fr-FR');
    const timeFormatted = date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return { date: dateFormatted, time: timeFormatted };
  };

  return (
    <>
      {/* Bouton cloche avec badge */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="traffic-notification-bell relative text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 transition-colors duration-200"
        title={`${disruptions.length} perturbation${disruptions.length > 1 ? 's' : ''} de trafic`}
      >
        <MdNotifications className="w-8 h-8" />
        {/* Badge avec le nombre de perturbations */}
        <span className="notification-badge absolute -top-2 -right-2 bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center font-bold">
          {disruptions.length}
        </span>
      </button>

      {/* Modal des perturbations */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-[9999] ${isMobile ? '' : 'flex items-center justify-center p-4'}`} style={{ margin: 0, width: '100vw', height: '100vh', top: 0, left: 0 }}>
          {/* Overlay - seulement sur desktop */}
          {!isMobile && (
            <div 
              className="traffic-modal-overlay fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
          )}
          
          {/* Modal content */}
          <div className={`traffic-modal-content relative bg-white dark:bg-gray-800 shadow-xl ${
            isMobile 
              ? 'w-full h-full flex flex-col fixed inset-0' 
              : 'rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 ${
              isMobile ? 'bg-white dark:bg-gray-800' : ''
            }`}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <MdNotifications className="w-5 h-5 mr-2 text-orange-500" />
                Informations Trafic ({disruptions.length})
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${
                  isMobile ? 'p-2' : ''
                }`}
              >
                <MdClose className={`${isMobile ? 'w-7 h-7' : 'w-6 h-6'}`} />
              </button>
            </div>

            {/* Content */}
            <div 
              className={`scroll-content overflow-y-auto overflow-x-hidden ${
                isMobile ? '' : 'max-h-[60vh]'
              }`}
              style={isMobile ? { 
                height: 'calc(100vh - 180px)',
                maxHeight: 'calc(100vh - 180px)'
              } : {}}
            >
                <div className={`p-4 space-y-4 ${isMobile ? 'pb-24' : 'pb-8'}`}>
                  {disruptions.map((disruption) => {
                    const isExpanded = expandedAlerts.has(disruption.id);
                    
                    return (
                      <div
                        key={disruption.id}
                        className="group relative overflow-hidden rounded-xl border-l-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] bg-white dark:bg-gray-800"
                        style={{
                          borderColor: disruption.type === 'Travaux' || disruption.severity === 'high' 
                            ? '#ef4444' 
                            : disruption.type === 'Arrêt non desservi' || disruption.severity === 'medium'
                            ? '#f59e0b'
                            : '#3b82f6'
                        }}
                      >
                        <div
                          className="p-5 cursor-pointer transition-all duration-200"
                          onClick={() => toggleAlert(disruption.id)}
                        >
                          {/* Badge de type et période - toute la largeur */}
                          <div className="w-full mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                                disruption.type === 'Travaux' || disruption.severity === 'high' 
                                  ? 'bg-red-100 text-red-700 border border-red-200' 
                                  : disruption.type === 'Arrêt non desservi' || disruption.severity === 'medium'
                                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}>
                                {disruption.type || 'Information'}
                              </span>
                              
                              {/* Bouton d'expansion */}
                              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                                disruption.type === 'Travaux' || disruption.severity === 'high' 
                                  ? 'bg-red-50 hover:bg-red-100 text-red-600' 
                                  : disruption.type === 'Arrêt non desservi' || disruption.severity === 'medium'
                                  ? 'bg-orange-50 hover:bg-orange-100 text-orange-600'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                              }`}>
                                <span className="text-xs font-medium">
                                  {isExpanded ? 'Réduire' : 'Détails'}
                                </span>
                                <svg 
                                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                            
                                                         {/* Période juste en dessous du badge - toute la largeur */}
                            {(disruption.startDate || disruption.endDate) && (
                              <div className="w-full">
                                {disruption.startDate && disruption.endDate && (
                                  <div className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium shadow-sm bg-white text-black border border-gray-200">
                                    <span>du</span>
                                    <span className="font-semibold">
                                      {formatDateTime(disruption.startDate).date} {formatDateTime(disruption.startDate).time}
                                    </span>
                                    <MdArrowForward className="w-3 h-3 text-gray-400" />
                                    <span>au</span>
                                    <span className="font-semibold">
                                      {formatDateTime(disruption.endDate).date} {formatDateTime(disruption.endDate).time}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Titre principal - maintenant toujours lisible */}
                          <h3 className="w-full text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 leading-tight">
                            {disruption.title}
                          </h3>
                          
                          {/* Bouton "EN SAVOIR +" si pas développé */}
                          {!isExpanded && (
                            <div className="w-full mt-3">
                              <button className="inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold bg-white text-black border border-gray-800 dark:border-white">
                                <span>EN SAVOIR +</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                                              
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-2">
                            {/* Séparateur élégant */}
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-4" />
                            
                                                         {/* Description complète */}
                             <div className="bg-white/60 dark:bg-gray-700/60 rounded-lg p-4 mb-4 backdrop-blur-sm">
                               <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                 Description détaillée
                               </h4>
                              <div 
                                className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                                dangerouslySetInnerHTML={{ 
                                  __html: cleanDescription(disruption.description) 
                                }}
                              />
                            </div>
                            
                            {/* Lignes affectées */}
                            {disruption.affectedLines && disruption.affectedLines.length > 0 && (
                                                             <div className="bg-white/60 dark:bg-gray-700/60 rounded-lg p-4 mb-4 backdrop-blur-sm">
                                 <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                                   Lignes concernées
                                 </h4>
                                <div className="flex flex-wrap gap-2">
                                  {disruption.affectedLines.map((line, index) => {
                                    const { background, text } = getSafeLineColors(line.color);
                                    return (
                                      <div
                                        key={index}
                                        className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-bold shadow-md transform hover:scale-105 transition-transform duration-200"
                                        style={{
                                          background: `linear-gradient(135deg, #${background} 0%, #${darkenColor(background)} 100%)`,
                                          color: text,
                                          boxShadow: `0 4px 12px #${background}30`
                                        }}
                                      >
                                        <FaBus className="w-3 h-3 mr-2" />
                                        {line.number}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            </div>

            {/* Footer */}
            <div className={`p-4 border-t border-gray-200 dark:border-gray-700 text-center flex-shrink-0 ${
              isMobile ? 'bg-white dark:bg-gray-800' : ''
            }`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Informations mises à jour automatiquement toutes les 5 minutes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CSS global pour corriger l'overlay */}
      {isModalOpen && (
        <style jsx global>{`
          body {
            overflow: hidden;
          }
          .traffic-modal-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 9999 !important;
          }
          .traffic-modal-content {
            position: relative !important;
            z-index: 10000 !important;
            pointer-events: auto !important;
          }
          @media (max-width: 768px) {
            .traffic-modal-content {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              border-radius: 0 !important;
              max-width: none !important;
              max-height: none !important;
            }
          }
          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .traffic-modal-content {
            position: relative !important;
            z-index: 10000 !important;
            pointer-events: auto !important;
          }
          .traffic-modal-content .scroll-content {
            -webkit-overflow-scrolling: touch;
            overflow-y: auto !important;
            overscroll-behavior: contain;
          }
          @media (max-width: 768px) {
            .traffic-modal-content .scroll-content {
              height: calc(100vh - 180px) !important;
              max-height: calc(100vh - 180px) !important;
            }
          }
          /* Styles pour le contenu HTML de la description */
          .traffic-modal-content p {
            margin-bottom: 0.75rem;
            line-height: 1.5;
          }
          .traffic-modal-content ul {
            margin: 0.5rem 0;
            padding-left: 1.25rem;
          }
          .traffic-modal-content li {
            margin-bottom: 0.25rem;
            list-style-type: disc;
          }
          .traffic-modal-content strong {
            font-weight: 600;
            color: inherit;
          }
          .traffic-modal-content span {
            color: inherit !important;
          }
        `}</style>
      )}
    </>
  );
};

export default TrafficNotificationBell; 