import React from 'react';

const Avatar = ({ 
  user, 
  size = 'md', 
  className = '',
  showName = false 
}) => {
  // Tailles prédéfinies
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-20 h-20 text-2xl'
  };

  // Couleurs pour les initiales (basées sur le nom)
  const getColorFromName = (name) => {
    if (!name) return 'bg-gray-500';
    
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500'
    ];
    
    const hash = name.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Récupérer les initiales
  const getInitials = () => {
    if (!user) return '?';
    
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    } else if (lastName) {
      return lastName[0].toUpperCase();
    }
    
    return '?';
  };

  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Utilisateur inconnu';
  const initials = getInitials();
  const colorClass = getColorFromName(fullName);
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Déterminer si on affiche une photo ou les initiales
  const hasValidAvatar = user?.avatar_url && user.avatar_url.trim() !== '';

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-medium overflow-hidden flex-shrink-0`}>
        {hasValidAvatar ? (
          // Affichage photo uniquement
          <img
            src={user.avatar_url}
            alt={fullName}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Si l'image ne charge pas, cacher l'img et réafficher en mode initiales
              e.target.parentElement.innerHTML = `<div class="w-full h-full ${colorClass} flex items-center justify-center">${initials}</div>`;
            }}
          />
        ) : (
          // Affichage initiales uniquement
          <div className={`w-full h-full ${colorClass} flex items-center justify-center`}>
            {initials}
          </div>
        )}
      </div>
      {showName && (
        <span className="font-medium text-gray-900 dark:text-white">
          {fullName}
        </span>
      )}
    </div>
  );
};

export default Avatar; 