import React, { useEffect } from 'react';

const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Déterminer les classes CSS en fonction du type
  const getClasses = () => {
    switch (type) {
      case 'success':
        return {
          container: 'border-l-4 border-green-500 bg-white',
          icon: 'bg-green-100 text-green-500',
          closeButton: 'text-gray-400 hover:text-gray-600'
        };
      case 'error':
        return {
          container: 'border-l-4 border-red-500 bg-white shadow-md shadow-red-100',
          icon: 'bg-red-100 text-red-500',
          closeButton: 'text-gray-400 hover:text-red-600'
        };
      case 'warning':
        return {
          container: 'border-l-4 border-orange-500 bg-white shadow-md shadow-orange-100',
          icon: 'bg-orange-100 text-orange-500',
          closeButton: 'text-gray-400 hover:text-orange-600',
          pulse: true
        };
      case 'info':
        return {
          container: 'border-l-4 border-blue-500 bg-white',
          icon: 'bg-blue-100 text-blue-500',
          closeButton: 'text-gray-400 hover:text-gray-600'
        };
      default:
        return {
          container: 'border-l-4 border-green-500 bg-white',
          icon: 'bg-green-100 text-green-500',
          closeButton: 'text-gray-400 hover:text-gray-600'
        };
    }
  };

  // Déterminer l'icône en fonction du type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const classes = getClasses();

  return (
    <div 
      className={`fixed top-16 right-4 z-50 flex items-center w-full max-w-xs p-4 mb-4 rounded-lg shadow-lg toast-slide-in ${classes.container}`}
      role="alert"
      style={{
        animation: 'slideIn 0.3s ease-out forwards'
      }}
    >
      <div className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg relative ${classes.icon}`}>
        {classes.pulse && (
          <span 
            className="absolute inset-0 rounded-lg" 
            style={{
              animation: 'pulseRing 2s infinite',
              backgroundColor: 'rgba(234, 88, 12, 0.2)'
            }}
          />
        )}
        {getIcon()}
      </div>
      <div className="ml-3 text-sm font-normal text-gray-700">{message}</div>
      <button 
        type="button" 
        className={`ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 inline-flex items-center justify-center h-8 w-8 transition-colors ${classes.closeButton}`}
        onClick={onClose}
        aria-label="Fermer"
      >
        <span className="sr-only">Fermer</span>
        <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
        </svg>
      </button>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes slideIn {
            0% { transform: translateX(100%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }
          @keyframes pulseRing {
            0% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.3; }
            100% { transform: scale(0.8); opacity: 0.5; }
          }
        `
      }} />
    </div>
  );
};

export default Toast; 