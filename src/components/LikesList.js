import React, { useState, useEffect } from 'react';
import { getForumLikes } from '../services/forumService';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const LikesList = ({ targetId, targetType, likeCount }) => {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (likeCount > 0) {
      loadLikes();
    }
  }, [targetId, targetType, likeCount]);

  const loadLikes = async () => {
    setLoading(true);
    try {
      const likesData = await getForumLikes(targetId, targetType);
      setLikes(likesData);
    } catch (error) {
      console.error('Erreur lors du chargement des likes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (likeCount === 0) {
    return null;
  }

  const formatLikesText = () => {
    if (likes.length === 0) return '';
    
    // Vérifier si l'utilisateur actuel a liké (parmi les likes)
    const currentUserLike = likes.find(like => like.user.id === user?.id);
    const otherLikes = likes.filter(like => like.user.id !== user?.id);
    
    if (likes.length === 1) {
      if (currentUserLike) {
        return "Vous avez aimé ce message";
      } else {
        return `${likes[0].user.first_name} a aimé ce message`;
      }
    } else if (likes.length === 2) {
      if (currentUserLike) {
        return `Vous et ${otherLikes[0].user.first_name} avez aimé ce message`;
      } else {
        return `${likes[0].user.first_name} et ${likes[1].user.first_name} ont aimé ce message`;
      }
    } else {
      if (currentUserLike) {
        const othersCount = otherLikes.length;
        if (othersCount === 1) {
          return `Vous et ${otherLikes[0].user.first_name} avez aimé ce message`;
        } else {
          return `Vous et ${othersCount} ${othersCount === 1 ? 'personne' : 'personnes'} avez aimé ce message`;
        }
      } else {
        const othersCount = likes.length - 1;
        return `${likes[0].user.first_name} et ${othersCount} ${othersCount === 1 ? 'personne' : 'personnes'} ont aimé ce message`;
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 mt-3 text-sm text-gray-500 dark:text-gray-400">
        <div className="animate-pulse">
          <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
        <span>Chargement...</span>
      </div>
    );
  }

  // Déterminer quel avatar afficher
  const getAvatarToShow = () => {
    if (likes.length === 0) return null;
    
    const currentUserLike = likes.find(like => like.user.id === user?.id);
    
    // Si l'utilisateur actuel a liké, afficher son avatar
    if (currentUserLike) {
      return currentUserLike.user;
    }
    
    // Sinon, afficher l'avatar du dernier à avoir liké
    return likes[0].user;
  };

  const avatarUser = getAvatarToShow();

  return (
    <div className="flex items-center space-x-2 mt-3">
      {/* Avatar de l'utilisateur approprié */}
      {avatarUser && (
        <Avatar user={avatarUser} size="xs" />
      )}
      
      {/* Texte des likes */}
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {formatLikesText()}
      </span>
    </div>
  );
};

export default LikesList; 