import React, { createContext, useState, useContext, useCallback } from 'react';
import Toast from '../components/Toast';

// Créer le contexte
const ToastContext = createContext();

// Hook personnalisé pour utiliser le contexte
export const useToast = () => {
  return useContext(ToastContext);
};

// Provider du contexte
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Ajouter un toast
  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    // Utiliser une combinaison de timestamp et d'un nombre aléatoire pour garantir l'unicité
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prevToasts => [...prevToasts, { id, message, type, duration }]);
    return id;
  }, []);

  // Ajouter un toast unique identifié par une clé
  const uniqueToast = useCallback((uniqueKey, message, type = 'success', duration = 3000) => {
    console.log('[DEBUG] uniqueToast appelé', { uniqueKey, message, type, existingToasts: toasts.length });
    
    // Vérifier si un toast avec cette clé existe déjà
    const existingToast = toasts.find(toast => toast.uniqueKey === uniqueKey);
    
    console.log('[DEBUG] Vérification toast existant', { 
      uniqueKey, 
      toastExists: !!existingToast,
      existingToastId: existingToast?.id,
      allUniqueKeys: toasts.map(t => t.uniqueKey)
    });
    
    if (existingToast) {
      console.log('[DEBUG] Toast existant trouvé, pas de création', { uniqueKey, id: existingToast.id });
      return existingToast.id; // Ne pas créer de nouveau toast
    }
    
    // Créer un nouveau toast avec la clé unique
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[DEBUG] Création nouveau toast', { uniqueKey, id });
    
    setToasts(prevToasts => {
      const newToasts = [...prevToasts, { id, uniqueKey, message, type, duration }];
      console.log('[DEBUG] Nouveau state toasts', { 
        count: newToasts.length, 
        keys: newToasts.map(t => t.uniqueKey)
      });
      return newToasts;
    });
    
    return id;
  }, [toasts]);

  // Supprimer un toast
  const hideToast = useCallback((id) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  // Méthodes spécifiques pour chaque type de toast
  const success = useCallback((message, duration = 3000) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message, duration = 3000) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message, duration = 3000) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message, duration = 3000) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  // Versions uniques des méthodes spécifiques
  const uniqueSuccess = useCallback((uniqueKey, message, duration = 3000) => {
    return uniqueToast(uniqueKey, message, 'success', duration);
  }, [uniqueToast]);

  const uniqueError = useCallback((uniqueKey, message, duration = 3000) => {
    return uniqueToast(uniqueKey, message, 'error', duration);
  }, [uniqueToast]);

  const uniqueWarning = useCallback((uniqueKey, message, duration = 3000) => {
    return uniqueToast(uniqueKey, message, 'warning', duration);
  }, [uniqueToast]);

  const uniqueInfo = useCallback((uniqueKey, message, duration = 3000) => {
    return uniqueToast(uniqueKey, message, 'info', duration);
  }, [uniqueToast]);

  // Valeur du contexte
  const value = {
    showToast,
    hideToast,
    success,
    error,
    warning,
    info,
    uniqueToast,
    uniqueSuccess,
    uniqueError,
    uniqueWarning,
    uniqueInfo
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => hideToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastContext; 