import React, { useState, useEffect, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { uploadProfilePhoto, deleteOldProfilePhoto } from '../services/fileUpload';
import NetworkLogo from '../components/NetworkLogo';
import { getUserPreferences, updateUserPreferences } from '../services/auth';
import ImageCropper from '../components/ImageCropper';

// Fonction pour assombrir une couleur hexadécimale
const darkenColor = (color) => {
  // Si pas de couleur, retourne la couleur par défaut
  if (!color) return '6B7280';
  
  // Convertir la couleur hex en RGB
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  
  // Assombrir de 15%
  const darkenAmount = 0.85;
  const darkenR = Math.floor(r * darkenAmount);
  const darkenG = Math.floor(g * darkenAmount);
  const darkenB = Math.floor(b * darkenAmount);
  
  // Convertir en hex et retourner
  return `${darkenR.toString(16).padStart(2, '0')}${darkenG.toString(16).padStart(2, '0')}${darkenB.toString(16).padStart(2, '0')}`;
};

// Fonction pour déterminer si une couleur est sombre
const isColorDark = (color) => {
  if (!color) return false;
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
};

// Style pour le sélecteur avec bordure en dégradé
const selectStyle = `
  .theme-select-container {
    position: relative;
    margin-top: 0.5rem;
  }
  
  .theme-select {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    appearance: none;
    transition: all 0.2s;
    border: double 1px transparent;
    background-image: linear-gradient(white, white), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    background-origin: border-box;
    background-clip: padding-box, border-box;
    cursor: pointer;
  }
  
  .dark .theme-select {
    background-image: linear-gradient(#1e293b, #1e293b), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    color: white;
  }
  
  .theme-select:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
  }
  
  .select-icon {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #94a3b8;
  }
  
  .theme-preview {
    display: flex;
    margin-top: 1rem;
    border-radius: 0.75rem;
    overflow: hidden;
    border: double 1px transparent;
    background-image: linear-gradient(white, white), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    background-origin: border-box;
    background-clip: padding-box, border-box;
  }
  
  .dark .theme-preview {
    background-image: linear-gradient(#1e293b, #1e293b), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
  }
  
  .theme-option {
    flex: 1;
    padding: 1rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .theme-option.light {
    background-color: white;
    color: #1e293b;
  }
  
  .theme-option.dark {
    background-color: #1e293b;
    color: white;
  }
  
  .theme-option.selected {
    position: relative;
  }
  
  .theme-option.selected::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background-image: linear-gradient(135deg, #07d6fb, #ff66c4);
  }

  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  @media (max-width: 640px) {
    .hide-scrollbar {
      padding-bottom: 4px;
      margin-bottom: -4px;
    }
  }



  /* Style pour les inputs avec bordure en dégradé */
  .gradient-input {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    appearance: none;
    transition: all 0.2s;
    border: double 1px transparent;
    background-image: linear-gradient(white, white), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    background-origin: border-box;
    background-clip: padding-box, border-box;
  }
  
  .dark .gradient-input {
    background-image: linear-gradient(#1e293b, #1e293b), 
                      linear-gradient(135deg, #07d6fb, #ff66c4);
    color: white;
  }
  
  .gradient-input:focus {
    outline: none;
    box-shadow: 0 0 5px rgba(7, 214, 251, 0.5), 0 0 5px rgba(255, 102, 196, 0.5);
    background-image: linear-gradient(white, white), 
                      linear-gradient(135deg, #07d6fb 70%, #ff66c4);
  }
  
  .dark .gradient-input:focus {
    background-image: linear-gradient(#1e293b, #1e293b), 
                      linear-gradient(135deg, #07d6fb 70%, #ff66c4);
  }
  
  .gradient-input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background-image: linear-gradient(#f9fafb, #f9fafb), 
                      linear-gradient(135deg, #cbd5e1, #cbd5e1);
  }
  
  .dark .gradient-input:disabled {
    background-image: linear-gradient(#334155, #334155), 
                      linear-gradient(135deg, #475569, #475569);
  }
`;

const Account = () => {
  const { user, profile, preferences, isLoading, signOut, updateUserProfile, updateUserPreferences, refreshUserProfile, unreadMessagesCount, fetchUnreadMessagesCount } = useAuth();
  const { theme: currentTheme, setThemeMode } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [theme, setTheme] = useState('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [contactMessages, setContactMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showFixNotification, setShowFixNotification] = useState(false);
  const [showReferralNotification, setShowReferralNotification] = useState(false);
  const [defaultNetwork, setDefaultNetwork] = useState(null);
  const [defaultNetworkLoading, setDefaultNetworkLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState({ totalPoints: 0, monthlyPoints: 0 });
  const [loadingReferral, setLoadingReferral] = useState(false);

  const [showImageCropper, setShowImageCropper] = useState(false);
  const [selectedImageForCrop, setSelectedImageForCrop] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    // Affiche la notification uniquement si elle n'a pas été fermée auparavant
    if (localStorage.getItem('photoUpdateFixNotificationDismissed') !== 'true') {
      setShowFixNotification(true);
    }
    // Affiche la notification du système de parrainage si elle n'a pas été fermée
    if (localStorage.getItem('referralSystemNotificationDismissed') !== 'true') {
      setShowReferralNotification(true);
    }
  }, []);

  const handleDismissFixNotification = () => {
    localStorage.setItem('photoUpdateFixNotificationDismissed', 'true');
    setShowFixNotification(false);
  };

  const handleDismissReferralNotification = () => {
    localStorage.setItem('referralSystemNotificationDismissed', 'true');
    setShowReferralNotification(false);
  };

  // Remplir les formulaires avec les données existantes
  useEffect(() => {
    if (profile) {
      console.log('Setting name from profile:', profile.first_name, profile.last_name);
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      // Set photo preview if avatar_url exists
      if (profile.avatar_url) {
        setPhotoPreview(profile.avatar_url);
      }
    }
  }, [profile]);

  // Force profile sync on component mount
  useEffect(() => {
    if (user) {
      // Vérifier que les données sont synchronisées entre auth.users et la table users
      const syncProfileWithAuthMetadata = async () => {
        try {
          // Si des métadonnées existent mais ne sont pas dans le profil, les synchroniser
          if (
            user.user_metadata && 
            (
              (user.user_metadata.first_name && !profile?.first_name) || 
              (user.user_metadata.last_name && !profile?.last_name)
            )
          ) {
            console.log('Synchronisation des métadonnées avec le profil...');
            await updateUserProfile({
              first_name: user.user_metadata.first_name || '',
              last_name: user.user_metadata.last_name || ''
            });
            await refreshUserProfile();
          }
          // Inversement, si le profil a des données qui ne sont pas dans les métadonnées
          else if (
            profile && 
            (
              (profile.first_name && !user.user_metadata?.first_name) || 
              (profile.last_name && !user.user_metadata?.last_name)
            )
          ) {
            console.log('Synchronisation du profil avec les métadonnées...');
            await supabase.auth.updateUser({
              data: { 
                first_name: profile.first_name || '',
                last_name: profile.last_name || ''
              }
            });
          }
        } catch (err) {
          console.error('Erreur lors de la synchronisation des données:', err);
        }
      };
      
      syncProfileWithAuthMetadata();
    }
  }, [user, profile]);

  // Synchroniser theme avec currentTheme
  useEffect(() => {
    console.log("Context theme changed:", currentTheme);
    if (currentTheme && currentTheme !== theme) {
      setTheme(currentTheme);
    }
  }, [currentTheme]);

  // Initialiser le thème à partir des préférences utilisateur
  useEffect(() => {
    if (preferences) {
      console.log("Setting theme from preferences:", preferences.theme);
      setTheme(preferences.theme || 'light');
      setNotificationsEnabled(preferences.notification_enabled !== false);
    }
  }, [preferences]);

  // Charger le réseau par défaut
  useEffect(() => {
    const loadDefaultNetwork = async () => {
      if (!user) return;
      
      setDefaultNetworkLoading(true);
      try {
        const prefs = await getUserPreferences();
        if (prefs?.default_network_id) {
          // Nettoyer l'ID du réseau (enlever tout après le ':' s'il existe)
          const cleanNetworkId = prefs.default_network_id.includes(':') 
            ? prefs.default_network_id.split(':')[0] 
            : prefs.default_network_id;
          
          // Récupérer les informations du réseau depuis la table networks
          const { data: networkData, error: networkError } = await supabase
            .from('networks')
            .select('network_id, network_name')
            .eq('network_id', cleanNetworkId)
            .single();
          
          if (!networkError && networkData) {
            // Récupérer les informations de l'agence
            const { data: agencyData, error: agencyError } = await supabase
              .from('agency')
              .select('agency_name')
              .eq('network_id', cleanNetworkId)
              .single();
            
            setDefaultNetwork({
              ...networkData,
              agency_name: agencyData?.agency_name || 'Agence non spécifiée'
            });
          } else {
            setDefaultNetwork(null);
          }
        } else {
          setDefaultNetwork(null);
        }
      } catch (error) {
        console.error('Erreur lors du chargement du réseau par défaut:', error);
      } finally {
        setDefaultNetworkLoading(false);
      }
    };

    loadDefaultNetwork();

    // Écouter l'événement de changement du réseau par défaut
    const handleDefaultNetworkChange = () => {
      loadDefaultNetwork();
    };

    window.addEventListener('defaultNetworkChanged', handleDefaultNetworkChange);

    // Nettoyer l'écouteur à la destruction du composant
    return () => {
      window.removeEventListener('defaultNetworkChanged', handleDefaultNetworkChange);
    };
  }, [user]);

  // Récupérer les messages de contact de l'utilisateur et les marquer comme lus
  useEffect(() => {
    const fetchAndReadMessages = async () => {
      if (user && activeTab === 'messages') {
        try {
          setMessagesLoading(true);
          
          // Récupérer les messages avec les informations de l'administrateur qui a répondu
          const { data, error } = await supabase
            .from('contact_requests')
            .select(`
              *,
              admin_info:responded_by (
                id,
                first_name,
                last_name,
                avatar_url
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          setContactMessages(data || []);

          // Marquer les messages comme lus
          const unreadMessageIds = data
            .filter(msg => msg.response && !msg.is_read_by_user) // Message avec réponse et non lu
            .map(msg => msg.id);
          
          if (unreadMessageIds.length > 0) {
            const { error: updateError } = await supabase
              .from('contact_requests')
              .update({ is_read_by_user: true })
              .in('id', unreadMessageIds);
            
            if (updateError) throw updateError;
            
            // Rafraîchir le compteur global
            fetchUnreadMessagesCount();
          }

        } catch (error) {
          console.error('Erreur lors de la récupération des messages:', error);
          toast.error('Impossible de récupérer vos messages');
        } finally {
          setMessagesLoading(false);
        }
      }
    };
    
    fetchAndReadMessages();
  }, [user, activeTab, toast, fetchUnreadMessagesCount]);

  // Récupérer le code de parrainage de l'utilisateur
  useEffect(() => {
    const fetchReferralData = async () => {
      if (!user) return;
      
      setLoadingReferral(true);
      try {
        // Récupérer le code de parrainage
        const { data: codeData, error: codeError } = await supabase
          .from('user_referral_codes')
          .select('referral_code')
          .eq('user_id', user.id)
          .single();
        
        if (!codeError && codeData) {
          setReferralCode(codeData.referral_code);
        }
        


        // Récupérer les statistiques
        const { data: statsData, error: statsError } = await supabase
          .from('referral_points')
          .select('total_points, monthly_points')
          .eq('user_id', user.id)
          .single();
        
        if (!statsError && statsData) {
          setReferralStats({
            totalPoints: statsData.total_points,
            monthlyPoints: statsData.monthly_points
          });
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données de parrainage:', error);
      } finally {
        setLoadingReferral(false);
      }
    };
    
    fetchReferralData();
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    if (profileLoading) return;
    
    setProfileLoading(true);
    
    try {
      // Vérifier si le profil a changé
      if (firstName !== profile?.first_name || lastName !== profile?.last_name) {
        await updateUserProfile({
          first_name: firstName,
          last_name: lastName,
          // Keep the existing avatar_url when updating other profile fields
          ...(profile?.avatar_url && { avatar_url: profile.avatar_url })
        });
        
        toast.success('Profil mis à jour avec succès !');
      } else {
        toast.info('Aucune modification n\'a été apportée au profil.');
      }
    } catch (error) {
      console.error('Erreur de mise à jour du profil:', error);
      toast.error(error.message || 'Une erreur est survenue lors de la mise à jour du profil.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleThemeChange = async (newTheme) => {
    try {
      console.log("Changement de thème:", newTheme);
      setTheme(newTheme);
      setPreferencesLoading(true);
      
      // Mettre à jour le thème dans le localStorage temporairement
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('theme', newTheme);
      }
      
      // Appliquer le thème au DOM immédiatement
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
      
      // Appliquer immédiatement le thème via le contexte
      if (setThemeMode) {
        console.log("Appel de setThemeMode avec:", newTheme);
        setThemeMode(newTheme);
      } else {
        console.error("setThemeMode n'est pas disponible");
      }
      
      // Sauvegarder dans la base de données
      console.log("Sauvegarde dans la base de données...");
      await updateUserPreferences({
        theme: newTheme,
        notification_enabled: notificationsEnabled,
      });
      
      console.log("Thème mis à jour avec succès:", newTheme);
      toast.success('Thème mis à jour avec succès !');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du thème:', error);
      toast.error(error.message || 'Une erreur est survenue lors de la mise à jour du thème');
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleNotificationToggle = async (e) => {
    const newValue = e.target.checked;
    setNotificationsEnabled(newValue);
    
    try {
      setPreferencesLoading(true);
      
      // Sauvegarder dans la base de données
      await updateUserPreferences({
        theme,
        notification_enabled: newValue,
      });
      
      toast.success('Préférences mises à jour avec succès !');
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences:', error);
      toast.error(error.message || 'Une erreur est survenue lors de la mise à jour des préférences');
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // La redirection sera gérée par le contexte d'authentification
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      toast.error(error.message || 'Une erreur est survenue lors de la déconnexion');
    }
  };

  const handleRemoveDefaultNetwork = async () => {
    try {
      setDefaultNetworkLoading(true);
      await updateUserPreferences({ default_network_id: null });
      setDefaultNetwork(null);
      
      // Émettre un événement pour notifier que le réseau par défaut a changé
      window.dispatchEvent(new Event('defaultNetworkChanged'));
      
      toast.success('Réseau par défaut supprimé');
    } catch (error) {
      console.error('Erreur lors de la suppression du réseau par défaut:', error);
      toast.error('Impossible de supprimer le réseau par défaut');
    } finally {
      setDefaultNetworkLoading(false);
    }
  };

  // Handler for photo upload button click
  const handlePhotoButtonClick = () => {
    fileInputRef.current.click();
  };

  // Handler for photo file selection
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error("La taille de l'image dépasse la limite de 5 Mo.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast.error("Veuillez sélectionner un fichier image valide.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);

    // Create a preview of the selected image for cropping
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImageForCrop(e.target.result);
      setShowImageCropper(true);
    };
    reader.readAsDataURL(file);
  };

  // Handler for successful crop
  const handleCropComplete = async (croppedImageBlob) => {
    try {
      setShowImageCropper(false);
      setUploadingPhoto(true);

      // Créer un fichier à partir du blob recadré
      const croppedFile = new File([croppedImageBlob], selectedFile.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      // Create a preview of the cropped image
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(croppedFile);

      // Upload the cropped photo to Supabase storage
      const fileUrl = await uploadProfilePhoto(croppedFile, user.id);

      // Delete old photo if it exists
      if (profile && profile.avatar_url) {
        await deleteOldProfilePhoto(profile.avatar_url);
      }

      // Update the user profile with the new avatar URL
      await updateUserProfile({
        avatar_url: fileUrl,
      });

      toast.success('Photo de profil mise à jour avec succès');
    } catch (error) {
      console.error('Error uploading photo:', error);
      
      // Message d'erreur personnalisé pour l'erreur de bucket manquant
      if (error.message && error.message.includes('bucket')) {
        toast.error("Le stockage des photos n'est pas configuré. Veuillez contacter l'administrateur.");
      } else if (error.message && (error.message.toLowerCase().includes('payload too large') || error.message.includes('taille maximale'))) {
        toast.error("L'image est trop volumineuse. La taille ne doit pas dépasser 5 Mo.");
      } else if (error.message && (error.message.includes('format') || error.message.includes('extension'))) {
        toast.error(error.message);
      } else {
        toast.error("Erreur lors de l'envoi de la photo. Veuillez réessayer plus tard.");
      }
      
      // Revert preview to original avatar
      if (profile) {
        setPhotoPreview(profile.avatar_url);
      } else {
        setPhotoPreview(null);
      }
    } finally {
      setUploadingPhoto(false);
      setSelectedFile(null);
      setSelectedImageForCrop(null);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handler for crop cancellation
  const handleCropCancel = () => {
    setShowImageCropper(false);
    setSelectedImageForCrop(null);
    setSelectedFile(null);
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Fonction pour copier le code de parrainage
  const copyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      toast.success('Code de parrainage copié !');
    }
  };



  // Si l'utilisateur n'est pas connecté, afficher le message de connexion requis
  if (!user && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 px-4">
        <div className="max-w-md w-full space-y-8 bg-white dark:bg-dark-800 p-6 rounded-xl shadow-lg text-center">
          <div>
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              Accès restreint
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Vous devez être connecté pour accéder à l'espace compte
            </p>
          </div>
          <div>
            <Link
              to="/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Se connecter
            </Link>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Pas encore de compte ?{' '}
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                S'inscrire
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Chargement en cours...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {showFixNotification && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md shadow-lg mb-6 relative dark:bg-green-900 dark:text-green-200 dark:border-green-400">
            <div className="flex">
              <div className="py-1">
                <svg className="h-6 w-6 text-green-500 dark:text-green-400 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-grow">
                <p className="font-bold">Mise à jour</p>
                <p className="text-sm">Le problème concernant le changement de la photo de profil a été résolu. Vous pouvez désormais mettre à jour votre photo sans erreur.</p>
              </div>
              <button 
                onClick={handleDismissFixNotification}
                className="absolute top-2 right-2 p-1 rounded-full text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
              >
                <span className="sr-only">Fermer</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {showReferralNotification && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md shadow-lg mb-6 relative dark:bg-blue-900 dark:text-blue-200 dark:border-blue-400">
            <div className="flex">
              <div className="py-1">
                <svg className="h-6 w-6 text-blue-500 dark:text-blue-400 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-grow">
                <p className="font-bold">Nouveau système de parrainage</p>
                <p className="text-sm">Gagnez des points en parrainant vos amis et soyez 1er du classement ! Découvrez les récompenses dans l'onglet Parrainage.</p>
              </div>
              <button 
                onClick={handleDismissReferralNotification}
                className="absolute top-2 right-2 p-1 rounded-full text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                <span className="sr-only">Fermer</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden transition-colors duration-200">
          <div className="relative bg-gradient-to-br from-cyan-400 via-blue-500 to-pink-500 px-6 py-10 sm:px-8 overflow-hidden">
            {/* Motif décoratif en arrière-plan */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-32 -translate-y-32"></div>
              <div className="absolute top-20 right-0 w-96 h-96 bg-white rounded-full translate-x-48 -translate-y-48"></div>
              <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-white rounded-full -translate-x-40 translate-y-40"></div>
            </div>
            
            {/* Contenu principal */}
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                <div className="flex items-center mb-6 sm:mb-0">
                  <div className="mr-6 relative group">
                    <button
                      onClick={handlePhotoButtonClick}
                      disabled={uploadingPhoto}
                      className="relative block group-hover:scale-105 transition-transform duration-300 focus:outline-none focus:ring-4 focus:ring-white/50 rounded-full"
                    >
                      {photoPreview || profile?.avatar_url ? (
                        <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-white/30 bg-white shadow-2xl backdrop-blur-sm cursor-pointer relative">
                          <img 
                            src={photoPreview || profile?.avatar_url} 
                            alt="Profile" 
                            className="h-28 w-28 rounded-full object-cover"
                          />
                          {/* Overlay avec icône au hover */}
                          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <svg className="h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="h-28 w-28 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/30 shadow-2xl cursor-pointer relative">
                          <svg className="h-14 w-14 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {/* Overlay avec texte au hover */}
                          <div className="absolute inset-0 bg-black/30 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <svg className="h-6 w-6 text-white mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-xs text-white font-medium">Ajouter</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Indicateur de chargement */}
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </button>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/jpeg, image/png, image/jpg, image/gif"
                      onChange={handlePhotoChange}
                    />
                  </div>
                  <div className="text-white">
                    <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-shadow-lg">
                      Mon Compte
                    </h1>
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 inline-block shadow-lg">
                      <p className="text-white text-xl font-semibold tracking-wide">
                        {firstName?.toUpperCase()} {lastName?.toUpperCase()}
                      </p>
                    </div>
                    {user?.email && (
                      <p className="text-white/80 text-sm mt-2 font-medium">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {profile?.modtools === 1 && (
                    <button
                      onClick={() => navigate('/admin')}
                      className="group inline-flex items-center justify-center py-3 px-6 rounded-2xl text-base font-semibold text-white bg-white/20 backdrop-blur-sm hover:bg-white/30 focus:outline-none transform transition-all duration-200 border-2 border-white/30 hover:border-white/50 hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <svg className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform duration-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Administration
                    </button>
                  )}

                  <button
                    onClick={() => setShowConfirmLogout(true)}
                    className="group inline-flex items-center justify-center py-3 px-6 rounded-2xl text-base font-semibold text-white bg-red-500/90 backdrop-blur-sm hover:bg-red-600/90 focus:outline-none transform transition-all duration-200 border-2 border-red-400/50 hover:border-red-300/70 hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <svg className="mr-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Se déconnecter
                  </button>
                </div>
              </div>
            </div>

            <style jsx>{`
              .text-shadow-lg {
                text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
              }
            `}</style>
          </div>
          
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="px-6 py-2">
              {/* Version desktop - onglets classiques */}
              <nav className="hidden md:flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`${
                    activeTab === 'profile'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition duration-150 ease-in-out`}
                >
                  Profil
                </button>
                <button
                  onClick={() => setActiveTab('preferences')}
                  className={`${
                    activeTab === 'preferences'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition duration-150 ease-in-out`}
                >
                  Préférences
                </button>
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`relative ${
                    activeTab === 'messages'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition duration-150 ease-in-out`}
                >
                  Messagerie
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-3 -right-4 ml-2 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
                      {unreadMessagesCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('justificatif')}
                  className={`relative ${
                    activeTab === 'justificatif'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition duration-150 ease-in-out`}
                >
                  Justificatif de retard
                </button>
                <button
                  onClick={() => setActiveTab('parrainage')}
                  data-tab="parrainage"
                  className={`relative ${
                    activeTab === 'parrainage'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition duration-150 ease-in-out`}
                >
                  Parrainage
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                    referralStats.totalPoints > 0 
                      ? 'bg-gradient-to-r from-cyan-400 to-pink-500' 
                      : 'bg-gray-400'
                  }`}>
                    {referralStats.totalPoints} pts
                  </span>
                </button>
              </nav>
              
              {/* Version mobile - grille de cartes */}
              <div className="md:hidden">
                <div className="grid grid-cols-2 gap-2 py-2">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`${
                      activeTab === 'profile'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    } dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 border-2 rounded-lg p-3 text-center transition duration-150 ease-in-out`}
                  >
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-medium">Profil</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('preferences')}
                    className={`${
                      activeTab === 'preferences'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    } dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 border-2 rounded-lg p-3 text-center transition duration-150 ease-in-out`}
                  >
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-medium">Préférences</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('messages')}
                    className={`relative ${
                      activeTab === 'messages'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    } dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 border-2 rounded-lg p-3 text-center transition duration-150 ease-in-out`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {unreadMessagesCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full">
                            {unreadMessagesCount}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium">Messages</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('justificatif')}
                    className={`${
                      activeTab === 'justificatif'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    } dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 border-2 rounded-lg p-3 text-center transition duration-150 ease-in-out`}
                  >
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium">Justificatif</span>
                    </div>
                  </button>
                </div>
                
                {/* Deuxième ligne pour parrainage */}
                <div className="grid grid-cols-1 mt-2">
                  <button
                    onClick={() => setActiveTab('parrainage')}
                    data-tab="parrainage"
                    className={`relative ${
                      activeTab === 'parrainage'
                        ? 'bg-gradient-to-r from-cyan-100 to-pink-100 border-cyan-500 text-cyan-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    } dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 border-2 rounded-lg p-3 text-center transition duration-150 ease-in-out`}
                  >
                    <div className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-sm font-medium">Parrainage</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                        referralStats.totalPoints > 0 
                          ? 'bg-gradient-to-r from-cyan-400 to-pink-500' 
                          : 'bg-gray-400'
                      }`}>
                        {referralStats.totalPoints} pts
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {activeTab === 'profile' && (
            <div className="p-6">
              <style>{selectStyle}</style>
              <form onSubmit={handleUpdateProfile}>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Informations personnelles</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Mettez à jour vos informations personnelles.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex flex-col">
                      <label htmlFor="photo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Photo de profil
                      </label>
                      <div className="flex items-center mt-1">
                        <div className="flex-shrink-0">
                          {photoPreview || profile?.avatar_url ? (
                            <div className="h-24 w-24 rounded-full overflow-hidden">
                              <img 
                                src={photoPreview || profile?.avatar_url} 
                                alt="Profile" 
                                className="h-24 w-24 rounded-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-24 w-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <svg className="h-12 w-12 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="ml-2">
                          <button
                            type="button"
                            onClick={handlePhotoButtonClick}
                            disabled={uploadingPhoto}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-75"
                          >
{uploadingPhoto ? 'Enregistrement en cours...' : 'Changer la photo'}
                          </button>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            JPG, PNG ou GIF. 5 Mo maximum. Interface de recadrage optimisée pour mobile avec gestes tactiles.
                          </p>
                        </div>
                        <input 
                          type="file" 
                          id="photo" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/jpeg, image/png, image/jpg, image/gif"
                          onChange={handlePhotoChange}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col space-y-4">
                      <div className="w-full">
                        <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prénom</label>
                        <input
                          type="text"
                          name="first_name"
                          id="first_name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          autoComplete="given-name"
                          className="gradient-input w-full"
                        />
                      </div>
                      
                      <div className="w-full">
                        <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                        <input
                          type="text"
                          name="last_name"
                          id="last_name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          autoComplete="family-name"
                          className="gradient-input w-full"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                    <div className="flex-1">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adresse e-mail</label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={user?.email || ''}
                        disabled
                        autoComplete="email"
                        className="gradient-input"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">L'adresse e-mail ne peut pas être modifiée.</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className={`inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out ${
                      profileLoading ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {profileLoading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {activeTab === 'preferences' && (
            <div className="px-6 py-6 sm:p-8">
              <style>{selectStyle}</style>
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">Préférences utilisateur</h3>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Thème d'affichage
                  </label>
                  
                  <div className="theme-preview">
                    <div 
                      className={`theme-option light ${theme === 'light' ? 'selected' : ''}`}
                      onClick={() => handleThemeChange('light')}
                      style={{
                        transition: 'all 0.3s ease',
                        transform: theme === 'light' ? 'scale(1.05)' : 'scale(1)',
                        boxShadow: theme === 'light' ? '0 0 15px rgba(7, 214, 251, 0.5)' : 'none'
                      }}
                    >
                      <svg className="w-6 h-6 mx-auto mb-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Mode clair</span>
                      {theme === 'light' && (
                        <div className="mt-2 text-xs text-green-600">
                          <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Actif
                        </div>
                      )}
                    </div>
                    <div 
                      className={`theme-option dark ${theme === 'dark' ? 'selected' : ''}`}
                      onClick={() => handleThemeChange('dark')}
                      style={{
                        transition: 'all 0.3s ease',
                        transform: theme === 'dark' ? 'scale(1.05)' : 'scale(1)',
                        boxShadow: theme === 'dark' ? '0 0 15px rgba(255, 102, 196, 0.5)' : 'none'
                      }}
                    >
                      <svg className="w-6 h-6 mx-auto mb-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                      </svg>
                      <span className="font-medium">Mode sombre</span>
                      {theme === 'dark' && (
                        <div className="mt-2 text-xs text-green-400">
                          <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Actif
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Choisissez entre le mode clair et le mode sombre pour l'interface de l'application.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Réseau par défaut
                  </label>
                  
                  {defaultNetworkLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : defaultNetwork ? (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <NetworkLogo networkId={defaultNetwork.network_id} size="large" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {defaultNetwork.network_name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {defaultNetwork.agency_name}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveDefaultNetwork}
                        disabled={defaultNetworkLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Supprimer
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-400">
                        Aucun réseau de bus par défaut
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                        Sélectionnez un réseau comme favori depuis la liste des lignes
                      </p>
                    </div>
                  )}
                  
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Le réseau par défaut s'ouvre automatiquement lorsque vous lancez l'application.
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="notifications" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Notifications
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Recevoir des notifications par e-mail (Disponible été 2025)
                    </p>
                  </div>
                  <div className="relative inline-block w-12 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      name="notifications"
                      id="notifications"
                      checked={notificationsEnabled}
                      onChange={handleNotificationToggle}
                      disabled={true}
                      className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white dark:bg-gray-700 border-4 border-gray-300 dark:border-gray-600 appearance-none cursor-not-allowed transition-transform duration-200 ease-in-out"
                    />
                    <label
                      htmlFor="notifications"
                      className={`toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-not-allowed`}
                    ></label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Mes messages</h3>
              
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div></div>
                    <Link 
                      to="/contact" 
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                      </svg>
                      Nouveau Message
                    </Link>
                  </div>
                  {contactMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="h-12 w-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-400">Vous n'avez pas encore envoyé de message</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {contactMessages.map((message) => (
                        <div 
                          key={message.id} 
                          className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm p-4"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="flex items-center mb-3">
                                {message.object === 'bus_issue' && message.network_id && (
                                  <div className="mr-3 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg shadow-sm flex-shrink-0">
                                    <NetworkLogo 
                                      networkId={message.network_id}
                                      networkName=""
                                      size="normal"
                                      className="w-12 h-12"
                                    />
                                  </div>
                                )}
                                <h4 className="font-medium text-gray-900 dark:text-white break-words">
                                  {{
                                    'information': 'Demande d\'information',
                                    'bus_issue': 'Problème avec un réseau de bus (Horaires, Bus non passé, etc)',
                                    'support': 'Support technique',
                                    'feedback': 'Retour d\'expérience',
                                    'suggestion': 'Suggestion d\'amélioration',
                                    'partnership': 'Proposition de partenariat',
                                    'other': 'Autre'
                                  }[message.object] || message.object}
                                </h4>
                              </div>
                              <div className="flex items-center mb-3">
                                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                  {profile?.avatar_url ? (
                                    <img 
                                      src={profile.avatar_url} 
                                      alt="Avatar" 
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                                      {profile?.first_name ? profile.first_name[0].toUpperCase() : '?'}
                                    </div>
                                  )}
                                </div>
                                <div className="ml-2">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {profile?.first_name} {profile?.last_name} <span className="text-gray-500 dark:text-gray-400">(Vous)</span>
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Envoyé le {new Date(message.created_at).toLocaleDateString()} à {new Date(message.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                                  {message.message}
                                </p>
                              </div>
                            </div>
                            <span 
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 h-fit
                                ${!message.response ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 
                                  message.response.startsWith('En cours de traitement:') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 
                                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'}
                              `}
                            >
                              {!message.response ? 'En attente' : 
                               message.response.startsWith('En cours de traitement:') ? 'En traitement' : 
                               'Résolu'}
                            </span>
                          </div>
                          {message.response && (
                            <div className="mt-4">
                              <div className="flex items-start">
                                {message.admin_info && message.admin_info.avatar_url ? (
                                  <div className="flex-shrink-0 mr-3">
                                    <img 
                                      src={message.admin_info.avatar_url} 
                                      alt="Admin" 
                                      className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex-shrink-0 mr-3 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1">
                                  {message.admin_info && (
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {message.admin_info.first_name} {message.admin_info.last_name}
                                    </p>
                                  )}
                                  <div className="bg-blue-50 dark:bg-blue-900 border border-blue-100 dark:border-blue-800 rounded-lg p-3 mt-1">
                                    <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                                      {message.response.startsWith('En cours de traitement:') 
                                        ? message.response.substring('En cours de traitement:'.length) 
                                        : message.response}
                                    </p>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Répondu le {message.responded_at ? new Date(message.responded_at).toLocaleDateString() : '-'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'justificatif' && (
            <div className="p-6">
              <div className="text-center py-12">
                <svg className="mx-auto h-24 w-24 text-gray-400 dark:text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Fonctionnalité à venir</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Le système de justificatif de retard sera disponible à l'été 2025.
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Cette fonctionnalité vous permettra de soumettre et gérer vos justificatifs de retard en ligne.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'parrainage' && (
            <div className="p-6" data-section="parrainage">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Mon système de parrainage</h3>
              
              {loadingReferral ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Code de parrainage */}
                  <div className="bg-gradient-to-r from-cyan-400 to-pink-500 rounded-xl p-6 text-white shadow-lg referral-code" data-referral-code>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium opacity-90">Mon code de parrainage</h4>
                        <p className="text-2xl font-bold mt-1">{referralCode || 'Chargement...'}</p>
                      </div>
                      <button
                        onClick={copyReferralCode}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copier</span>
                      </button>
                    </div>
                    <p className="text-sm opacity-80 mt-3">
                      Partagez ce code avec vos amis. Vous gagnerez 1 point pour chaque inscription !
                    </p>
                  </div>

                  {/* Statistiques */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Points du mois</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                            {referralStats.monthlyPoints}
                          </p>
                        </div>
                        <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-3">
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Points à vie</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                            {referralStats.totalPoints}
                          </p>
                        </div>
                        <div className="bg-green-100 dark:bg-green-900 rounded-full p-3">
                          <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  

                  {/* Récompenses du classement */}
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Récompenses du classement
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Les 3 meilleurs parrains du mois remportent des cadeaux !
                    </p>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {/* 1er place */}
                      <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-800/30 dark:to-yellow-700/30 border border-yellow-300 dark:border-yellow-600 rounded-lg p-2 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-yellow-400 to-yellow-600"></div>
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-1 text-white font-bold text-sm shadow">
                            1
                          </div>
                          <div className="text-lg mb-1">🎁</div>
                          <p className="text-xs text-gray-700 dark:text-yellow-200 font-medium leading-tight">
                            50€
                          </p>
                        </div>
                      </div>

                      {/* 2ème place */}
                      <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700/30 dark:to-gray-600/30 border border-gray-300 dark:border-gray-500 rounded-lg p-2 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-gray-400 to-gray-600"></div>
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center mb-1 text-white font-bold text-sm shadow">
                            2
                          </div>
                          <div className="text-lg mb-1">🏆</div>
                          <p className="text-xs text-gray-700 dark:text-gray-200 font-medium leading-tight">
                            CONNECT+ 1 mois
                          </p>
                        </div>
                      </div>

                      {/* 3ème place */}
                      <div className="bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-800/30 dark:to-orange-700/30 border border-orange-300 dark:border-orange-600 rounded-lg p-2 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-400 to-orange-600"></div>
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mb-1 text-white font-bold text-sm shadow">
                            3
                          </div>
                          <div className="text-lg mb-1">🥉</div>
                          <p className="text-xs text-gray-700 dark:text-orange-200 font-medium leading-tight">
                            Goodies Bus Connect
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Classements */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Classements</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Découvrez qui sont les meilleurs parrains de la communauté !
                    </p>
                    <Link 
                      to="/referral-leaderboard"
                      className="group inline-flex items-center px-6 py-3 text-base font-semibold rounded-xl text-white bg-gradient-to-r from-cyan-400 to-pink-500 hover:from-cyan-500 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-cyan-300 transform transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="group-hover:translate-x-1 transition-transform duration-200">
                        Voir les classements complets
                      </span>
                      <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de recadrage d'image */}
      <ImageCropper
        imageSrc={selectedImageForCrop}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
        isOpen={showImageCropper}
      />
      
      {/* Modal de confirmation de déconnexion */}
      {showConfirmLogout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Confirmation de déconnexion</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Êtes-vous sûr de vouloir vous déconnecter ?</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmLogout(false)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Annuler
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account; 

<style>{`
  ${selectStyle}
  
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  @media (max-width: 640px) {
    .hide-scrollbar {
      padding-bottom: 4px;
      margin-bottom: -4px;
    }
  }
`}</style> 