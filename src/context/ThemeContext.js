import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';

// Créer le contexte
const ThemeContext = createContext();

// Hook personnalisé pour utiliser le contexte de thème
export function useTheme() {
  return useContext(ThemeContext);
}

// Provider du contexte de thème
export function ThemeProvider({ children }) {
  const { user, preferences } = useAuth();
  
  // Vérifier si le mode sombre est déjà défini dans localStorage ou dans les préférences utilisateur
  const getInitialTheme = () => {
    // Si l'utilisateur est connecté et a des préférences, utiliser sa préférence de thème
    if (user && preferences?.theme) {
      console.log("Using theme from user preferences:", preferences.theme);
      return preferences.theme;
    }
    
    // Si l'utilisateur n'est pas connecté ou n'a pas de préférences, utiliser le thème stocké dans localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (typeof storedTheme === 'string') {
        console.log("Using theme from localStorage:", storedTheme);
        return storedTheme;
      }
      
      // Commenté pour ignorer les préférences du système et toujours utiliser le mode clair par défaut
      // const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
      // if (userMedia.matches) {
      //   console.log("Using dark theme from system preferences");
      //   return 'dark';
      // }
    }
    
    // Valeur par défaut : mode clair
    console.log("Using default light theme");
    return 'light';
  };
  
  const [theme, setTheme] = useState(getInitialTheme);
  
  // Mettre à jour le thème lorsque les préférences utilisateur changent
  useEffect(() => {
    if (user && preferences?.theme) {
      console.log("Updating theme from user preferences:", preferences.theme);
      setTheme(preferences.theme);
    }
  }, [user, preferences]);
  
  // Mettre à jour l'attribut de classe sur l'élément HTML et le localStorage
  useEffect(() => {
    console.log("Applying theme to document:", theme);
    const root = window.document.documentElement;
    
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    
    // Sauvegarder le thème dans localStorage pour tout le monde
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);
  
  // Fonction pour basculer entre les thèmes
  const toggleTheme = () => {
    console.log("Toggle theme, current theme:", theme);
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    return true;
  };
  
  // Fonction pour définir un thème spécifique
  const setThemeMode = (mode) => {
    console.log("Set theme mode:", mode);
    if (mode === 'light' || mode === 'dark') {
      setTheme(mode);
      return true;
    }
    return false;
  };
  
  const value = {
    theme,
    toggleTheme,
    setThemeMode,
    isAuthenticated: !!user
  };
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeContext; 