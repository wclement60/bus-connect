import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../LoadingSpinner';

const ContactAdmin = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [networks, setNetworks] = useState([]);
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [replyStatus, setReplyStatus] = useState('resolved'); // Par défaut, marquer comme "résolu"

  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const { data, error } = await supabase
          .from('agency')
          .select('network_id, agency_name')
          .order('agency_name', { ascending: true });

        if (error) throw error;
        
        const uniqueNetworks = data.filter((v, i, a) => a.findIndex(t => (t.network_id === v.network_id)) === i);
        setNetworks(uniqueNetworks || []);
      } catch (error) {
        console.error("Erreur lors du chargement des réseaux:", error);
      }
    };
    fetchNetworks();
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('contact_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedNetworkFilter !== 'all') {
        query = query.eq('network_id', selectedNetworkFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des messages:", error);
      toast.error("Une erreur est survenue lors du chargement des messages.");
    } finally {
      setLoading(false);
    }
  }, [selectedNetworkFilter, toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const channel = supabase
      .channel('contact-admin-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests' },
        (payload) => {
          console.log('Changement détecté, mise à jour des messages...', payload);
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  const handleSelectMessage = (message) => {
    setSelectedMessage(message);
    
    // Déterminer le statut et le texte de la réponse en fonction du contenu de la réponse
    if (!message.response) {
      setReplyStatus('pending');
      setReplyText('');
    } else if (message.response.startsWith('En cours de traitement:')) {
      setReplyStatus('processing');
      setReplyText(message.response.substring('En cours de traitement:'.length).trim());
    } else {
      setReplyStatus('resolved');
      setReplyText(message.response);
    }
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    
    if (!selectedMessage) {
      return;
    }
    
    // Validation différente selon le statut
    if (replyStatus !== 'pending' && !replyText.trim()) {
      toast.error("Une réponse est requise pour ce statut.");
      return;
    }
    
    setSubmitting(true);
    try {
      let finalResponse = null;

      // Si on remet en attente, on efface la réponse
      if (replyStatus === 'pending') {
        finalResponse = null;
      } 
      // Pour le statut "En traitement", on ajoute le préfixe
      else if (replyStatus === 'processing') {
        finalResponse = 'En cours de traitement: ' + replyText.trim();
      } 
      // Pour le statut "Résolu", on s'assure que le préfixe est retiré
      else if (replyStatus === 'resolved') {
        finalResponse = replyText.trim(); // Réponse normale sans préfixe
      }

      const updates = {
        response: finalResponse,
        responded_at: replyStatus !== 'pending' ? new Date().toISOString() : null,
        responded_by: replyStatus !== 'pending' ? user.id : null,
      };
      
      const { error } = await supabase
        .from('contact_requests')
        .update(updates)
        .eq('id', selectedMessage.id);
        
      if (error) throw error;
      
      toast.success('Statut et réponse mis à jour avec succès');
      const updatedMessage = { ...selectedMessage, ...updates };
      setSelectedMessage(updatedMessage);
      setMessages(messages.map(msg => msg.id === selectedMessage.id ? updatedMessage : msg));
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusInfo = (message) => {
    if (!message.response) {
      return {
        text: 'En attente',
        className: 'px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
      };
    } else if (message.response.startsWith('En cours de traitement:')) {
      return {
        text: 'En traitement',
        className: 'px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
      };
    } else {
      return {
        text: 'Résolu',
        className: 'px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
      };
    }
  };

  const getObjectText = (objectType) => {
    const objectTypes = {
      'information': 'Demande d\'information',
      'bus_issue': 'Problème avec un réseau de bus (Horaires, Bus non passé, etc)',
      'support': 'Support technique',
      'feedback': 'Retour d\'expérience',
      'suggestion': 'Suggestion d\'amélioration',
      'partnership': 'Proposition de partenariat',
      'other': 'Autre'
    };
    return objectTypes[objectType] || objectType;
  };
  
  // Filtrer les messages par statut et recherche
  const filteredMessages = messages.filter(msg => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      msg.first_name.toLowerCase().includes(searchLower) ||
      msg.last_name.toLowerCase().includes(searchLower) ||
      msg.email.toLowerCase().includes(searchLower) ||
      msg.message.toLowerCase().includes(searchLower) ||
      getObjectText(msg.object).toLowerCase().includes(searchLower) ||
      (msg.network_id && msg.network_id.toLowerCase().includes(searchLower));
    
    // Filtrer par statut
    if (selectedStatusFilter === 'all') {
      return matchesSearch;
    } else if (selectedStatusFilter === 'pending') {
      return !msg.response && matchesSearch;
    } else if (selectedStatusFilter === 'processing') {
      return msg.response && msg.response.startsWith('En cours de traitement:') && matchesSearch;
    } else if (selectedStatusFilter === 'resolved') {
      return msg.response && !msg.response.startsWith('En cours de traitement:') && matchesSearch;
    }
    
    return matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-1 bg-white dark:bg-dark-800 rounded-lg shadow-sm flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Messages de contact</h2>
          <div className="mt-3 flex flex-col space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (nom, email, message...)"
              className="w-full px-3 py-2 border rounded-md dark:bg-dark-900 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-dark-900 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="processing">En traitement</option>
              <option value="resolved">Résolu</option>
            </select>
            
            <select
              value={selectedNetworkFilter}
              onChange={(e) => setSelectedNetworkFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-dark-900 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les réseaux</option>
              {networks.map(network => (
                <option key={network.network_id} value={network.agency_name}>
                  {network.agency_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          {loading ? (
            <div className="flex justify-center items-center p-8"><LoadingSpinner /></div>
          ) : filteredMessages.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">Aucun message trouvé</div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-dark-700">
              {filteredMessages.map((message) => {
                const status = getStatusInfo(message);
                return (
                  <li 
                    key={message.id}
                    onClick={() => handleSelectMessage(message)}
                    className={`p-4 cursor-pointer transition-colors ${selectedMessage?.id === message.id ? 'bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500' : 'hover:bg-gray-50 dark:hover:bg-dark-700'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{message.first_name} {message.last_name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{getObjectText(message.object)}</p>
                      </div>
                      <span className={status.className}>{status.text}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {new Date(message.created_at).toLocaleString('fr-FR')}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      
      <div className="lg:col-span-2 bg-white dark:bg-dark-800 rounded-lg shadow-sm flex flex-col h-full">
        {selectedMessage ? (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Détail du message</h2>
                <span className={getStatusInfo(selectedMessage).className}>
                  {getStatusInfo(selectedMessage).text}
                </span>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto flex-grow">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
                <div><p className="text-gray-500 dark:text-gray-400">Nom</p><p className="font-medium dark:text-white">{selectedMessage.first_name} {selectedMessage.last_name}</p></div>
                <div><p className="text-gray-500 dark:text-gray-400">Email</p><p className="font-medium dark:text-white">{selectedMessage.email}</p></div>
                <div><p className="text-gray-500 dark:text-gray-400">Date</p><p className="font-medium dark:text-white">{new Date(selectedMessage.created_at).toLocaleString('fr-FR')}</p></div>
                <div><p className="text-gray-500 dark:text-gray-400">Réseau</p><p className="font-medium dark:text-white">{selectedMessage.network_id || 'Non spécifié'}</p></div>
                <div className="sm:col-span-2"><p className="text-gray-500 dark:text-gray-400">Objet</p><p className="font-medium dark:text-white">{getObjectText(selectedMessage.object)}</p></div>
              </div>
              
              <div className="mb-4"><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Message</p><div className="bg-gray-50 dark:bg-dark-900 rounded-lg p-3 border border-gray-200 dark:border-dark-700 text-sm whitespace-pre-wrap dark:text-gray-300">{selectedMessage.message}</div></div>
              
              {selectedMessage.response && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Réponse actuelle</p>
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-800 text-sm whitespace-pre-wrap dark:text-gray-300">
                    {selectedMessage.response.startsWith('En cours de traitement:') 
                      ? selectedMessage.response.substring('En cours de traitement:'.length) 
                      : selectedMessage.response}
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSubmitReply}>
                <div className="mb-4">
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Statut
                  </label>
                  <select
                    id="status"
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-dark-900 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">En attente</option>
                    <option value="processing">En traitement</option>
                    <option value="resolved">Résolu</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {replyStatus === 'pending' ? 'Remettre en attente effacera toute réponse précédente.' : 
                     replyStatus === 'processing' ? 'Marquer comme "En traitement" requiert au moins une note préliminaire.' : 
                     'Marquer comme "Résolu" nécessite une réponse complète.'}
                  </p>
                </div>
                
                <label htmlFor="reply" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Réponse {replyStatus !== 'pending' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  id="reply"
                  rows="6"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md dark:bg-dark-900 dark:border-dark-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={replyStatus === 'pending' ? 'Pas de réponse nécessaire pour un message en attente' : 
                               replyStatus === 'processing' ? 'Saisissez une note préliminaire...' : 
                               'Saisissez votre réponse finale ici...'}
                  disabled={replyStatus === 'pending'}
                ></textarea>
                
                <div className="flex justify-end mt-4">
                  <button 
                    type="submit" 
                    disabled={submitting || (replyStatus !== 'pending' && !replyText.trim())} 
                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {submitting && <LoadingSpinner size="sm" className="mr-2" />}
                    {submitting ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
            
            {selectedMessage.responded_at && (
              <div className="p-4 border-t border-gray-200 dark:border-dark-700 text-xs text-gray-500 dark:text-gray-400">
                Dernière mise à jour par {selectedMessage.responded_by.slice(0, 8)}... le {new Date(selectedMessage.responded_at).toLocaleString('fr-FR')}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <svg className="h-12 w-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <h3 className="text-gray-900 dark:text-white font-medium mt-2">Aucun message sélectionné</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Sélectionnez un message dans la liste pour voir les détails et répondre.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactAdmin;
