import React from 'react';
import { FaRoute, FaCalendarAlt, FaMapMarkerAlt } from 'react-icons/fa';

const Itineraries = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-center mb-6">
          <FaRoute className="text-blue-500 text-4xl mr-3" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Recherche d'Itinéraires</h1>
        </div>
        
        <div className="bg-blue-50 dark:bg-dark-700 rounded-lg p-6 mb-8 border-l-4 border-blue-500">
          <div className="flex items-center mb-4">
            <FaCalendarAlt className="text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Fonctionnalité à venir</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Cette fonctionnalité sera disponible à partir de <span className="font-bold">juillet 2025</span>.
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            Vous pourrez bientôt planifier vos trajets en recherchant des itinéraires d'un point A à un point B,
            avec des options de transport en commun optimisées pour votre confort et votre emploi du temps.
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
            Fonctionnalités à venir :
          </h3>
          <ul className="space-y-3 text-gray-600 dark:text-gray-300">
            <li className="flex items-start">
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mr-3">
                <FaMapMarkerAlt className="text-blue-500" />
              </div>
              <span>Recherche d'itinéraires multimodaux</span>
            </li>
            <li className="flex items-start">
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mr-3">
                <FaMapMarkerAlt className="text-blue-500" />
              </div>
              <span>Options de trajets alternatifs</span>
            </li>
            <li className="flex items-start">
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mr-3">
                <FaMapMarkerAlt className="text-blue-500" />
              </div>
              <span>Estimation précise des temps de trajet</span>
            </li>
            <li className="flex items-start">
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mr-3">
                <FaMapMarkerAlt className="text-blue-500" />
              </div>
              <span>Informations en temps réel sur les perturbations</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Itineraries; 