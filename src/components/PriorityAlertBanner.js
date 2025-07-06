import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  getUserActiveAlerts, 
  acknowledgeAlert, 
  createAppeal,
  getUserAppeals
} from '../services/priorityAlertService';
import Avatar from './Avatar';
import AppealChatModal from './AppealChatModal';
import { 
  FaExclamationTriangle, 
  FaExclamationCircle, 
  FaBan, 
  FaTimes, 
  FaCheck,
  FaCommentDots,
  FaGavel
} from 'react-icons/fa';

const PriorityAlertBanner = () => {
  const [alerts, setAlerts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userAppeals, setUserAppeals] = useState([]);
  const [showBlinkingAlert, setShowBlinkingAlert] = useState(true);
  const [appealForm, setAppealForm] = useState({
    reason: '',
    additional_info: ''
  });

  const bannerRef = useRef(null);
  const { user } = useAuth();
  const { showToast } = useToast();

  // Charger les alertes de l'utilisateur
  useEffect(() => {
    if (user) {
      loadUserAlerts();
      loadUserAppeals();
    }
  }, [user]);

  // Animation ALERTE clignotant puis fade vers l'alerte
  useEffect(() => {
    if (alerts.length > 0) {
      setShowBlinkingAlert(true);
      const timer = setTimeout(() => {
        setShowBlinkingAlert(false);
      }, 3000); // 3 secondes de clignotement
      return () => clearTimeout(timer);
    }
  }, [alerts.length]);

  // Calculer et appliquer la hauteur du banner automatiquement
  useEffect(() => {
    const updateBannerHeight = () => {
      if (bannerRef.current && alerts.length > 0) {
        const height = bannerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--alert-banner-height', `${height}px`);
      } else {
        document.documentElement.style.setProperty('--alert-banner-height', '0px');
      }
    };

    // Calculer immédiatement
    updateBannerHeight();

    // Recalculer après les animations et changements de contenu
    const timer = setTimeout(updateBannerHeight, 100);
    
    // Observer les changements de taille
    const resizeObserver = new ResizeObserver(updateBannerHeight);
    if (bannerRef.current) {
      resizeObserver.observe(bannerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [alerts.length, showBlinkingAlert]); // Re-calculer quand les alertes ou l'animation changent

  const loadUserAlerts = async () => {
    try {
      const data = await getUserActiveAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('Erreur lors du chargement des alertes:', error);
    }
  };

  const loadUserAppeals = async () => {
    try {
      const data = await getUserAppeals();
      setUserAppeals(data);
    } catch (error) {
      console.error('Erreur lors du chargement des appels:', error);
    }
  };

  const handleAlertClick = (alert) => {
    setSelectedAlert(alert);
    setShowModal(true);
  };

  const handleAcknowledge = async (alertId) => {
    try {
      setLoading(true);
      await acknowledgeAlert(alertId);
      showToast('Alerte acquittée', 'success');
      await loadUserAlerts(); // Recharger les alertes après acquittement
    } catch (error) {
      showToast('Erreur lors de l\'acquittement', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAppealForm = (alert) => {
    setSelectedAlert(alert);
    setShowAppealForm(true);
    setShowModal(false);
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();
    if (!selectedAlert || !appealForm.reason.trim()) return;

    try {
      setLoading(true);
      await createAppeal(selectedAlert.id, appealForm);
      await loadUserAppeals();
      showToast('Appel soumis avec succès', 'success');
      setShowAppealForm(false);
      setAppealForm({ reason: '', additional_info: '' });
    } catch (error) {
      showToast('Erreur lors de la soumission de l\'appel', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (alertType, severity) => {
    const iconProps = { className: 'w-5 h-5' };
    
    switch (alertType) {
      case 'violation':
        return <FaBan {...iconProps} />;
      case 'suspension':
        return <FaGavel {...iconProps} />;
      case 'warning':
        return <FaExclamationTriangle {...iconProps} />;
      default:
        return <FaExclamationCircle {...iconProps} />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-red-500 text-white';
      case 'medium':
        return 'bg-orange-500 text-white';
      case 'low':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-red-500 text-white';
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'critical':
        return 'CRITIQUE';
      case 'high':
        return 'ÉLEVÉE';
      case 'medium':
        return 'MOYENNE';
      case 'low':
        return 'FAIBLE';
      default:
        return 'ÉLEVÉE';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const hasAppealForAlert = (alertId) => {
    return userAppeals.some(appeal => appeal.alert_id === alertId);
  };

  const getAppealForAlert = (alertId) => {
    return userAppeals.find(appeal => appeal.alert_id === alertId);
  };

  const canAcknowledgeAlert = (alertType) => {
    return alertType === 'warning' || alertType === 'error';
  };

  // Nettoyer la variable CSS si pas d'alertes
  useEffect(() => {
    if (!user || alerts.length === 0) {
      document.documentElement.style.setProperty('--alert-banner-height', '0px');
    }
  }, [user, alerts.length]);

  if (!user || alerts.length === 0) {
    return null;
  }

  const currentAlert = alerts[0]; // Toujours afficher la première alerte

  return (
    <>
      {/* Banner d'alerte fixe */}
      <div 
        ref={bannerRef}
        className={`fixed top-0 left-0 right-0 z-40 ${getSeverityColor(currentAlert.severity)} border-b-2 border-red-700 cursor-pointer hover:opacity-90 transition-all duration-500 overflow-hidden`}
        onClick={() => handleAlertClick(currentAlert)}
        style={{ animation: 'slideDown 0.5s ease-out' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 relative">
          
          {/* Animation ALERTE qui claque */}
          {showBlinkingAlert && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-600 z-10 animate-pulse">
              <div className="relative">
                <h2 className="text-white font-black text-3xl sm:text-5xl tracking-widest drop-shadow-2xl animate-bounce transform scale-110">
                  ALERTE
                </h2>
                <div className="absolute inset-0 text-red-200 font-black text-3xl sm:text-5xl tracking-widest blur-sm animate-ping">
                  ALERTE
                </div>
              </div>
            </div>
          )}

          {/* Contenu de l'alerte avec fade in */}
          <div className={`transition-opacity duration-1000 ${showBlinkingAlert ? 'opacity-0' : 'opacity-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex-shrink-0">
                  {getAlertIcon(currentAlert.alert_type, currentAlert.severity)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm sm:text-base truncate">
                      {currentAlert.title}
                    </h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/20">
                      {getSeverityLabel(currentAlert.severity)}
                    </span>
                    {alerts.length > 1 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/30">
                        +{alerts.length - 1} autre{alerts.length > 2 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm opacity-90 mt-1" style={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    Cliquez pour voir les détails et options d'appel
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                {canAcknowledgeAlert(currentAlert.alert_type) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcknowledge(currentAlert.id);
                    }}
                    disabled={loading || currentAlert.acknowledged_at}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
                    title={currentAlert.acknowledged_at ? "Déjà acquittée" : "Marquer comme vue"}
                  >
                    <FaCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de détails d'alerte */}
      {showModal && selectedAlert && (
        <div className="fixed inset-0 bg-white dark:bg-dark-800 z-50">
          <div className="bg-white dark:bg-dark-800 w-full h-full overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className={`${getSeverityColor(selectedAlert.severity)} p-4 sm:p-6 flex-shrink-0`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getAlertIcon(selectedAlert.alert_type, selectedAlert.severity)}
                  <div>
                    <h3 className="text-lg font-bold">{selectedAlert.title}</h3>
                    <p className="text-sm opacity-90">
                      {selectedAlert.alert_type === 'violation' && 'Violation des règles'}
                      {selectedAlert.alert_type === 'suspension' && 'Suspension de compte'}
                      {selectedAlert.alert_type === 'warning' && 'Avertissement'}
                      {selectedAlert.alert_type === 'error' && 'Erreur signalée'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <FaTimes className="w-6 h-6 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Corps du message */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Détails de l'alerte</h4>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {selectedAlert.message}
                  </p>
                  {!canAcknowledgeAlert(selectedAlert.alert_type) && (
                    <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded">
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        <strong>⚠️ Cette alerte ne peut pas être acquittée.</strong> Les violations et suspensions nécessitent une action administrative.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-500 dark:text-gray-400">Créée le:</span>
                    <p className="text-gray-900 dark:text-white">{formatDate(selectedAlert.created_at)}</p>
                  </div>
                  {selectedAlert.expires_at && (
                    <div>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Expire le:</span>
                      <p className="text-gray-900 dark:text-white">{formatDate(selectedAlert.expires_at)}</p>
                    </div>
                  )}
                </div>

                {/* Statut d'appel */}
                {hasAppealForAlert(selectedAlert.id) && (
                  <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                    {(() => {
                      const appeal = getAppealForAlert(selectedAlert.id);
                      return (
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <FaGavel className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-medium text-blue-900 dark:text-blue-100">
                              Appel soumis
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              appeal.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              appeal.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              appeal.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                              {appeal.status === 'pending' && 'En attente'}
                              {appeal.status === 'under_review' && 'En cours de révision'}
                              {appeal.status === 'approved' && 'Approuvé'}
                              {appeal.status === 'rejected' && 'Rejeté'}
                            </span>
                          </div>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Soumis le {formatDate(appeal.created_at)}
                          </p>
                          {appeal.admin_response && (
                            <div className="mt-3 p-3 bg-white dark:bg-dark-700 rounded border">
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                Réponse de l'administration:
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {appeal.admin_response}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-50 dark:bg-dark-700 border-t-2 border-gray-300 dark:border-gray-700 flex-shrink-0 pb-20 sm:pb-6">
              <div className="p-4 flex flex-col sm:flex-row justify-between gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="order-2 sm:order-1 px-4 py-3 sm:py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors text-base"
                >
                  Fermer
                </button>

                <div className="flex flex-col sm:flex-row gap-2 order-1 sm:order-2">
                  {!selectedAlert.acknowledged_at && canAcknowledgeAlert(selectedAlert.alert_type) && (
                    <button
                      onClick={() => handleAcknowledge(selectedAlert.id)}
                      disabled={loading}
                      className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-base font-medium"
                    >
                      <FaCheck className="w-4 h-4 inline mr-2" />
                      Acquitter
                    </button>
                  )}

                  {selectedAlert.can_appeal && !hasAppealForAlert(selectedAlert.id) && (
                    <button
                      onClick={() => handleOpenAppealForm(selectedAlert)}
                      className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base font-medium"
                    >
                      <FaGavel className="w-4 h-4 inline mr-2" />
                      Faire appel
                    </button>
                  )}

                  {hasAppealForAlert(selectedAlert.id) && (
                    <button
                      onClick={() => {
                        const appeal = getAppealForAlert(selectedAlert.id);
                        setSelectedAppeal(appeal);
                        setShowChatModal(true);
                        setShowModal(false);
                      }}
                      className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-base font-medium"
                    >
                      <FaCommentDots className="w-4 h-4 inline mr-2" />
                      Tchat
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de formulaire d'appel */}
      {showAppealForm && selectedAlert && (
        <div className="fixed inset-0 bg-white dark:bg-dark-800 z-50">
          <div className="bg-white dark:bg-dark-800 w-full h-full overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-blue-600 text-white p-4 sm:p-6 flex-shrink-0 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FaGavel className="w-5 h-5" />
                <h3 className="text-lg font-bold">Faire appel de l'alerte</h3>
              </div>
              <button
                onClick={() => setShowAppealForm(false)}
                className="p-2 hover:bg-blue-700 rounded-full transition-colors sm:hidden"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmitAppeal} className="p-4 sm:p-6 flex-1 overflow-y-auto pb-safe">
              <div className="space-y-4 sm:space-y-4">
                <div className="bg-gray-50 dark:bg-dark-700 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 text-base">Alerte concernée:</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAlert.title}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Raison de l'appel *
                  </label>
                  <textarea
                    value={appealForm.reason}
                    onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    rows="4"
                    placeholder="Expliquez pourquoi vous contestez cette alerte..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Informations supplémentaires (optionnel)
                  </label>
                  <textarea
                    value={appealForm.additional_info}
                    onChange={(e) => setAppealForm({ ...appealForm, additional_info: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    rows="3"
                    placeholder="Ajoutez des détails qui pourraient aider à réviser votre cas..."
                  />
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <FaCommentDots className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        Système de tchat disponible
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        Une fois votre appel soumis, vous pourrez échanger avec l'administration via un système de tchat intégré.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-gray-300 dark:border-gray-700 flex-shrink-0 pb-20 sm:pb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setShowAppealForm(false)}
                    className="hidden sm:block px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors order-2 sm:order-1"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !appealForm.reason.trim()}
                    className="w-full sm:w-auto px-6 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors order-1 sm:order-2 font-medium"
                  >
                    {loading ? 'Envoi...' : 'Soumettre l\'appel'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de tchat */}
      <AppealChatModal
        appeal={selectedAppeal}
        isOpen={showChatModal}
        onClose={() => {
          setShowChatModal(false);
          setSelectedAppeal(null);
        }}
      />

      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default PriorityAlertBanner; 