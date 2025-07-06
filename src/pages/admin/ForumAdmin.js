import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { 
  getForumCategories, 
  createForumCategory, 
  updateForumCategory, 
  deleteForumCategory,
  createForumSubcategory,
  updateForumSubcategory,
  deleteForumSubcategory,
  updateForumPost,
  deleteForumPost
} from '../../services/forumService';
import { banUser, unbanUser, getActiveBans } from '../../services/banService';
import { supabase } from '../../services/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Avatar from '../../components/Avatar';

const ForumAdmin = () => {
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('categories');
  
  // États pour les modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState('');
  const [userToBan, setUserToBan] = useState(null);
  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const searchRef = useRef(null);
  
  // États pour les formulaires
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    icon: 'chat',
    sort_order: 0,
    is_active: true,
    is_locked: false
  });
  
  const [subcategoryForm, setSubcategoryForm] = useState({
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
    is_locked: false,
    category_id: ''
  });

  const [banForm, setBanForm] = useState({
    duration: '1_day',
    custom_days: 1,
    reason: '',
    message: ''
  });

  const { profile } = useAuth();
  const { showToast } = useToast();
  
  const isAdmin = profile?.modtools === 1;

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, selectedTab]);

  // Fermer la dropdown de recherche quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (selectedTab === 'categories') {
        const categoriesData = await getForumCategories();
        setCategories(categoriesData);
      } else if (selectedTab === 'moderation') {
        await loadPostsForModeration();
      } else if (selectedTab === 'bans') {
        await loadBans();
      }
    } catch (error) {
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPostsForModeration = async () => {
    try {
      const { data, error } = await supabase
        .from('forum_posts')
        .select(`
          *,
          author:users!forum_posts_author_id_fkey(id, first_name, last_name, email, avatar_url, modtools),
          subcategory:forum_subcategories(name, category:forum_categories(name)),
          reply_count:forum_replies(count)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts(data);
    } catch (error) {
      console.error('Erreur lors du chargement des posts:', error);
      throw error;
    }
  };

  const loadBans = async () => {
    try {
      const data = await getActiveBans();
      setBans(data);
    } catch (error) {
      console.error('Erreur lors du chargement des bannissements:', error);
      throw error;
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await updateForumCategory(editingCategory.id, categoryForm);
        showToast('Catégorie modifiée avec succès', 'success');
      } else {
        await createForumCategory(categoryForm);
        showToast('Catégorie créée avec succès', 'success');
      }
      
      resetCategoryForm();
      loadData();
    } catch (error) {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleSubcategorySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSubcategory) {
        await updateForumSubcategory(editingSubcategory.id, subcategoryForm);
        showToast('Sous-catégorie modifiée avec succès', 'success');
      } else {
        await createForumSubcategory(subcategoryForm);
        showToast('Sous-catégorie créée avec succès', 'success');
      }
      
      resetSubcategoryForm();
      loadData();
    } catch (error) {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ? Toutes les sous-catégories et posts associés seront également supprimés.')) {
      return;
    }

    try {
      await deleteForumCategory(categoryId);
      showToast('Catégorie supprimée avec succès', 'success');
      loadData();
    } catch (error) {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const handleDeleteSubcategory = async (subcategoryId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette sous-catégorie ? Tous les posts associés seront également supprimés.')) {
      return;
    }

    try {
      await deleteForumSubcategory(subcategoryId);
      showToast('Sous-catégorie supprimée avec succès', 'success');
      loadData();
    } catch (error) {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const handleTogglePostPin = async (postId, isPinned) => {
    try {
      await updateForumPost(postId, { is_pinned: !isPinned });
      showToast(`Post ${!isPinned ? 'épinglé' : 'désépinglé'} avec succès`, 'success');
      loadData();
    } catch (error) {
      showToast('Erreur lors de la modification', 'error');
    }
  };

  const handleTogglePostLock = async (postId, isLocked) => {
    try {
      await updateForumPost(postId, { is_locked: !isLocked });
      showToast(`Post ${!isLocked ? 'verrouillé' : 'déverrouillé'} avec succès`, 'success');
      loadData();
    } catch (error) {
      showToast('Erreur lors de la modification', 'error');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce post ? Cette action est irréversible.')) {
      return;
    }

    try {
      await deleteForumPost(postId);
      showToast('Post supprimé avec succès', 'success');
      loadData();
    } catch (error) {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const handleBanUser = async (e) => {
    e.preventDefault();
    if (!userToBan) return;

    try {
      let expiresAt = null;
      
      // Calculer la date d'expiration selon la durée choisie
      if (banForm.duration !== 'permanent') {
        const now = new Date();
        switch (banForm.duration) {
          case '1_day':
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case '3_days':
            expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            break;
          case '1_week':
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case '1_month':
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
          case 'custom':
            expiresAt = new Date(now.getTime() + banForm.custom_days * 24 * 60 * 60 * 1000);
            break;
        }
      }

      await banUser(userToBan.id, {
        reason: banForm.reason,
        message: banForm.message,
        duration: banForm.duration,
        expires_at: expiresAt
      });

      showToast('Utilisateur banni avec succès', 'success');
      resetBanForm();
      loadData();
    } catch (error) {
      showToast('Erreur lors du bannissement', 'error');
    }
  };

  const handleUnbanUser = async (userId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir débannir cet utilisateur ?')) {
      return;
    }

    try {
      await unbanUser(userId);
      showToast('Utilisateur débanni avec succès', 'success');
      loadData();
    } catch (error) {
      showToast('Erreur lors du débannissement', 'error');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      icon: 'chat',
      sort_order: 0,
      is_active: true,
      is_locked: false
    });
    setEditingCategory(null);
    setShowCategoryModal(false);
  };

  const resetSubcategoryForm = () => {
    setSubcategoryForm({
      name: '',
      description: '',
      sort_order: 0,
      is_active: true,
      is_locked: false,
      category_id: ''
    });
    setEditingSubcategory(null);
    setShowSubcategoryModal(false);
    setSelectedCategoryForSub('');
  };

  const resetBanForm = () => {
    setBanForm({
      duration: '1_day',
      custom_days: 1,
      reason: '',
      message: ''
    });
    setUserToBan(null);
    setShowBanModal(false);
  };

  const openEditCategory = (category) => {
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || 'chat',
      sort_order: category.sort_order || 0,
      is_active: category.is_active,
      is_locked: category.is_locked || false
    });
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const openEditSubcategory = (subcategory) => {
    setSubcategoryForm({
      name: subcategory.name,
      description: subcategory.description || '',
      sort_order: subcategory.sort_order || 0,
      is_active: subcategory.is_active,
      is_locked: subcategory.is_locked || false,
      category_id: subcategory.category_id
    });
    setEditingSubcategory(subcategory);
    setShowSubcategoryModal(true);
  };

  const openBanModal = (user) => {
    setUserToBan(user);
    setShowBanModal(true);
  };

  const searchUsers = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, avatar_url, modtools')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error);
      setSearchResults([]);
    }
  };

  const handleSearchUser = (e) => {
    const value = e.target.value;
    setSearchUser(value);
    searchUsers(value);
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

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Accès refusé. Vous devez être administrateur pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Administration du Forum
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gérez les catégories, sous-catégories et modérez le contenu du forum
        </p>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedTab('categories')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'categories'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Catégories
          </button>
          <button
            onClick={() => setSelectedTab('moderation')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'moderation'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Modération
          </button>
          <button
            onClick={() => setSelectedTab('bans')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'bans'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Bannissements
          </button>
        </nav>
      </div>

      {/* Contenu selon l'onglet sélectionné */}
      {selectedTab === 'categories' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Gestion des catégories
            </h2>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nouvelle catégorie
            </button>
          </div>

          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="bg-white dark:bg-dark-800 rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {category.name}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        category.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {category.is_active ? 'Actif' : 'Inactif'}
                      </span>
                      {category.is_locked && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Verrouillé
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{category.description}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Ordre: {category.sort_order} | Icône: {category.icon}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditCategory(category)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      title="Modifier"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                      title="Supprimer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Sous-catégories */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
                      Sous-catégories ({category.subcategories?.length || 0})
                    </h4>
                    <button
                      onClick={() => {
                        setSelectedCategoryForSub(category.id);
                        setSubcategoryForm({ ...subcategoryForm, category_id: category.id });
                        setShowSubcategoryModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Ajouter
                    </button>
                  </div>
                  
                  {category.subcategories?.length > 0 ? (
                    <div className="space-y-2">
                      {category.subcategories.map((subcategory) => (
                        <div key={subcategory.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {subcategory.name}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                subcategory.is_active 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {subcategory.is_active ? 'Actif' : 'Inactif'}
                              </span>
                              {subcategory.is_locked && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                  <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                  Verrouillé
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {subcategory.description}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditSubcategory(subcategory)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                              title="Modifier"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSubcategory(subcategory.id)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                              title="Supprimer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Aucune sous-catégorie
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === 'moderation' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Modération des posts
          </h2>
          
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-dark-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Auteur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Catégorie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                {post.title}
                              </p>
                              {post.is_pinned && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  Épinglé
                                </span>
                              )}
                              {post.is_locked && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                  Verrouillé
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {post.reply_count?.[0]?.count || 0} réponse{(post.reply_count?.[0]?.count || 0) > 1 ? 's' : ''} | {post.view_count} vue{post.view_count > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <Avatar user={post.author} size="sm" />
                          <div>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {post.author?.first_name} {post.author?.last_name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {post.author?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {post.subcategory?.category?.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {post.subcategory?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(post.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleTogglePostPin(post.id, post.is_pinned)}
                            className={`${
                              post.is_pinned 
                                ? 'text-green-600 hover:text-green-700 dark:text-green-400' 
                                : 'text-gray-600 hover:text-gray-700 dark:text-gray-400'
                            }`}
                            title={post.is_pinned ? 'Désépingler' : 'Épingler'}
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleTogglePostLock(post.id, post.is_locked)}
                            className={`${
                              post.is_locked 
                                ? 'text-red-600 hover:text-red-700 dark:text-red-400' 
                                : 'text-gray-600 hover:text-gray-700 dark:text-gray-400'
                            }`}
                            title={post.is_locked ? 'Déverrouiller' : 'Verrouiller'}
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <a
                            href={`#/forum/post/${post.id}`}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            title="Voir le post"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </a>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                            title="Supprimer le post"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openBanModal(post.author)}
                            className="text-orange-600 hover:text-orange-700 dark:text-orange-400"
                            title="Bannir l'utilisateur"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Catégorie */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </h3>
            <form onSubmit={handleCategorySubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Icône
                  </label>
                  <select
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                  >
                    <option value="chat">Chat</option>
                    <option value="help">Aide</option>
                    <option value="lightbulb">Idée</option>
                    <option value="newspaper">Actualités</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ordre de tri
                  </label>
                  <input
                    type="number"
                    value={categoryForm.sort_order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="category_active"
                    checked={categoryForm.is_active}
                    onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="category_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Catégorie active
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="category_locked"
                    checked={categoryForm.is_locked}
                    onChange={(e) => setCategoryForm({ ...categoryForm, is_locked: e.target.checked })}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="category_locked" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Verrouiller la catégorie (empêche la création de nouveaux posts)
                  </label>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCategory ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sous-catégorie */}
      {showSubcategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingSubcategory ? 'Modifier la sous-catégorie' : 'Nouvelle sous-catégorie'}
            </h3>
            <form onSubmit={handleSubcategorySubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Catégorie parente
                  </label>
                  <select
                    value={subcategoryForm.category_id}
                    onChange={(e) => setSubcategoryForm({ ...subcategoryForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    required
                    disabled={!!selectedCategoryForSub}
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={subcategoryForm.name}
                    onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={subcategoryForm.description}
                    onChange={(e) => setSubcategoryForm({ ...subcategoryForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ordre de tri
                  </label>
                  <input
                    type="number"
                    value={subcategoryForm.sort_order}
                    onChange={(e) => setSubcategoryForm({ ...subcategoryForm, sort_order: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="subcategory_active"
                    checked={subcategoryForm.is_active}
                    onChange={(e) => setSubcategoryForm({ ...subcategoryForm, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="subcategory_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Sous-catégorie active
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="subcategory_locked"
                    checked={subcategoryForm.is_locked}
                    onChange={(e) => setSubcategoryForm({ ...subcategoryForm, is_locked: e.target.checked })}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="subcategory_locked" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Verrouiller la sous-catégorie (empêche la création de nouveaux posts)
                  </label>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetSubcategoryForm}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingSubcategory ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section Bannissements */}
      {selectedTab === 'bans' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Gestion des bannissements
            </h2>
            
            {/* Recherche d'utilisateurs */}
            <div className="relative" ref={searchRef}>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchUser}
                    onChange={handleSearchUser}
                    placeholder="Rechercher un utilisateur..."
                    className="w-80 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              {/* Résultats de recherche */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div 
                      key={user.id}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      onClick={() => {
                        openBanModal(user);
                        setSearchUser('');
                        setSearchResults([]);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar user={user} size="sm" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {user.first_name} {user.last_name}
                            </span>
                            {user.modtools === 1 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          Cliquer pour bannir
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow overflow-hidden">
            {bans.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-dark-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Utilisateur
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Raison
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Banni par
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Expire
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {bans.map((ban) => (
                      <tr key={ban.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <Avatar user={ban.user} size="sm" />
                            <div>
                              <div className="text-sm text-gray-900 dark:text-white">
                                {ban.user?.first_name} {ban.user?.last_name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {ban.user?.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {ban.reason}
                          </div>
                          {ban.message && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Message: {ban.message}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ban.banned_by_user?.first_name} {ban.banned_by_user?.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(ban.banned_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {ban.expires_at ? (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(ban.expires_at)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Permanent
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleUnbanUser(ban.user_id)}
                            className="text-green-600 hover:text-green-700 dark:text-green-400"
                            title="Débannir"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aucun bannissement actif</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Tous les utilisateurs peuvent accéder au forum.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Bannissement */}
      {showBanModal && userToBan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Bannir l'utilisateur
            </h3>
            <div className="mb-4">
              <div className="flex items-center space-x-3">
                <Avatar user={userToBan} size="md" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {userToBan.first_name} {userToBan.last_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {userToBan.email}
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleBanUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Durée du bannissement
                  </label>
                  <select
                    value={banForm.duration}
                    onChange={(e) => setBanForm({ ...banForm, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-dark-700 dark:text-white"
                    required
                  >
                    <option value="1_day">1 jour</option>
                    <option value="3_days">3 jours</option>
                    <option value="1_week">1 semaine</option>
                    <option value="1_month">1 mois</option>
                    <option value="custom">Personnalisé</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>
                
                {banForm.duration === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre de jours
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={banForm.custom_days}
                      onChange={(e) => setBanForm({ ...banForm, custom_days: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-dark-700 dark:text-white"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Raison du bannissement *
                  </label>
                  <textarea
                    value={banForm.reason}
                    onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-dark-700 dark:text-white"
                    rows="3"
                    placeholder="Ex: Comportement inapproprié, spam, insultes..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Message à afficher à l'utilisateur (optionnel)
                  </label>
                  <textarea
                    value={banForm.message}
                    onChange={(e) => setBanForm({ ...banForm, message: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-dark-700 dark:text-white"
                    rows="2"
                    placeholder="Ce message sera affiché à l'utilisateur banni..."
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetBanForm}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Bannir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumAdmin; 