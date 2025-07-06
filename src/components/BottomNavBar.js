import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useForumNotifications } from '../context/ForumNotificationContext';
import { getUserPreferences } from '../services/auth';
import { supabase } from '../services/supabase';
import { getActiveDisruptionsCount } from '../services/trafficService';

const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, forceRefreshProfile, unreadMessagesCount } = useAuth();
  const { theme, toggleTheme, isAuthenticated } = useTheme();
  const toast = useToast();
  const { unreadCount: forumUnreadCount } = useForumNotifications();
  const [displayName, setDisplayName] = useState('Mon Compte');
  const [menuOpen, setMenuOpen] = useState(false);
  const modalRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const lastTouchY = useRef(0);
  const swipeVelocity = useRef(0);
  const lastTouchTime = useRef(0);
  const animationRef = useRef(null);
  const isDragging = useRef(false);
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [startY, setStartY] = useState(null);
  const [currentY, setCurrentY] = useState(null);
  const [defaultNetworkInfo, setDefaultNetworkInfo] = useState(null);
  const [defaultNetworkName, setDefaultNetworkName] = useState('');
  const [defaultNetworkId, setDefaultNetworkId] = useState('');
  const [trafficDisruptionsCount, setTrafficDisruptionsCount] = useState(0);
  
  useEffect(() => {
    const fetchDefaultNetwork = async () => {
      if (!user) {
        setDefaultNetworkName('');
        setDefaultNetworkId('');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('default_network_id')
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') {
            console.error('Erreur lors de la récupération du réseau par défaut:', error);
          }
          setDefaultNetworkName('');
          setDefaultNetworkId('');
          return;
        }

        if (data?.default_network_id) {
          const networkId = data.default_network_id.includes(':') 
            ? data.default_network_id.split(':')[0] 
            : data.default_network_id;

          setDefaultNetworkId(networkId);

          const { data: networkData, error: networkError } = await supabase
            .from('networks')
            .select('network_name')
            .eq('network_id', networkId)
            .single();

          if (networkError) {
            console.error('Erreur lors de la récupération du nom du réseau:', networkError);
            setDefaultNetworkName('');
          } else {
            setDefaultNetworkName(networkData.network_name);
          }
        } else {
          setDefaultNetworkName('');
          setDefaultNetworkId('');
        }
      } catch (err) {
        console.error('Erreur inattendue:', err);
        setDefaultNetworkName('');
        setDefaultNetworkId('');
      }
    };

    fetchDefaultNetwork();

    // Écouter l'événement de changement du réseau par défaut
    const handleDefaultNetworkChange = () => {
      fetchDefaultNetwork();
    };

    window.addEventListener('defaultNetworkChanged', handleDefaultNetworkChange);

    // Nettoyer l'écouteur à la destruction du composant
    return () => {
      window.removeEventListener('defaultNetworkChanged', handleDefaultNetworkChange);
    };
  }, [user, location.pathname]);

  // Effet pour récupérer le nombre de perturbations actives
  useEffect(() => {
    const fetchTrafficCount = async () => {
      try {
        const count = await getActiveDisruptionsCount();
        setTrafficDisruptionsCount(count);
      } catch (error) {
        console.error('Erreur lors de la récupération du compteur de perturbations:', error);
        setTrafficDisruptionsCount(0);
      }
    };

    // Récupérer au chargement
    fetchTrafficCount();

    // Mettre à jour toutes les 5 minutes
    const interval = setInterval(fetchTrafficCount, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user && profile && profile.first_name) {
      const firstName = profile.first_name;
      const lastInitial = profile.last_name ? profile.last_name.charAt(0) + '.' : '';
      setDisplayName(`${firstName} ${lastInitial}`);
    } else if (user && user.user_metadata) {
      // Utiliser les métadonnées de l'utilisateur si le profil n'est pas disponible
      const firstName = user.user_metadata.first_name;
      const lastName = user.user_metadata.last_name;
      if (firstName) {
        const lastInitial = lastName ? lastName.charAt(0) + '.' : '';
        setDisplayName(`${firstName} ${lastInitial}`);
      } else {
        setDisplayName('Mon Compte');
      }
    } else {
      setDisplayName('Mon Compte');
    }
  }, [profile, user]);
  
  // Effet pour rafraîchir le profil lors du changement de page
  useEffect(() => {
    // Rafraîchir le profil lors de la navigation
    if (user) {
      forceRefreshProfile();
    }
  }, [location.pathname, user, forceRefreshProfile]);
  
  // Effet pour réinitialiser les styles du modal quand le menu est ouvert
  useEffect(() => {
    if (menuOpen && modalRef.current) {
      // Réinitialiser complètement tous les styles lors de l'ouverture du menu
      modalRef.current.style.transform = '';
      modalRef.current.style.opacity = '1';
      modalRef.current.style.borderRadius = '16px 16px 0 0';
      modalRef.current.style.transition = 'transform 0.3s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.3s ease, border-radius 0.3s ease';
    }
  }, [menuOpen]);
  
  const isActive = (path) => {
    if (path === '/') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const homePath = defaultNetworkId ? `/network/${defaultNetworkId}/lines` : '/';
  const isHomeActive = location.pathname === homePath || location.pathname === '/';

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    document.body.style.overflow = !menuOpen ? 'hidden' : '';
  };

  const closeMenu = () => {
    setMenuOpen(false);
    document.body.style.overflow = '';
  };

  // Optimisation de l'animation avec requestAnimationFrame
  const updatePosition = (y) => {
    if (!modalRef.current) return;
    
    // Appliquer une résistance progressive pour que le mouvement ralentisse à mesure qu'on tire
    const resistance = 1 - Math.min(y * 0.001, 0.5);
    const adjustedY = y * resistance;
    
    // Limiter le déplacement vers le haut (éviter les valeurs négatives)
    const finalY = Math.max(0, adjustedY);
    
    // Mettre à jour la position avec requestAnimationFrame pour une animation fluide
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animationRef.current = requestAnimationFrame(() => {
      if (modalRef.current) {
        modalRef.current.style.transform = `translateY(${finalY}px)`;
        // Ajouter un léger effet de scale pour un retour visuel
        const scale = 1 - (finalY * 0.0003);
        modalRef.current.style.borderRadius = `${16 + finalY * 0.1}px ${16 + finalY * 0.1}px 0 0`;
        modalRef.current.style.opacity = Math.max(1 - (finalY * 0.002), 0.7);
      }
    });
  };

  // Gestionnaires d'événements tactiles pour le swipe
  const handleTouchStart = (e) => {
    if (!modalRef.current) return;
    
    // Réinitialiser les styles de transition pour avoir un mouvement immédiat
    modalRef.current.style.transition = 'none';
    
    touchStartY.current = e.touches[0].clientY;
    lastTouchY.current = touchStartY.current;
    lastTouchTime.current = Date.now();
    isDragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    
    const currentY = e.touches[0].clientY;
    touchEndY.current = currentY;
    
    // Calculer la vitesse du mouvement
    const currentTime = Date.now();
    const dt = currentTime - lastTouchTime.current;
    if (dt > 0) {
      const dy = currentY - lastTouchY.current;
      swipeVelocity.current = dy / dt; // pixels par milliseconde
    }
    
    lastTouchY.current = currentY;
    lastTouchTime.current = currentTime;
    
    // Calculer la distance parcourue depuis le début
    const distance = touchEndY.current - touchStartY.current;
    
    // Seulement si l'utilisateur glisse vers le bas ET que la distance est significative
    if (distance > 10) { // Seuil plus élevé pour éviter les faux positifs
      updatePosition(distance);
      // Empêcher le scroll de la page seulement si on tire vraiment vers le bas
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    // Calculer la distance finale du swipe
    const distance = touchEndY.current - touchStartY.current;
    const velocity = swipeVelocity.current * 1000; // convertir en pixels par seconde
    
    // Si la distance est assez grande OU si la vitesse est suffisante, fermer le menu
    if (distance > 120 || velocity > 400) {
      if (modalRef.current) {
        // Animation de fermeture fluide
        modalRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, border-radius 0.3s ease';
        modalRef.current.style.transform = 'translateY(100%)';
        modalRef.current.style.opacity = '0';
      }
      
      // Attendre la fin de l'animation avant de fermer le menu
      setTimeout(closeMenu, 300);
    } else {
      // Sinon, remettre le menu à sa position initiale avec une animation
      if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.3s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.3s ease, border-radius 0.3s ease';
        modalRef.current.style.transform = '';
        modalRef.current.style.borderRadius = '16px 16px 0 0';
        modalRef.current.style.opacity = '1';
      }
    }
    
    // Réinitialiser
    swipeVelocity.current = 0;
    
    // Annuler toute animation en cours
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const handleThemeToggle = () => {
  
    
    // Vérifier explicitement si l'utilisateur est connecté
    if (user) {
      // L'utilisateur est connecté, permettre le changement de thème
      toggleTheme();
      toast.success(`Mode ${theme === 'dark' ? 'clair' : 'sombre'} activé`);
      closeMenu();
    } else {
      // L'utilisateur n'est pas connecté, afficher un toast et la modal
      toast.info('Connectez-vous pour changer le thème');
      setShowLoginModal(true);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-800 shadow-xl z-50 h-16 border-t border-gray-100 dark:border-dark-700 transition-colors duration-200">
        <div className="grid grid-cols-5 h-full">
          <Link 
            to={homePath} 
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              isHomeActive 
                ? 'text-blue-600 dark:text-blue-400 translate-y-[-4px]' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className={`p-1.5 rounded-full ${isHomeActive ? 'bg-blue-100 dark:bg-blue-900' : ''}`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
              </svg>
            </div>
            <span className="text-xs font-medium mt-0.5">{defaultNetworkName || 'Accueil'}</span>
          </Link>
          
          <Link 
            to="/account" 
            onClick={() => {
              if (user) {
                forceRefreshProfile();
              }
            }}
            className={`relative flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/account') 
                ? 'text-blue-600 dark:text-blue-400 translate-y-[-4px]' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className={`flex items-center justify-center rounded-full ${isActive('/account') ? 'bg-blue-100 dark:bg-blue-900' : ''}`}>
              {user && profile?.avatar_url ? (
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="p-1.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                  </svg>
                </div>
              )}
            </div>
            <span className="text-xs font-medium mt-0.5 truncate w-full px-0.5 text-center">{displayName}</span>
            {unreadMessagesCount > 0 && (
              <span className="absolute top-0 right-3.5 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-white dark:border-dark-800">
                {unreadMessagesCount}
              </span>
            )}
          </Link>
          
          <Link 
            to="/horaires" 
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/horaires') 
                ? 'text-blue-600 dark:text-blue-400 translate-y-[-4px]' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className={`p-1.5 rounded-full ${isActive('/horaires') ? 'bg-blue-100 dark:bg-blue-900' : ''}`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path>
              </svg>
            </div>
            <span className="text-xs font-medium mt-0.5">Horaires</span>
          </Link>
          
          <Link 
            to="/favorites" 
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/favorites') 
                ? 'text-blue-600 dark:text-blue-400 translate-y-[-4px]' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className={`p-1.5 rounded-full ${isActive('/favorites') ? 'bg-blue-100 dark:bg-blue-900' : ''}`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path>
              </svg>
            </div>
            <span className="text-xs font-medium mt-0.5">Favoris</span>
          </Link>
    
          
          <button 
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              menuOpen 
                ? 'text-blue-600 dark:text-blue-400 translate-y-[-4px]' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={toggleMenu}
          >
            <div className={`p-1.5 rounded-full ${menuOpen ? 'bg-blue-100 dark:bg-blue-900' : ''}`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
              </svg>
            </div>
            <span className="text-xs font-medium mt-0.5">Menu</span>
          </button>
        </div>
      </nav>

      {/* Menu modal */}
      <div 
        className={`fixed inset-0 bg-gray-800 bg-opacity-75 dark:bg-black dark:bg-opacity-80 z-50 flex items-end transition-opacity duration-300 ${
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMenu}
      >
        <div 
          ref={modalRef}
          className={`bg-white dark:bg-dark-800 w-full rounded-t-2xl will-change-transform transition-colors duration-200 max-h-[85vh] flex flex-col ${
            menuOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{
            transition: 'transform 0.3s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.3s ease, border-radius 0.3s ease'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Zone de glissement élargie */}
          <div 
            className="absolute left-0 right-0 -top-6 h-12 flex items-center justify-center"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-12 h-1 bg-gray-300 dark:bg-dark-600 rounded-full"></div>
          </div>
          
          {/* Header fixe avec gestion du swipe */}
          <div 
            className="flex justify-between items-center pt-6 pb-4 px-5 border-b border-gray-100 dark:border-dark-700 flex-shrink-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Menu</h3>
            <button 
              onClick={closeMenu}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            </button>
          </div>
          
          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <div className="grid grid-cols-1 gap-2.5 pt-4">
            <Link 
              to={homePath} 
              className={`p-3.5 hover:bg-blue-50 dark:hover:bg-dark-700 rounded-xl flex items-center transition-colors`} 
              onClick={closeMenu}
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-4">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                </svg>
              </div>
              <span className="text-gray-800 dark:text-gray-100 font-medium">{defaultNetworkName || 'Accueil'}</span>
            </Link>
            
            <Link 
              to="/itineraries" 
              className="p-3.5 hover:bg-blue-50 dark:hover:bg-dark-700 rounded-xl flex items-center transition-colors" 
              onClick={closeMenu}
            >
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-800 flex items-center justify-center mr-4">
                <svg className="w-5 h-5 text-teal-600 dark:text-teal-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path>
                </svg>
              </div>
              <span className="text-gray-800 dark:text-gray-100 font-medium">Itinéraires</span>
            </Link>
            
            <Link 
              to="/favorites" 
              className="p-3.5 hover:bg-blue-50 dark:hover:bg-dark-700 rounded-xl flex items-center transition-colors" 
              onClick={closeMenu}
            >
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-800 flex items-center justify-center mr-4">
                <svg className="w-5 h-5 text-red-600 dark:text-red-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path>
                </svg>
              </div>
              <span className="text-gray-800 dark:text-gray-100 font-medium">Favoris</span>
            </Link>
            
            <Link 
              to="/forum" 
              className="p-3.5 hover:bg-blue-50 dark:hover:bg-dark-700 rounded-xl flex items-center transition-colors" 
              onClick={closeMenu}
            >
              <div className="relative w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center mr-4">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"></path>
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"></path>
                </svg>
                {forumUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-white dark:border-dark-800">
                    {forumUnreadCount}
                  </span>
                )}
              </div>
              <span className="text-gray-800 dark:text-gray-100 font-medium">Forum</span>
            </Link>
            
            <Link 
              to="/traffic-info" 
              className="p-3.5 hover:bg-blue-50 dark:hover:bg-dark-700 rounded-xl flex items-center transition-colors" 
              onClick={closeMenu}
            >
              <div className="relative w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-800 flex items-center justify-center mr-4">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                </svg>
                {trafficDisruptionsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full border-3 border-white dark:border-dark-800">
                    {trafficDisruptionsCount}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-gray-800 dark:text-gray-100 font-medium">Info Trafic</span>
                {trafficDisruptionsCount > 0 && (
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    {trafficDisruptionsCount} perturbation{trafficDisruptionsCount > 1 ? 's' : ''} en cours
                  </span>
                )}
              </div>
            </Link>
            
            <Link 
              to="/account" 
              className="p-3.5 hover:bg-blue-50 dark:hover:bg-dark-700 rounded-xl flex items-center transition-colors" 
              onClick={() => {
                closeMenu();
                if (user) {
                  forceRefreshProfile();
                }
              }}
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-4 overflow-hidden">
                {user && profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                  </svg>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-gray-800 dark:text-gray-100 font-medium">Mon Compte</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {displayName}
                </span>
              </div>
            </Link>
            
            <button 
              className="p-3.5 hover:bg-blue-50 dark:hover:bg-dark-700 rounded-xl flex items-center transition-colors w-full text-left" 
              onClick={handleThemeToggle}
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-4">
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                  </svg>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-gray-800 dark:text-gray-100 font-medium">
                  {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                </span>
                {!user && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Connectez-vous pour changer le thème
                  </span>
                )}
              </div>
            </button>
            
            <Link 
              to="/contact" 
              className="p-3.5 hover:bg-blue-50 dark:hover:bg-dark-700 rounded-xl flex items-center transition-colors" 
              onClick={closeMenu}
            >
              <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-800 flex items-center justify-center mr-4">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                </svg>
              </div>
              <span className="text-gray-800 dark:text-gray-100 font-medium">Contact</span>
            </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de connexion requise pour le mode sombre */}
      {showLoginModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div 
            className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm" 
            onClick={() => setShowLoginModal(false)}
          ></div>
          <div className="bg-white dark:bg-dark-800 p-6 rounded-lg shadow-xl z-10 max-w-md w-full mx-4 transition-colors duration-200">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Connexion requise</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Vous devez être connecté pour changer le thème de l'application. Le thème est sauvegardé dans vos préférences utilisateur.
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setShowLoginModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  closeMenu();
                  navigate('/login');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors mt-2 sm:mt-0"
              >
                Se connecter
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Notification de connexion (pour référence, peut être supprimée si vous utilisez uniquement la modal) */}
      {showLoginAlert && (
        <div className="fixed top-16 left-0 right-0 flex justify-center items-center z-50">
          <div className="bg-blue-500 text-white rounded-lg shadow-lg px-4 py-3 flex items-center animate-fade-in-down">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Vous devez être connecté pour changer le thème</span>
          </div>
        </div>
      )}
    </>
  );
};

export default BottomNavBar; 