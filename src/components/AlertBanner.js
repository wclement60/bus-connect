import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import NetworkLogo from './NetworkLogo';

// Fonction pour déterminer si le texte doit être blanc ou noir selon la luminosité du fond
const getContrastTextColor = (hexColor) => {
  if (!hexColor) return '#FFFFFF';

  // Enlever le '#' si présent
  const color = hexColor.charAt(0) === '#' ? hexColor.substring(1) : hexColor;
  
  // Gérer les formats courts (ex: #FFF)
  const fullHex = color.length === 3 ? color.split('').map(char => char + char).join('') : color;

  if (fullHex.length !== 6) return '#FFFFFF';

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  
  // Calcul de la luminosité (formule standard)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Si la luminosité est élevée (couleur claire), on retourne du texte noir, sinon blanc
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

// Composant personnalisé pour le défilement de texte avec couleur de fond adaptée
const AlertMarquee = ({ text, backgroundColor }) => {
  // Pour les textes courts, affichage normal sans animation
  if (text.length < 25) {
    return <p className="font-semibold">{text}</p>;
  }

  // Style CSS pour l'animation de défilement avec couleur adaptée
  const customMarqueeStyle = `
    @keyframes marqueeAnimation {
      from { transform: translateX(0%); }
      to { transform: translateX(-50%); }
    }
    
    .alert-marquee-container {
      width: 100%;
      overflow: hidden;
      position: relative;
    }
    
    .alert-marquee-content {
      display: inline-flex;
      white-space: nowrap;
      animation: marqueeAnimation 20s linear infinite;
    }
    
    .alert-marquee-content:hover {
      animation-play-state: paused;
    }
    
    .alert-separator {
      margin: 0 8px;
      opacity: 0.6;
    }
  `;

  // Générer la couleur de dégradé à partir de la couleur de fond
  const generateGradient = (color) => {
    // Enlever le '#' si présent
    const baseColor = color.charAt(0) === '#' ? color : `#${color}`;
    return `linear-gradient(to right, ${baseColor}, ${baseColor}00)`;
  };

  const leftGradient = generateGradient(backgroundColor);
  const rightGradient = `linear-gradient(to left, ${backgroundColor}, ${backgroundColor}00)`;

  return (
    <div className="relative overflow-hidden w-full">
      <style>{customMarqueeStyle}</style>
      <div className="alert-marquee-container">
        <div 
          className="absolute top-0 bottom-0 left-0 w-[15px] z-[2] pointer-events-none" 
          style={{ background: leftGradient }}
        ></div>
        <div className="alert-marquee-content">
          <span className="font-semibold">{text}</span>
          <span className="alert-separator">•</span>
          <span className="font-semibold">{text}</span>
          <span className="alert-separator">•</span>
        </div>
        <div 
          className="absolute top-0 bottom-0 right-0 w-[15px] z-[2] pointer-events-none" 
          style={{ background: rightGradient }}
        ></div>
      </div>
    </div>
  );
};

const AlertBanner = ({ networkId }) => {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [networkName, setNetworkName] = useState('');

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!networkId) return;

      try {
        const { data, error } = await supabase
          .from('alert_reseau')
          .select('nom, message, color')
          .eq('network_id', networkId)
          .eq('etat', 1); // 1 pour actif

        if (error) throw error;

        // Récupérer le nom du réseau
        const { data: networkData, error: networkError } = await supabase
          .from('networks')
          .select('network_name')
          .eq('network_id', networkId)
          .single();

        if (!networkError && networkData) {
          setNetworkName(networkData.network_name);
        }

        setAlerts(data || []);
      } catch (error) {
        console.error("Erreur lors de la récupération des alertes:", error);
      }
    };

    fetchAlerts();
  }, [networkId]);

  if (alerts.length === 0) {
    return null;
  }

  const handleAlertClick = (alert) => {
    setSelectedAlert(alert);
  };

  const closeModal = () => {
    setSelectedAlert(null);
  };

  return (
    <>
      <div>
        {alerts.map((alert, index) => (
          <div
            key={index}
            onClick={() => handleAlertClick(alert)}
            className="p-3 text-center cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: alert.color, color: getContrastTextColor(alert.color) }}
          >
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
              <AlertMarquee text={alert.nom} backgroundColor={alert.color} />
            </div>
          </div>
        ))}
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-2xl transform transition-all">
            {/* Header avec logo du réseau */}
            <div className="bg-white dark:bg-dark-800 p-4 border-b border-gray-100 dark:border-dark-700">
              <div className="flex flex-col">
                {/* Logo en haut à gauche */}
                <div className="w-16 h-16 mb-3">
                  <NetworkLogo 
                    networkId={networkId} 
                    networkName={networkName}
                    size="large"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      display: 'block'
                    }}
                  />
                </div>
                
                {/* Titre en dessous */}
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white break-words hyphens-auto" style={{ overflowWrap: 'break-word', wordWrap: 'break-word' }}>
                    {selectedAlert.nom}
                  </h3>
                </div>
              </div>
            </div>
            
            {/* Corps du message */}
            <div className="p-6 bg-white dark:bg-dark-800">
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{selectedAlert.message}</p>
            </div>
            
            {/* Footer avec bouton de fermeture */}
            <div className="bg-gray-50 dark:bg-dark-700 p-4 flex justify-end">
              <button
                onClick={closeModal}
                className="px-6 py-2.5 bg-gray-200 dark:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AlertBanner; 