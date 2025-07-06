import React, { useState } from 'react';
import { MdWarning, MdInfo, MdError, MdExpandMore, MdExpandLess } from 'react-icons/md';

const TrafficAlert = ({ disruptions }) => {
  const [expandedAlerts, setExpandedAlerts] = useState(new Set());

  if (!disruptions || disruptions.length === 0) {
    return null;
  }

  const toggleAlert = (alertId) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  const getAlertIcon = (type, severity) => {
    if (type === 'Travaux' || severity === 'high') {
      return <MdError className="w-5 h-5 text-red-500" />;
    } else if (type === 'Arrêt non desservi' || severity === 'medium') {
      return <MdWarning className="w-5 h-5 text-orange-500" />;
    } else {
      return <MdInfo className="w-5 h-5 text-blue-500" />;
    }
  };

  const getAlertStyle = (type, severity) => {
    if (type === 'Travaux' || severity === 'high') {
      return {
        border: 'border-red-200 dark:border-red-800',
        background: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-800 dark:text-red-200'
      };
    } else if (type === 'Arrêt non desservi' || severity === 'medium') {
      return {
        border: 'border-orange-200 dark:border-orange-800',
        background: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-800 dark:text-orange-200'
      };
    } else {
      return {
        border: 'border-blue-200 dark:border-blue-800',
        background: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-800 dark:text-blue-200'
      };
    }
  };

  const cleanDescription = (description) => {
    if (!description) return '';
    
    // Nettoyer les balises HTML et les caractères spéciaux
    return description
      .replace(/<[^>]*>/g, '') // Retirer les balises HTML
      .replace(/&[a-z]+;/gi, ' ') // Retirer les entités HTML
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  };

  return (
    <div className="mb-4 space-y-3">
      {disruptions.map((disruption) => {
        const isExpanded = expandedAlerts.has(disruption.id);
        const alertStyle = getAlertStyle(disruption.type, disruption.severity);
        
        return (
          <div
            key={disruption.id}
            className={`rounded-lg border ${alertStyle.border} ${alertStyle.background} overflow-hidden transition-all duration-200`}
          >
            <div
              className="p-4 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => toggleAlert(disruption.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getAlertIcon(disruption.type, disruption.severity)}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold ${alertStyle.text} mb-1`}>
                      Info Trafic
                    </div>
                    <div className={`text-sm ${alertStyle.text} leading-relaxed`}>
                      {disruption.title}
                    </div>
                    {disruption.type && (
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${alertStyle.background} ${alertStyle.text} border ${alertStyle.border}`}>
                          {disruption.type}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  {isExpanded ? (
                    <MdExpandLess className={`w-5 h-5 ${alertStyle.text}`} />
                  ) : (
                    <MdExpandMore className={`w-5 h-5 ${alertStyle.text}`} />
                  )}
                </div>
              </div>
            </div>
            
            {isExpanded && (
              <div className={`px-4 pb-4 border-t ${alertStyle.border}`}>
                <div className={`text-sm ${alertStyle.text} mt-3 leading-relaxed`}>
                  {cleanDescription(disruption.description)}
                </div>
                
                {/* Lignes affectées */}
                {disruption.affectedLines && disruption.affectedLines.length > 0 && (
                  <div className="mt-3">
                    <div className={`text-xs font-medium ${alertStyle.text} mb-2`}>
                      Lignes concernées :
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {disruption.affectedLines.map((line, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-bold text-white"
                          style={{
                            backgroundColor: line.color || '#6B7280'
                          }}
                        >
                          {line.number}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Dates */}
                {(disruption.startDate || disruption.endDate) && (
                  <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                    {disruption.startDate && disruption.endDate && (
                      <span>
                        Du {new Date(disruption.startDate).toLocaleDateString('fr-FR')} 
                        {' au '} 
                        {new Date(disruption.endDate).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TrafficAlert; 