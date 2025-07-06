import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getAppealMessages,
  sendAppealMessage,
  markMessagesAsRead
} from '../services/priorityAlertService';
import Avatar from './Avatar';
import { 
  FaTimes, 
  FaPaperPlane, 
  FaCommentDots,
  FaUserShield
} from 'react-icons/fa';

const AppealChatModal = ({ appeal, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const messagesEndRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const userIsAdmin = profile?.modtools === 1;

  useEffect(() => {
    if (isOpen && appeal) {
      loadMessages();
      markAsRead();
      
      // Polling intelligent et subtil pour les nouveaux messages
      const interval = setInterval(async () => {
        try {
          // Charger les messages discrètement
          const data = await getAppealMessages(appeal.id);
          if (data && data.length > 0) {
            // Mise à jour seulement si il y a un changement
            const currentCount = data.length;
            if (currentCount !== lastMessageCountRef.current) {
              const hadNewMessages = currentCount > lastMessageCountRef.current;
              setMessages(data);
              lastMessageCountRef.current = currentCount;
              // Scroll automatique seulement si nouveaux messages
              if (hadNewMessages) {
                setTimeout(scrollToBottom, 100);
              }
            }
          }
        } catch (error) {
          // Erreur silencieuse
          console.error('Erreur polling messages:', error);
        }
      }, 1500); // 1.5 secondes pour plus de fluidité

      return () => clearInterval(interval);
    }
  }, [isOpen, appeal?.id]); // Dépendance simplifiée

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async (showLoading = true) => {
    if (!appeal) return;
    
    try {
      if (showLoading) setLoading(true);
      const data = await getAppealMessages(appeal.id);
      setMessages(data);
      lastMessageCountRef.current = data?.length || 0;
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!appeal) return;
    
    try {
      await markMessagesAsRead(appeal.id, userIsAdmin);
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !appeal) return;

    try {
      setSendingMessage(true);
      await sendAppealMessage(appeal.id, newMessage.trim());
      setNewMessage('');
      await loadMessages(false); // Pas de loading visible
      scrollToBottom();
    } catch (error) {
      showToast('Erreur lors de l\'envoi du message', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'under_review': return 'En cours de révision';
      case 'approved': return 'Approuvé';
      case 'rejected': return 'Rejeté';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'under_review': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'approved': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'rejected': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  if (!isOpen || !appeal) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-dark-800 z-50">
      <div className="bg-white dark:bg-dark-800 w-full h-full flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 sm:p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
            <FaCommentDots className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm sm:text-base truncate">Discussion - Appel</h3>
              <p className="text-xs sm:text-sm opacity-90 truncate">
                {appeal.alert?.title}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <span className={`px-2 py-1 sm:px-3 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(appeal.status)}`}>
              {getStatusText(appeal.status)}
            </span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-full transition-colors"
            >
              <FaTimes className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4 transition-all duration-300">
          {/* Message initial de l'appel */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 sm:p-4">
            <div className="flex items-start space-x-2 sm:space-x-3">
              <Avatar 
                user={(() => {
                  // Si c'est l'utilisateur connecté qui a créé l'appel, utiliser ses données du profil
                  if (appeal.user_id === user?.id) {
                    return {
                      id: user?.id,
                      first_name: profile?.first_name || user?.user_metadata?.first_name || 'Utilisateur',
                      last_name: profile?.last_name || user?.user_metadata?.last_name || '',
                      avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url
                    };
                  }
                  // Sinon utiliser les données de appeal.user
                  return {
                    ...appeal.user,
                    first_name: appeal.user?.first_name || 'Utilisateur',
                    last_name: appeal.user?.last_name || ''
                  };
                })()} 
                size="sm" 
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {(() => {
                      // Si c'est l'utilisateur connecté qui a créé l'appel, utiliser ses données du profil
                      if (appeal.user_id === user?.id) {
                        const firstName = profile?.first_name || user?.user_metadata?.first_name || 'Utilisateur';
                        const lastName = profile?.last_name || user?.user_metadata?.last_name || '';
                        return `${firstName} ${lastName}`.trim();
                      }
                      // Sinon utiliser les données de appeal.user
                      return `${appeal.user?.first_name || 'Utilisateur'} ${appeal.user?.last_name || ''}`.trim();
                    })()}
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Appel initial
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Raison de l'appel:</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">{appeal.reason}</p>
                  </div>
                  {appeal.additional_info && (
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Informations supplémentaires:</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">{appeal.additional_info}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Messages du tchat */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            messages.map((message) => {
              const isMyMessage = message.sender_id === user?.id;
              const isAdminMessage = message.is_admin;
              
              // Utiliser les données du profil si c'est mon message, sinon utiliser les données du sender
              const displayUser = isMyMessage ? {
                id: user?.id,
                first_name: profile?.first_name || user?.user_metadata?.first_name || 'Utilisateur',
                last_name: profile?.last_name || user?.user_metadata?.last_name || '',
                avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url
              } : {
                ...message.sender,
                first_name: message.sender?.first_name || 'Utilisateur',
                last_name: message.sender?.last_name || ''
              };
              
              const displayName = `${displayUser.first_name} ${displayUser.last_name}`.trim();
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} transition-all duration-300 ease-in-out`}
                >
                  <div className={`flex items-start space-x-2 max-w-[85%] sm:max-w-[70%] ${
                    isMyMessage ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                  <Avatar 
                    user={displayUser} 
                    size="sm" 
                  />
                  <div className={`rounded-lg px-3 py-2 sm:px-4 ${
                    isMyMessage 
                      ? 'bg-blue-600 text-white' 
                      : isAdminMessage
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white'
                  }`}>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`text-xs font-medium ${
                        isMyMessage 
                          ? 'text-blue-100' 
                          : isAdminMessage
                          ? 'text-purple-600 dark:text-purple-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {displayName || 'Utilisateur'}
                      </span>
                      {isAdminMessage && (
                        <FaUserShield className={`w-3 h-3 ${
                          isMyMessage ? 'text-blue-200' : 'text-purple-500 dark:text-purple-400'
                        }`} />
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    <p className={`text-xs mt-1 ${
                      isMyMessage 
                        ? 'text-blue-100' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Zone de saisie */}
        {appeal.status === 'pending' || appeal.status === 'under_review' ? (
          <form onSubmit={handleSendMessage} className="bg-white dark:bg-dark-800 border-t-2 border-gray-300 dark:border-gray-600 shadow-lg flex-shrink-0 pb-20 sm:pb-6">
            <div className="p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <Avatar 
                  user={{
                    id: user?.id,
                    first_name: profile?.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Utilisateur',
                    last_name: profile?.last_name || user?.user_metadata?.last_name || '',
                    avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url
                  }} 
                  size="sm" 
                />
                <div className="flex-1 flex items-center space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tapez votre message..."
                    className="flex-1 px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-700 dark:text-white shadow-sm"
                    disabled={sendingMessage}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-md"
                  >
                    <FaPaperPlane className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="bg-gray-100 dark:bg-dark-700 border-t-2 border-gray-300 dark:border-gray-600 flex-shrink-0 pb-20 sm:pb-6">
            <div className="p-4 sm:p-6">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Cette conversation est fermée. L'appel a été {appeal.status === 'approved' ? 'approuvé' : 'rejeté'}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppealChatModal; 