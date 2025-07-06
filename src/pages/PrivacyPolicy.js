import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-dark-800 shadow-lg rounded-lg overflow-hidden transition-colors duration-200">
          <div className="p-6 sm:p-10">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Politique de Confidentialité
            </h1>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Introduction</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                La présente Politique de Confidentialité décrit les pratiques de Bus Connect en matière de collecte, 
                d'utilisation, de conservation et de protection des informations relatives aux utilisateurs. 
                Notre objectif est de garantir la transparence, le respect de la vie privée et la confidentialité 
                des données personnelles.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Données Collectées</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Bus Connect ne collecte aucune donnée personnelle d'identification directe. Nous utilisons uniquement 
                des cookies afin de mémoriser les réseaux de bus sélectionnés et les favoris par ligne. Par ailleurs, 
                des outils externes comme Google Analytics ou des sondages sous forme de formulaires peuvent être intégrés. 
                Ces mécanismes ne stockent que des informations techniques ou anonymisées.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Objectifs de l'Utilisation</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Les données collectées servent principalement à des fins d'analyse et de sondage. Ceci nous aide à améliorer 
                la qualité de notre application, à mieux comprendre l'expérience utilisateur et à proposer des fonctionnalités adaptées.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Durée de Conservation & Méthodes Anonymes</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Les informations recueillies sont automatiquement supprimées au bout de 31 jours. Une méthode d'anonymisation 
                est également mise en place afin de conserver uniquement des données agrégées ne permettant pas de retracer 
                l'identité d'un individu. Ainsi, passé ce délai, seules des statistiques globales, inexploitables individuellement, demeurent.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Partage des Données</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Bus Connect ne divulgue ni ne vend, de quelque manière que ce soit, les données collectées à des tiers. 
                Aucune transmission externe n'est effectuée, garantissant une confidentialité maximale.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Mesures de Sécurité</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Des mesures de sécurité techniques et organisationnelles sont mises en place, telles que le chiffrement 
                des connexions et la restriction des accès aux seules personnes autorisées. Cette approche contribue à 
                prévenir tout accès non autorisé, perte, altération ou divulgation inappropriée.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Droits des Utilisateurs</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Chaque utilisateur peut demander la suppression de ses données ou exercer ses droits d'accès, de rectification 
                et d'opposition en adressant une requête par courrier électronique. Nous nous engageons à répondre dans des 
                délais raisonnables et à honorer ces demandes dans la mesure où elles sont légitimes et conformes aux lois applicables.
              </p>
            </section>
            
            <section className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Contact</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Pour toute question, demande de renseignements ou suppression de données, veuillez contacter Bus Connect 
                à l'adresse suivante : <a href="mailto:contact@busconnect.fr" className="text-blue-600 dark:text-blue-400 hover:underline">contact@busconnect.fr</a>.
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

export default PrivacyPolicy; 