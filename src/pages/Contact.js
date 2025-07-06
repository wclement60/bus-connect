import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import { Link } from 'react-router-dom';

const objectOptions = [
  { value: 'information', label: 'Demande d\'information' },
  { value: 'bus_issue', label: 'Problème avec un réseau de bus (Horaires, Bus non passé, etc)' },
  { value: 'support', label: 'Support technique' },
  { value: 'feedback', label: 'Retour d\'expérience' },
  { value: 'suggestion', label: 'Suggestion d\'amélioration' },
  { value: 'partnership', label: 'Proposition de partenariat' },
  { value: 'other', label: 'Autre' }
];

const Contact = () => {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    network_id: '',
    object: '',
    message: ''
  });

  // Charger les réseaux de bus
  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const { data, error } = await supabase
          .from('agency')
          .select('network_id, agency_name')
          .order('agency_name', { ascending: true });
        
        if (error) throw error;

        // Éliminer les doublons potentiels basés sur network_id
        const uniqueNetworks = data.filter((v, i, a) => a.findIndex(t => (t.network_id === v.network_id)) === i);

        setNetworks(uniqueNetworks);
      } catch (error) {
        console.error("Erreur lors de la récupération des réseaux:", error);
        toast.error("Impossible de charger les réseaux de bus.");
      } finally {
        setLoadingNetworks(false);
      }
    };
    fetchNetworks();
  }, [toast]);

  // Mettre à jour le formulaire avec les informations de l'utilisateur connecté
  useEffect(() => {
    if (user && profile) {
      setFormData(prevData => ({
        ...prevData,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: user.email || ''
      }));
    }
  }, [user, profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.object || !formData.message) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Validation spécifique pour le réseau de bus si l'objet est "bus_issue"
    if (formData.object === 'bus_issue' && !formData.network_id) {
      toast.error('Veuillez sélectionner un réseau de bus');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Veuillez saisir une adresse email valide');
      return;
    }

    setIsSubmitting(true);

    try {
      // Préparer les données pour l'insertion
      const contactData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        network_id: formData.object === 'bus_issue' ? formData.network_id : null,
        object: formData.object,
        message: formData.message,
        user_id: user ? user.id : null,
      };

      const { error } = await supabase
        .from('contact_requests')
        .insert([contactData]);

      if (error) {
        throw error;
      }
      
      // Réinitialiser le formulaire après soumission réussie
      if (!user) {
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          network_id: '',
          object: '',
          message: ''
        });
      } else {
        setFormData(prevData => ({
          ...prevData,
          network_id: '',
          object: '',
          message: ''
        }));
      }

      toast.success('Votre message a été envoyé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      toast.error('Une erreur est survenue lors de l\'envoi du message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {!showContactForm ? (
        <div className="bg-white dark:bg-dark-800 shadow-md rounded-lg p-8 transition-colors duration-200">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Besoin d'aide ?
          </h1>
          
          <div className="mb-8 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Avez-vous pensé à consulter notre forum ?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Notre communauté est très active et pourrait déjà avoir la réponse à votre question. 
              Le forum est le meilleur endroit pour :
            </p>
            
            <ul className="text-left max-w-md mx-auto mb-8 space-y-3">
              <li className="flex items-start">
                <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Trouver des réponses rapides à vos questions
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Obtenir de l'aide de la communauté
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Signaler des problèmes avec les réseaux de bus
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                <span className="text-gray-600 dark:text-gray-300">
                  Partager vos suggestions et retours d'expérience
                </span>
              </li>
            </ul>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/forum"
                className="inline-flex items-center justify-center px-6 py-3 rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Aller sur le forum
              </Link>
              
              <button
                onClick={() => setShowContactForm(true)}
                className="inline-flex items-center justify-center px-6 py-3 rounded-md text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Non, continuer vers le formulaire
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-800 shadow-md rounded-lg p-6 transition-colors duration-200">
          <button
            onClick={() => setShowContactForm(false)}
            className="mb-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← Retour
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Nous contacter</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                value={formData.last_name}
                onChange={handleChange}
                disabled={!!user}
                required
                className={`block w-full rounded-md px-3 py-2 border ${
                  user ? 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400' : 'bg-white dark:bg-dark-900'
                } border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200`}
              />
            </div>
            
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prénom
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                value={formData.first_name}
                onChange={handleChange}
                disabled={!!user}
                required
                className={`block w-full rounded-md px-3 py-2 border ${
                  user ? 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400' : 'bg-white dark:bg-dark-900'
                } border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200`}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Adresse email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              disabled={!!user}
              required
              className={`block w-full rounded-md px-3 py-2 border ${
                user ? 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400' : 'bg-white dark:bg-dark-900'
              } border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200`}
            />
          </div>
          
          <div>
            <label htmlFor="object" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Objet
            </label>
            <select
              id="object"
              name="object"
              value={formData.object}
              onChange={handleChange}
              required
              className="block w-full rounded-md px-3 py-2 border bg-white dark:bg-dark-900 border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
            >
              <option value="">Sélectionnez un objet</option>
              {objectOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {formData.object === 'bus_issue' && (
            <div>
              <label htmlFor="network_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Réseau de bus concerné
              </label>
              <select
                id="network_id"
                name="network_id"
                value={formData.network_id}
                onChange={handleChange}
                required={formData.object === 'bus_issue'}
                className="block w-full rounded-md px-3 py-2 border bg-white dark:bg-dark-900 border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              >
                <option value="">Sélectionnez un réseau</option>
                {networks.map(network => (
                  <option key={network.network_id} value={network.network_id}>
                    {network.agency_name}
                  </option>
                ))}
              </select>
              {loadingNetworks && (
                <div className="mt-2">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2 text-sm text-gray-500">Chargement des réseaux...</span>
                </div>
              )}
            </div>
          )}
          
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={6}
              className="block w-full rounded-md px-3 py-2 border bg-white dark:bg-dark-900 border-gray-300 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors duration-200"
            ></textarea>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Envoi en cours...
                </>
              ) : (
                'Envoyer le message'
              )}
            </button>
          </div>
        </form>
      </div>
      )}
    </div>
  );
};

export default Contact; 