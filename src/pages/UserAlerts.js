import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getUserActiveAlerts,
  getUserAppeals,
  createAppeal,
  acknowledgeAlert
} from '../services/priorityAlertService';
import AppealChatModal from '../components/AppealChatModal';
import { 
  FaExclamationTriangle, 
  FaExclamationCircle, 
  FaBan, 
  FaGavel,
  FaCheck,
  FaCommentDots,
  FaClock,
  FaTimes
} from 'react-icons/fa';

const UserAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('alerts');
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [appealForm, setAppealForm] = useState({
    reason: '',
    additional_info: ''
  });

  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const [alertsData, appealsData] = await Promise.all([
        getUserActiveAlerts(),
        getUserAppeals()
      ]);
      setAlerts(alertsData);
      setAppeals(appealsData);
    } catch (error) {
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await acknowledgeAlert(alertId);
      showToast('Alerte acquittée', 'success');
      await loadUserData(); // Recharger les données après acquittement
    } catch (error) {
      showToast('Erreur lors de l\'acquittement', 'error');
    }
  };

  const handleCreateAppeal = async (e) => {
    e.preventDefault();
    if (!selectedAlert || !appealForm.reason.trim()) return;

    try {
      await createAppeal(selectedAlert.id, appealForm);
      showToast('Appel soumis avec succès', 'success');
      setShowAppealModal(false);
      setAppealForm({ reason: '', additional_info: '' });
      loadUserData();
    } catch (error) {
      showToast('Erreur lors de la soumission de l\'appel', 'error');
    }
  };

  const getAlertIcon = (alertType) => {
    switch (alertType) {
      case 'violation':
        return <FaBan className="w-5 h-5 text-red-600" />;
      case 'suspension':
        return <FaGavel className="w-5 h-5 text-red-700" />;
      case 'warning':
        return <FaExclamationTriangle className="w-5 h-5 text-orange-600" />;
      default:
        return <FaExclamationCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return colors[severity] || colors.high;
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

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    const labels = {
      pending: 'En attente',
      under_review: 'En révision',
      approved: 'Approuvé',
      rejected: 'Rejeté'
    };
    return { color: colors[status] || colors.pending, label: labels[status] || status };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const hasAppealForAlert = (alertId) => {
    return appeals.some(appeal => appeal.alert_id === alertId);
  };

  const canAcknowledgeAlert = (alertType) => {
    return alertType === 'warning' || alertType === 'error';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Vous devez être connecté pour voir cette page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
      <div className="max-w-4xl mx-auto px-4">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Mes alertes et appels
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gérez vos alertes prioritaires et suivez vos appels
          </p>
        </div>

        {/* Statistiques rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                <FaExclamationTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Alertes actives</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{alerts.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <FaGavel className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Appels totaux</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{appeals.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900">
                <FaClock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">En attente</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {appeals.filter(a => a.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setSelectedTab('alerts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === 'alerts'
                    ? 'border-red-500 text-red-600 dark:text-red-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Mes alertes ({alerts.length})
              </button>
              <button
                onClick={() => setSelectedTab('appeals')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === 'appeals'
                    ? 'border-red-500 text-red-600 dark:text-red-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Mes appels ({appeals.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {selectedTab === 'alerts' && (
              <div className="space-y-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-12">
                    <FaCheck className="mx-auto h-12 w-12 text-green-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      Aucune alerte active
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Vous n'avez actuellement aucune alerte prioritaire.
                    </p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="mt-1">
                            {getAlertIcon(alert.alert_type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                {alert.title}
                              </h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadge(alert.severity)}`}>
                                {getSeverityLabel(alert.severity)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                              {alert.message}
                            </p>
                            {!canAcknowledgeAlert(alert.alert_type) && (
                              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded text-xs">
                                <p className="text-orange-800 dark:text-orange-200">
                                  ⚠️ Cette alerte ne peut pas être acquittée car elle nécessite une action administrative.
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Créée le {formatDate(alert.created_at)}
                              {alert.expires_at && ` • Expire le ${formatDate(alert.expires_at)}`}
                            </p>
                            {alert.acknowledged_at && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                ✓ Acquittée le {formatDate(alert.acknowledged_at)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {!alert.acknowledged_at && canAcknowledgeAlert(alert.alert_type) && (
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
                              title="Acquitter"
                            >
                              <FaCheck className="w-4 h-4" />
                            </button>
                          )}
                          {alert.can_appeal && !hasAppealForAlert(alert.id) && (
                            <button
                              onClick={() => {
                                setSelectedAlert(alert);
                                setShowAppealModal(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                              title="Faire appel"
                            >
                              <FaGavel className="w-4 h-4" />
                            </button>
                          )}
                          {hasAppealForAlert(alert.id) && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              Appel soumis
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTab === 'appeals' && (
              <div className="space-y-4">
                {appeals.length === 0 ? (
                  <div className="text-center py-12">
                    <FaGavel className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      Aucun appel
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Vous n'avez soumis aucun appel pour le moment.
                    </p>
                  </div>
                ) : (
                  appeals.map((appeal) => (
                    <div key={appeal.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              Appel pour: {appeal.alert?.title}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(appeal.status).color}`}>
                              {getStatusBadge(appeal.status).label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            <strong>Raison:</strong> {appeal.reason}
                          </p>
                          {appeal.additional_info && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                              <strong>Infos supplémentaires:</strong> {appeal.additional_info}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Soumis le {formatDate(appeal.created_at)}
                          </p>
                          {appeal.admin_response && (
                            <div className="mt-3 p-3 bg-gray-50 dark:bg-dark-700 rounded border">
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                Réponse de l'administration:
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {appeal.admin_response}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedAppeal(appeal);
                              setShowChatModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                            title="Ouvrir le tchat"
                          >
                            <FaCommentDots className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal d'appel */}
      {showAppealModal && selectedAlert && (
        <div className="fixed inset-0 bg-white dark:bg-dark-800 z-50">
          <div className="bg-white dark:bg-dark-800 w-full h-full overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-blue-600 text-white p-4 sm:p-6 flex-shrink-0 flex items-center justify-between">
              <h3 className="text-lg sm:text-lg font-bold">Faire appel de l'alerte</h3>
              <button
                onClick={() => setShowAppealModal(false)}
                className="p-2 hover:bg-blue-700 rounded-full transition-colors sm:hidden"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateAppeal} className="p-4 sm:p-6 flex-1 overflow-y-auto pb-safe">
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
                    placeholder="Ajoutez des détails qui pourraient aider..."
                  />
                </div>

                {/* Information sur le système de tchat */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Système de tchat disponible
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                        <p>Une fois votre appel soumis, vous pourrez échanger avec l'administration via un système de tchat intégré.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-gray-300 dark:border-gray-700 flex-shrink-0 pb-20 sm:pb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setShowAppealModal(false)}
                    className="hidden sm:block px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors order-2 sm:order-1"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!appealForm.reason.trim()}
                    className="w-full sm:w-auto px-6 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors order-1 sm:order-2 font-medium"
                  >
                    Soumettre l'appel
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
    </div>
  );
};

export default UserAlerts; 