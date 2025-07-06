import React, { useState, useEffect, useCallback } from 'react';
import Toast from './Toast';

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  // Ajouter un toast
  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, message, type, duration }]);
    return id;
  }, []);

  // Supprimer un toast
  const removeToast = useCallback((id) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  // Ajouter les méthodes au window pour les rendre accessibles globalement
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.showToast = addToast;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.showToast;
      }
    };
  }, [addToast]);

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer; 