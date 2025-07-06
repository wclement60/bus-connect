import React, { createContext, useState, useContext } from 'react';
import WelcomeAnimation from '../components/WelcomeAnimation';

const AnimationContext = createContext();

export const useAnimation = () => useContext(AnimationContext);

export const AnimationProvider = ({ children }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [firstName, setFirstName] = useState('');

  const playWelcomeAnimation = ({ firstName }) => {
    setFirstName(firstName);
    setIsAnimating(true);
    
    // Fait disparaître l'animation après sa durée
    setTimeout(() => {
      setIsAnimating(false);
    }, 4500); // Doit correspondre à la durée dans WelcomeAnimation.js
  };

  return (
    <AnimationContext.Provider value={{ playWelcomeAnimation }}>
      {children}
      {isAnimating && <WelcomeAnimation firstName={firstName} />}
    </AnimationContext.Provider>
  );
}; 