import React from 'react';

const TextMarquee = ({ text }) => {
  // Pour les textes courts, affichage normal sans animation
  if (text.length < 25) {
    return <span className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{text}</span>;
  }
  
  // Pour les textes longs, animation de défilement infini
  return (
    <div className="relative overflow-hidden w-full h-full flex items-center">
      <div className="absolute top-0 bottom-0 left-0 w-4 z-10 pointer-events-none bg-gradient-to-r from-white group-hover:from-gray-50 dark:from-dark-800 dark:group-hover:from-dark-700"></div>
      <div className="forum-marquee-container">
        <span className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{text}</span>
        <span className="text-gray-500 mx-4">•</span>
        <span className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{text}</span>
        <span className="text-gray-500 mx-4">•</span>
      </div>
      <div className="absolute top-0 bottom-0 right-0 w-4 z-10 pointer-events-none bg-gradient-to-l from-white group-hover:from-gray-50 dark:from-dark-800 dark:group-hover:from-dark-700"></div>
    </div>
  );
};

export default TextMarquee; 