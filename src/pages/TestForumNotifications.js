import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useForumNotifications } from '../context/ForumNotificationContext';
import { getUnreadForumNotificationsCount } from '../services/forumService';

const TestForumNotifications = () => {
  const { user } = useAuth();
  const { unreadCount, refreshNotificationCount } = useForumNotifications();
  const [manualCount, setManualCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleManualCheck = async () => {
    setLoading(true);
    try {
      const count = await getUnreadForumNotificationsCount();
      setManualCount(count);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await refreshNotificationCount();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              Vous devez être connecté pour tester les notifications du forum.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Test des Notifications Forum
          </h1>
          
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Compteur du Contexte
              </h2>
              <p className="text-blue-800 dark:text-blue-200">
                Notifications non lues: <span className="font-bold text-xl">{unreadCount}</span>
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h2 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                Test Manuel
              </h2>
              <p className="text-green-800 dark:text-green-200 mb-3">
                Compteur manuel: <span className="font-bold text-xl">{manualCount}</span>
              </p>
              <button
                onClick={handleManualCheck}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Vérification...' : 'Vérifier manuellement'}
              </button>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h2 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                Actions
              </h2>
              <button
                onClick={handleRefresh}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg mr-3"
              >
                Rafraîchir le contexte
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Instructions de test
              </h2>
              <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-1">
                <li>Créez un post sur le forum avec un autre compte</li>
                <li>Répondez à ce post avec le compte de test</li>
                <li>Connectez-vous avec le compte auteur du post original</li>
                <li>Le compteur devrait afficher "1" notification</li>
                <li>Visitez le post pour le marquer comme lu</li>
                <li>Le compteur devrait revenir à "0"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestForumNotifications; 