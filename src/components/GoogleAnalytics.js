import { useEffect } from 'react';
import ReactGA from 'react-ga4';

const GoogleAnalytics = ({ measurementId }) => {
  useEffect(() => {
    // Initialisation de Google Analytics
    ReactGA.initialize(measurementId);
    
    // Envoyer la première page vue
    ReactGA.send({
      hitType: "pageview",
      page: window.location.pathname
    });
  }, [measurementId]);

  return null; // Ce composant n'a pas besoin de rendu
};

export default GoogleAnalytics; 