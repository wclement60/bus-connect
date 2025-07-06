import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const DebugProfile = () => {
  const { user, profile, refreshUserProfile } = useAuth();
  const [authUserData, setAuthUserData] = useState(null);
  const [publicUserData, setPublicUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Récupérer les données auth.users
        if (user) {
          const { data: authData, error: authError } = await supabase.auth.admin.getUserById(user.id);
          if (authError) throw authError;
          setAuthUserData(authData);
          
          // Récupérer les données public.users
          const { data: publicData, error: publicError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (publicError) throw publicError;
          setPublicUserData(publicData);
        }
      } catch (err) {
        console.error('Erreur de débogage:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  const forceRefresh = async () => {
    try {
      setLoading(true);
      await refreshUserProfile();
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const updateFirstNameLastName = async () => {
    try {
      setLoading(true);
      
      // Mettre à jour directement dans la base de données
      const { error } = await supabase
        .from('users')
        .update({ 
          first_name: 'CLEMENT',
          last_name: 'WEIBEL'
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      await refreshUserProfile();
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="p-6">Chargement en cours...</div>;
  }
  
  if (error) {
    return <div className="p-6 text-red-600">Erreur: {error}</div>;
  }
  
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Débogage du Profil</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Données de l'utilisateur connecté</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Données du profil (context)</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(profile, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Données auth.users</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(authUserData, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Données public.users</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(publicUserData, null, 2)}
        </pre>
      </div>
      
      <div className="flex space-x-4">
        <button 
          onClick={forceRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Forcer le rafraîchissement
        </button>
        
        <button 
          onClick={updateFirstNameLastName}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Mettre à jour first_name/last_name
        </button>
      </div>
    </div>
  );
};

export default DebugProfile; 