import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  getProfile, 
  getUserPreferences, 
  signOut as signOutService, 
  updateProfile as updateProfileService, 
  updateUserPreferences as updateUserPreferencesService 
} from '../services/auth';

// Création du contexte d'authentification
const AuthContext = createContext({
  user: null,
  profile: null,
  preferences: null,
  isLoading: true,
  signIn: () => {},
  signOut: () => {},
  updateUserProfile: () => {},
  updateUserPreferences: () => {},
  unreadMessagesCount: 0,
  fetchUnreadMessagesCount: () => {},
});

// Hook personnalisé pour utiliser le contexte d'authentification
export const useAuth = () => useContext(AuthContext);

// Fournisseur du contexte d'authentification
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const navigate = useNavigate();

  const fetchUnreadMessagesCount = useCallback(async () => {
    if (!user) {
      setUnreadMessagesCount(0);
      return;
    }
    try {
      const { count, error } = await supabase
        .from('contact_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('response', 'is', null)  // Message avec une réponse
        .eq('is_read_by_user', false); // Non lu par l'utilisateur

      if (error) {
        throw error;
      }
      setUnreadMessagesCount(count || 0);
    } catch (error) {
      console.error("Erreur lors de la récupération du nombre de messages non lus:", error);
      setUnreadMessagesCount(0);
    }
  }, [user]);

  // Fonction pour mettre à jour le profil de l'utilisateur
  const refreshUserProfile = async () => {
    if (!user) {
      setProfile(null); // S'assurer que le profil est vidé si pas d'utilisateur
      return;
    }
    
    try {
      // Utiliser la fonction de service getProfile qui est mise en cache
      const profileData = await getProfile(); 
      setProfile(profileData);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du profil (contexte):', error);
      setProfile(null); // Réinitialiser en cas d'erreur
    }
  };

  // Fonction pour forcer le rafraîchissement du profil (à utiliser après navigation)
  const forceRefreshProfile = async () => {
    if (user) {
      await refreshUserProfile();
    }
  };

  // Fonction pour mettre à jour les préférences de l'utilisateur
  const refreshUserPreferences = async () => {
    if (!user) {
      setPreferences(null); // S'assurer que les préférences sont vidées si pas d'utilisateur
      return;
    }
    
    try {
      // Utiliser la fonction de service getUserPreferences qui est mise en cache
      const preferencesData = await getUserPreferences();
      setPreferences(preferencesData);
    } catch (error) {
      console.error('Erreur lors de la récupération des préférences (contexte):', error);
      setPreferences(null); // Réinitialiser en cas d'erreur
    }
  };

  // Vérifier la session au chargement de l'application
  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          await refreshUserProfile();
          await refreshUserPreferences();
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de la session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setIsLoading(true);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await refreshUserProfile();
          await refreshUserPreferences();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setPreferences(null);
        } else if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user);
          await refreshUserProfile();
        }
        
        setIsLoading(false);
      }
    );

    // Nettoyer l'abonnement aux événements d'authentification
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchUnreadMessagesCount();
    }
  }, [user, fetchUnreadMessagesCount]);

  // Écouter les changements dans la table contact_requests pour mettre à jour le compteur
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('contact_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_requests',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Changement détecté dans contact_requests, mise à jour du compteur...', payload);
          fetchUnreadMessagesCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadMessagesCount]);

  // Fonctions pour l'authentification
  const signIn = async (email, password) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      // Effacer immédiatement les données utilisateur pour une mise à jour instantanée de l'UI
      setUser(null);
      setProfile(null);
      setPreferences(null);
      
      // Appeler la fonction signOut du service auth.js qui gère l'invalidation du cache
      await signOutService();
      
      // Rediriger vers la page de login
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion (contexte):', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (updates) => {
    if (!user) throw new Error('Utilisateur non connecté pour updateUserProfile (contexte)');
    try {
      setIsLoading(true);
      // Utiliser la fonction de service updateProfile de ../services/auth
      // qui gère la mise à jour et l'invalidation du cache.
      await updateProfileService(updates); // Assurez-vous d'importer updateProfileService
      
      // Rafraîchir le profil local dans le contexte en utilisant la fonction mise en cache
      await refreshUserProfile(); 
      return true;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil (contexte):', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPreferences = async (updates) => {
    if (!user) throw new Error('Utilisateur non connecté pour updateUserPreferences (contexte)');
    try {
      setIsLoading(true);
      // Utiliser la fonction de service updateUserPreferences de ../services/auth
      // qui gère la mise à jour et l'invalidation du cache.
      await updateUserPreferencesService(updates); // Assurez-vous d'importer updateUserPreferencesService
      
      // Rafraîchir les préférences locales dans le contexte en utilisant la fonction mise en cache
      await refreshUserPreferences();
      return true;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences (contexte):', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Valeur du contexte
  const value = {
    user,
    profile,
    preferences,
    isLoading,
    signIn,
    signOut,
    updateUserProfile,
    updateUserPreferences,
    refreshUserProfile,
    refreshUserPreferences,
    forceRefreshProfile,
    unreadMessagesCount,
    fetchUnreadMessagesCount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext; 