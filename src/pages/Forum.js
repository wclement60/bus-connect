import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getForumCategories, createForumCategory, createForumSubcategory } from '../services/forumService';
import LoadingSpinner from '../components/LoadingSpinner';
import Avatar from '../components/Avatar';
import BanNotice from '../components/BanNotice';
import { useBanStatus } from '../hooks/useBanStatus';
import ForumSkeleton from '../components/ForumSkeleton';
import TextMarquee from '../components/TextMarquee';

const Forum = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateSubcategory, setShowCreateSubcategory] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', icon: 'chat' });
  const [newSubcategory, setNewSubcategory] = useState({ name: '', description: '' });
  
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isBanned, banDetails, loading: banLoading } = useBanStatus();
  
  const isAdmin = profile?.modtools === 1;

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getForumCategories();
      setCategories(data);
    } catch (error) {
      showToast('Erreur lors du chargement des catégories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      await createForumCategory(newCategory);
      setNewCategory({ name: '', description: '', icon: 'chat' });
      setShowCreateCategory(false);
      loadCategories();
      showToast('Catégorie créée avec succès', 'success');
    } catch (error) {
      showToast('Erreur lors de la création de la catégorie', 'error');
    }
  };

  const handleCreateSubcategory = async (e) => {
    e.preventDefault();
    if (!isAdmin || !selectedCategoryId) return;

    try {
      await createForumSubcategory({
        ...newSubcategory,
        category_id: selectedCategoryId
      });
      setNewSubcategory({ name: '', description: '' });
      setShowCreateSubcategory(false);
      setSelectedCategoryId(null);
      loadCategories();
      showToast('Sous-catégorie créée avec succès', 'success');
    } catch (error) {
      showToast('Erreur lors de la création de la sous-catégorie', 'error');
    }
  };

  const getIconComponent = (iconName) => {
    const iconMap = {
      'chat': (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      'help': (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      'lightbulb': (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      'newspaper': (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      )
    };
    return iconMap[iconName] || iconMap['chat'];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || banLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 mb-6 animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mt-3"></div>
          </div>
          <ForumSkeleton />
        </div>
      </div>
    );
  }

  // Si l'utilisateur est banni, afficher seulement le message de bannissement
  if (user && isBanned) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
        <BanNotice banDetails={banDetails} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        {/* En-tête */}
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <img 
                src="/images/bcforum.png" 
                alt="Forum Bus Connect"
                className="h-24 md:h-16 w-auto"
              />
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm md:text-base">
                Échangez avec la communauté sur les transports en commun
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowCreateCategory(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">Nouvelle catégorie</span>
              </button>
            )}
          </div>
        </div>

        {/* Connexion requise pour participer */}
        {!user && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-yellow-800 dark:text-yellow-200">
                <Link to="/login" className="font-medium underline hover:no-underline">
                  Connectez-vous
                </Link>{' '}
                pour participer aux discussions du forum.
              </p>
            </div>
          </div>
        )}

        {/* Liste des catégories */}
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category.id} id={`category-${category.id}`} className="bg-white dark:bg-dark-800 rounded-lg shadow-lg overflow-hidden">
              {/* En-tête de catégorie */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-blue-100">
                      {getIconComponent(category.icon)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{category.name}</h2>
                      <p className="text-blue-100 text-sm">{category.description}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setShowCreateSubcategory(true);
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Sous-catégorie
                    </button>
                  )}
                </div>
              </div>

              {/* Sous-catégories */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {category.subcategories?.map((subcategory) => (
                  <Link
                    key={subcategory.id}
                    to={`/forum/category/${subcategory.id}`}
                    className="group block hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors duration-200"
                  >
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between space-x-2 sm:space-x-4">
                        {/* Partie gauche : Titre et description (flexible) */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                              {subcategory.name}
                            </h3>
                            {subcategory.is_locked && (
                              <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" title="Catégorie verrouillée">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 truncate">
                            {subcategory.description}
                          </p>

                          {subcategory.latest_post?.[0] && (
                            <div className="mt-2 text-left">
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Dernier sujet</div>
                              <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                                <TextMarquee text={subcategory.latest_post[0].title} />
                              </div>
                              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span>par</span>
                                <Avatar user={subcategory.latest_post[0].author} size="xs" showName={true} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Partie droite : Stats et dernier post */}
                        <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
                          <div className="text-center w-14">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {subcategory.post_count?.[0]?.count || 0}
                            </div>
                            <div className="text-xs sm:text-sm">
                              Sujet{(subcategory.post_count?.[0]?.count || 0) > 1 ? 's' : ''}
                            </div>
                          </div>
                          
                          <div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal création catégorie */}
        {showCreateCategory && isAdmin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Nouvelle catégorie
              </h3>
              <form onSubmit={handleCreateCategory}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    rows="3"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Icône
                  </label>
                  <select
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                  >
                    <option value="chat">Chat</option>
                    <option value="help">Aide</option>
                    <option value="lightbulb">Idée</option>
                    <option value="newspaper">Actualités</option>
                  </select>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateCategory(false)}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal création sous-catégorie */}
        {showCreateSubcategory && isAdmin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Nouvelle sous-catégorie
              </h3>
              <form onSubmit={handleCreateSubcategory}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={newSubcategory.name}
                    onChange={(e) => setNewSubcategory({ ...newSubcategory, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newSubcategory.description}
                    onChange={(e) => setNewSubcategory({ ...newSubcategory, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    rows="3"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateSubcategory(false);
                      setSelectedCategoryId(null);
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Forum; 