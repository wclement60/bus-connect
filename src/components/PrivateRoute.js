import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Si on est en train de charger, on ne montre rien pour éviter le flash
  if (isLoading) {
    return null;
  }

  if (!user) {
    // Rediriger vers la page de login si l'utilisateur n'est pas connecté
    // On sauvegarde la page d'origine pour pouvoir y revenir après la connexion
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default PrivateRoute; 