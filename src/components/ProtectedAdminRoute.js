import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

const ProtectedAdminRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsAuthenticated(false);
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        setIsAuthenticated(true);

        // Vérifier si l'utilisateur a les droits d'administration
        const { data: userData, error } = await supabase
          .from('users')
          .select('modtools')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erreur lors de la vérification des droits:', error);
          setIsAuthorized(false);
        } else {
          setIsAuthorized(userData && userData.modtools === 1);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Rediriger vers la page de connexion si non connecté
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAuthorized) {
    // Afficher un message d'erreur si connecté mais sans droits d'admin
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <div className="mb-4 flex justify-center">
              <svg className="h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Accès non autorisé
            </h2>
            <p className="text-gray-600 mb-6">
              Désolé, vous n'avez pas les droits d'administration nécessaires pour accéder à cette page.
            </p>
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Retour à l'accueil
            </a>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedAdminRoute; 