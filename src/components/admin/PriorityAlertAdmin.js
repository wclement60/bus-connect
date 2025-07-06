import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { 
  getAllAlerts, 
  createPriorityAlert, 
  resolveAlert, 
  updateAlert,
  searchUsers,
  getAlertStats,
  getAllAppeals,
  processAppeal
} from '../../services/priorityAlertService';
import Avatar from '../Avatar';
import LoadingSpinner from '../LoadingSpinner';
import AppealChatModal from '../AppealChatModal';
import { 
  FaPlus, 
  FaEdit, 
  FaCheck, 
  FaTimes, 
  FaExclamationTriangle,
  FaBan,
  FaGavel,
  FaSearch,
  FaEye,
  FaCommentDots
} from 'react-icons/fa';

const PriorityAlertAdmin = () => {
  const [alerts, setAlerts] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [stats, setStats] = useState({ activeAlerts: 0, pendingAppeals: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('alerts');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [filters, setFilters] = useState({
    is_active: true,
    alert_type: '',
    severity: ''
  });

  const [alertForm, setAlertForm] = useState({
    user_id: '',
    alert_type: 'warning',
    title: '',
    message: '',
    severity: 'high',
    can_appeal: true,
    expires_at: ''
  });

  const [appealResponse, setAppealResponse] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [alertsData, appealsData, statsData] = await Promise.all([
        getAllAlerts(filters),
        getAllAppeals(),
        getAlertStats()
      ]);
      setAlerts(alertsData);
      setAppeals(appealsData);
      setStats(statsData);
    } catch (error) {
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!alertForm.user_id || !alertForm.title || !alertForm.message) return;

    try {
      await createPriorityAlert(alertForm);
      showToast('Alerte créée avec succès', 'success');
      setShowCreateModal(false);
      resetAlertForm();
      loadData();
    } catch (error) {
      showToast('Erreur lors de la création de l\'alerte', 'error');
    }
  };

  const handleResolveAlert = async (alertId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir résoudre cette alerte ?')) return;

    try {
      await resolveAlert(alertId);
      showToast('Alerte résolue avec succès', 'success');
      loadData();
    } catch (error) {
      showToast('Erreur lors de la résolution', 'error');
    }
  };

  const handleProcessAppeal = async (appealId, decision) => {
    if (!appealResponse.trim()) {
      showToast('Veuillez ajouter une réponse', 'error');
      return;
    }

    try {
      await processAppeal(appealId, decision, appealResponse);
      showToast(`Appel ${decision === 'approved' ? 'approuvé' : 'rejeté'} avec succès`, 'success');
      setShowAppealModal(false);
      setAppealResponse('');
      loadData();
    } catch (error) {
      showToast('Erreur lors du traitement de l\'appel', 'error');
    }
  };

  const handleUserSearch = async (term) => {
    setSearchUser(term);
    if (term.length >= 2) {
      try {
        const results = await searchUsers(term);
        setSearchResults(results);
      } catch (error) {
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
  };

  const resetAlertForm = () => {
    setAlertForm({
      user_id: '',
      alert_type: 'warning',
      title: '',
      message: '',
      severity: 'high',
      can_appeal: true,
      expires_at: ''
    });
    setSearchUser('');
    setSearchResults([]);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('fr-FR');
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
    return colors[status] || colors.pending;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
              <FaExclamationTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Alertes actives</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeAlerts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
              <FaGavel className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Appels en attente</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingAppeals}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-lg shadow p-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FaPlus className="w-5 h-5 mr-2" />
            Créer une alerte
          </button>
        </div>
      </div>

      {/* Onglets */}
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
              Alertes ({alerts.length})
            </button>
            <button
              onClick={() => setSelectedTab('appeals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'appeals'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Appels ({appeals.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {selectedTab === 'alerts' && (
            <div className="space-y-4">
              {/* Filtres */}
              <div className="flex flex-wrap gap-4">
                <select
                  value={filters.is_active}
                  onChange={(e) => setFilters({...filters, is_active: e.target.value === 'true'})}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                >
                  <option value="true">Alertes actives</option>
                  <option value="false">Alertes résolues</option>
                </select>

                <select
                  value={filters.alert_type}
                  onChange={(e) => setFilters({...filters, alert_type: e.target.value})}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                >
                  <option value="">Tous les types</option>
                  <option value="error">Erreur</option>
                  <option value="warning">Avertissement</option>
                  <option value="violation">Violation</option>
                  <option value="suspension">Suspension</option>
                </select>

                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({...filters, severity: e.target.value})}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                >
                  <option value="">Toutes les sévérités</option>
                  <option value="critical">Critique</option>
                  <option value="high">Élevée</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Faible</option>
                </select>
              </div>

              {/* Liste des alertes */}
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <Avatar user={alert.user} size="sm" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {alert.title}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadge(alert.severity)}`}>
                              {getSeverityLabel(alert.severity)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {alert.alert_type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {alert.user?.first_name} {alert.user?.last_name} ({alert.user?.email})
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {alert.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Créée le {formatDate(alert.created_at)} par {alert.created_by_user?.first_name} {alert.created_by_user?.last_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {alert.is_active && (
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
                            title="Résoudre"
                          >
                            <FaCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'appeals' && (
            <div className="space-y-4">
              {appeals.map((appeal) => (
                <div key={appeal.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Avatar user={appeal.user} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            Appel pour: {appeal.alert?.title}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(appeal.status)}`}>
                            {appeal.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {appeal.user?.first_name} {appeal.user?.last_name}
                        </p>
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
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {appeal.status === 'pending' && (
                        <button
                          onClick={() => {
                            setSelectedAppeal(appeal);
                            setShowAppealModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                          title="Traiter l'appel"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setSelectedAppeal(appeal);
                          setShowChatModal(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" 
                        title="Tchat"
                      >
                        <FaCommentDots className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal création d'alerte */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Créer une alerte prioritaire
            </h3>
            <form onSubmit={handleCreateAlert} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Utilisateur *
                </label>
                <input
                  type="text"
                  value={searchUser}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  required
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="p-2 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer"
                        onClick={() => {
                          setAlertForm({...alertForm, user_id: user.id});
                          setSearchUser(`${user.first_name} ${user.last_name}`);
                          setSearchResults([]);
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <Avatar user={user} size="xs" />
                          <span className="text-sm">{user.first_name} {user.last_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Type</label>
                  <select
                    value={alertForm.alert_type}
                    onChange={(e) => setAlertForm({...alertForm, alert_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  >
                    <option value="error">Erreur</option>
                    <option value="warning">Avertissement</option>
                    <option value="violation">Violation</option>
                    <option value="suspension">Suspension</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Sévérité</label>
                  <select
                    value={alertForm.severity}
                    onChange={(e) => setAlertForm({...alertForm, severity: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  >
                    <option value="low">Faible</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Élevée</option>
                    <option value="critical">Critique</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Titre *
                </label>
                <input
                  type="text"
                  value={alertForm.title}
                  onChange={(e) => setAlertForm({...alertForm, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Message *
                </label>
                <textarea
                  value={alertForm.message}
                  onChange={(e) => setAlertForm({...alertForm, message: e.target.value})}
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={alertForm.can_appeal}
                  onChange={(e) => setAlertForm({...alertForm, can_appeal: e.target.checked})}
                  className="mr-2"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Permettre l'appel
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetAlertForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Créer l'alerte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal traitement d'appel */}
      {showAppealModal && selectedAppeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Traiter l'appel
            </h3>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-dark-700 p-4 rounded">
                <h4 className="font-medium mb-2">Détails de l'appel:</h4>
                <p className="text-sm mb-2"><strong>Utilisateur:</strong> {selectedAppeal.user?.first_name} {selectedAppeal.user?.last_name}</p>
                <p className="text-sm mb-2"><strong>Alerte:</strong> {selectedAppeal.alert?.title}</p>
                <p className="text-sm mb-2"><strong>Raison:</strong> {selectedAppeal.reason}</p>
                {selectedAppeal.additional_info && (
                  <p className="text-sm"><strong>Infos supplémentaires:</strong> {selectedAppeal.additional_info}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Réponse de l'administration *
                </label>
                <textarea
                  value={appealResponse}
                  onChange={(e) => setAppealResponse(e.target.value)}
                  rows="4"
                  placeholder="Expliquez votre décision..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  required
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setShowAppealModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg"
                >
                  Annuler
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleProcessAppeal(selectedAppeal.id, 'rejected')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Rejeter
                  </button>
                  <button
                    onClick={() => handleProcessAppeal(selectedAppeal.id, 'approved')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approuver
                  </button>
                </div>
              </div>
            </div>
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

export default PriorityAlertAdmin; 