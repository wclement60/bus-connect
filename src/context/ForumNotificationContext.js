import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getUnreadForumNotificationsCount } from '../services/forumService';

const ForumNotificationContext = createContext();

export const useForumNotifications = () => {
  const context = useContext(ForumNotificationContext);
  if (!context) {
    throw new Error('useForumNotifications must be used within a ForumNotificationProvider');
  }
  return context;
};

export const ForumNotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fonction pour rafraîchir le compteur
  const refreshNotificationCount = async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const count = await getUnreadForumNotificationsCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement des notifications forum:', error);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Rafraîchir au montage et quand l'utilisateur change
  useEffect(() => {
    refreshNotificationCount();
  }, [user]);

  // Rafraîchir périodiquement (toutes les 30 secondes)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(refreshNotificationCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const value = {
    unreadCount,
    isLoading,
    refreshNotificationCount
  };

  return (
    <ForumNotificationContext.Provider value={value}>
      {children}
    </ForumNotificationContext.Provider>
  );
}; 