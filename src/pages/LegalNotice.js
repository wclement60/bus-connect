import React from 'react';

const LegalNotice = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-dark-800 shadow-lg rounded-lg overflow-hidden transition-colors duration-200">
          <div className="p-6 sm:p-10">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Mentions Légales
            </h1>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Éditeur de l'application</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Nom de l'application : Bus Connect<br />
                Contact par e-mail : <a href="mailto:contact@busconnect.fr" className="text-blue-600 dark:text-blue-400 hover:underline">contact@busconnect.fr</a>
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Hébergeur</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                OVH (SAS OVH)<br />
                Siège social : 2 rue Kellermann – 59100 Roubaix – France<br />
                Site Web : <a href="https://www.ovh.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">www.ovh.com</a>
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Délégué à la Protection des Données (DPD) / Responsable des données personnelles</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Contact par e-mail : <a href="mailto:contact@busconnect.fr" className="text-blue-600 dark:text-blue-400 hover:underline">contact@busconnect.fr</a>
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Données Open Data & Temps Réel</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                L'application Bus Connect utilise des données de transport en temps réel, fournies notamment via la plateforme officielle de l'Open Data des transports en France : 
                <a href="https://transport.data.gouv.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline ml-1">transport.data.gouv.fr</a>.
              </p>
              
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 mt-4">Utilisation de l'Open Data :</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Les données Open Data sont accessibles librement et gratuitement, favorisant la transparence, l'innovation et la participation citoyenne. 
                En utilisant ces informations, Bus Connect rend plus aisée l'accès aux données de transport. Les horaires, passages et disponibilités 
                des véhicules proviennent de sources publiques ou d'opérateurs partenaires, et sont réutilisés conformément aux conditions d'utilisation 
                des données ouvertes.
              </p>
              
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 mt-4">Temps Réel :</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Le temps réel repose sur la mise à jour continue des positions et horaires des bus. Les informations, fournies par les opérateurs 
                de transport et centralisées sur des plateformes Open Data, permettent à Bus Connect d'afficher des horaires actualisés. Toutefois, 
                retards, annulations ou perturbations peuvent survenir, indépendamment de la volonté de l'application.
              </p>
            </section>
            
            <section className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Absence de Garantie & Responsabilité</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Les informations fournies par Bus Connect sont présentées à titre indicatif et proviennent de sources tierces. L'application ne garantit 
                ni la disponibilité ni l'exactitude absolues des données. En cas de problème (par exemple, un bus manquant), aucune réclamation ne sera 
                prise en compte. L'utilisateur est invité à contacter directement l'opérateur de transport concerné pour toute demande ou réclamation. 
                Pour obtenir les coordonnées d'un opérateur, une demande peut être effectuée via le chat d'aide présent dans l'application.
              </p>
            </section>
            
            <div className="text-gray-500 dark:text-gray-400 text-sm text-center mt-12 pt-4 border-t border-gray-200 dark:border-gray-700">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalNotice; 