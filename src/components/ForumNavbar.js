import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { IoChatbubblesOutline } from "react-icons/io5";
import { getRecentForumActivity } from '../services/forumService';

const marqueeStyle = `
  .marquee-container {
    width: 100%;
    overflow: hidden;
    position: relative;
    height: 100%;
  }
  
  .marquee-content {
    display: inline-flex;
    white-space: nowrap;
    animation: marqueeAnimation 20s linear infinite;
    height: 100%;
    align-items: center;
  }
  
  .marquee-content:hover,
  .group:hover .marquee-content {
    animation-play-state: paused;
  }
  
  @keyframes marqueeAnimation {
    from { transform: translateX(0%); }
    to { transform: translateX(-50%); }
  }
`;

const ForumNavbar = () => {
  const [showForumIcon, setShowForumIcon] = useState(false);
  const [activeMarquee, setActiveMarquee] = useState(0);
  const [latestPost, setLatestPost] = useState(null);
  const navbarRef = useRef(null);

  const fetchLatestPost = async (forceRefresh = false) => {
    try {
      const cachedPost = sessionStorage.getItem('latestForumPost');
      const cachedTimestamp = sessionStorage.getItem('latestForumPostTimestamp');
      const now = new Date().getTime();

      // Si on force le rafraîchissement ou si le cache est expiré (30 secondes)
      if (forceRefresh || !cachedPost || !cachedTimestamp || (now - parseInt(cachedTimestamp, 10) > 30 * 1000)) {
        const recentActivity = await getRecentForumActivity(1);
        if (recentActivity && recentActivity.length > 0) {
          const post = recentActivity[0];
          
          // Vérifier si c'est un nouveau post
          if (cachedPost) {
            const oldPost = JSON.parse(cachedPost);
            if (oldPost.id !== post.id) {
              console.log('Nouveau sujet détecté:', post.title);
            }
          }
          
          setLatestPost(post);
          sessionStorage.setItem('latestForumPost', JSON.stringify(post));
          sessionStorage.setItem('latestForumPostTimestamp', now.toString());
        }
      } else {
        setLatestPost(JSON.parse(cachedPost));
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de l'activité récente du forum:", error);
    }
  };

  useEffect(() => {
    // Chargement initial
    fetchLatestPost();

    // Mise à jour automatique toutes les 30 secondes
    const refreshInterval = setInterval(() => {
      fetchLatestPost(true);
    }, 30000);

    // Écouter les événements de changement de page pour vérifier les mises à jour
    const handleFocus = () => {
      fetchLatestPost(true);
    };
    window.addEventListener('focus', handleFocus);

    // Écouter un événement personnalisé pour forcer la mise à jour
    const handleForumUpdate = () => {
      fetchLatestPost(true);
    };
    window.addEventListener('forumPostCreated', handleForumUpdate);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('forumPostCreated', handleForumUpdate);
    };
  }, []);

  useEffect(() => {
    const titleInterval = setInterval(() => {
      setShowForumIcon(prev => !prev);
    }, 4000);

    const marqueeInterval = setInterval(() => {
      // Cycle through 3 states if there is a post, otherwise 2 states
      setActiveMarquee(prev => (prev + 1) % (latestPost ? 3 : 2));
    }, 8000);

    return () => {
      clearInterval(titleInterval);
      clearInterval(marqueeInterval);
    };
  }, [latestPost]);

  // Calculer et appliquer la hauteur de la navbar
  useEffect(() => {
    const updateNavbarHeight = () => {
      if (navbarRef.current) {
        const height = navbarRef.current.offsetHeight;
        document.documentElement.style.setProperty('--forum-navbar-height', `${height}px`);
      } else {
        document.documentElement.style.setProperty('--forum-navbar-height', '0px');
      }
    };

    updateNavbarHeight();

    const resizeObserver = new ResizeObserver(updateNavbarHeight);
    if (navbarRef.current) {
      resizeObserver.observe(navbarRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const linkDestination = (activeMarquee === 2 && latestPost)
    ? `/forum/post/${latestPost.id}`
    : '/forum';

  return (
    <Link 
      ref={navbarRef}
      to={linkDestination} 
      className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-700 dark:to-purple-800 text-white flex items-center h-12 overflow-hidden group cursor-pointer w-full"
      style={{ marginTop: 'var(--alert-banner-height, 0px)' }}
    >
      <style>{marqueeStyle}</style>
      <div className="flex-shrink-0 bg-black/20 px-4 h-full flex items-center justify-center w-24 font-bold text-sm tracking-wider relative">
        <div className={`transition-opacity duration-500 absolute ${!showForumIcon ? 'opacity-100' : 'opacity-0'}`}>
          FORUM
        </div>
        <div className={`transition-opacity duration-500 absolute ${showForumIcon ? 'opacity-100' : 'opacity-0'}`}>
          <IoChatbubblesOutline size={22} />
        </div>
      </div>

      <div className="flex-grow relative h-full marquee-container">
        {/* Marquee 1: Default message */}
        <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeMarquee === 0 ? 'opacity-100' : 'opacity-0 -z-10'}`}>
          <div className="marquee-content">
            <span className="mx-8 text-sm">Une question, besoin d'aide ? Rejoignez la communauté !</span>
            <span className="text-white/50 mx-4">•</span>
            <span className="mx-8 text-sm">Une question, besoin d'aide ? Rejoignez la communauté !</span>
            <span className="text-white/50 mx-4">•</span>
          </div>
        </div>

        {/* Marquee 2: Call to action */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-in-out ${activeMarquee === 1 ? 'opacity-100' : 'opacity-0 -z-10'}`}>
          <span className="text-sm font-semibold tracking-wider">REJOINDRE LE FORUM</span>
        </div>

        {/* Marquee 3: Latest post */}
        {latestPost && (
          <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeMarquee === 2 ? 'opacity-100' : 'opacity-0 -z-10'}`}>
            <div className="marquee-content">
              <span className="mx-8 text-sm">
                <span className="uppercase font-semibold">{latestPost.author?.first_name || 'Anonyme'}</span> vient de lancer un sujet : "{latestPost.title}" 
              </span>
              <span className="text-white/50 mx-4">•</span>
              <span className="mx-8 text-sm">
                <span className="uppercase font-semibold">{latestPost.author?.first_name || 'Anonyme'}</span> vient de lancer un sujet : "{latestPost.title}" 
              </span>
              <span className="text-white/50 mx-4">•</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};

export default ForumNavbar; 