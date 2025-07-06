import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getForumPosts, getForumSubcategories, createForumPost, getPostsViewStatus } from '../services/forumService';
import { supabase } from '../services/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import Avatar from '../components/Avatar';
import BanNotice from '../components/BanNotice';
import RichTextEditor from '../components/RichTextEditor';
import { useBanStatus } from '../hooks/useBanStatus';

const ForumCategory = () => {
  const { categoryId } = useParams();
  const [posts, setPosts] = useState([]);
  const [subcategory, setSubcategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [postBanDetails, setPostBanDetails] = useState(null);
  const [viewStatus, setViewStatus] = useState({});
  
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isBanned, banDetails, loading: banLoading } = useBanStatus();
  
  const isAdmin = profile?.modtools === 1;
  const POSTS_PER_PAGE = 20;

  useEffect(() => {
    loadSubcategoryData();
    loadPosts();
  }, [categoryId, currentPage]);

  const loadSubcategoryData = async () => {
    try {
      // Pour récupérer les infos de la sous-catégorie, on fait une requête directe
      const { data, error } = await supabase
        .from('forum_subcategories')
        .select(`
          *,
          category:forum_categories(name, icon)
        `)
        .eq('id', categoryId)
        .single();

      if (error) throw error;
      setSubcategory(data);
    } catch (error) {
      console.error('Erreur:', error);
      showToast('Erreur lors du chargement des informations', 'error');
    }
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      const result = await getForumPosts(categoryId, currentPage, POSTS_PER_PAGE);
      setPosts(result.posts);
      setTotalPages(Math.ceil(result.totalCount / POSTS_PER_PAGE));
      
      // Après avoir récupéré les posts, obtenir leur statut de lecture
      if (user && result.posts.length > 0) {
        const postIds = result.posts.map(p => p.id);
        const statusMap = await getPostsViewStatus(postIds);
        setViewStatus(statusMap);
      }
    } catch (error) {
      showToast('Erreur lors du chargement des posts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await createForumPost({
        ...newPost,
        subcategory_id: categoryId
      });
      setNewPost({ title: '', content: '' });
      setShowCreatePost(false);
      loadPosts();
      showToast('Sujet créé avec succès', 'success');
    } catch (error) {
      if (error.banDetails) {
        setPostBanDetails(error.banDetails);
        setShowCreatePost(false);
      } else {
        showToast('Erreur lors de la création du sujet', 'error');
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    
    if (date >= startOfToday) {
      return `Aujourd'hui à ${time}`;
    }
    
    if (date >= startOfYesterday) {
      return `Hier à ${time}`;
    }
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) return `il y a ${diffMinutes}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    
    return formatDate(dateString);
  };

  const isUnread = (post) => {
    if (!user) return false; // Les invités voient tout comme "lu"

    const lastActivityDate = new Date(post.last_reply_at || post.created_at);
    const lastReadDate = viewStatus[post.id] ? new Date(viewStatus[post.id]) : null;

    if (!lastReadDate) {
      // Jamais lu, donc non lu
      return true;
    }
    
    // Non lu si la dernière activité est plus récente que la dernière lecture
    return lastActivityDate > lastReadDate;
  };

  if (loading || banLoading) {
    const PostCardSkeleton = () => (
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
            <div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16 mt-2"></div>
            </div>
          </div>
          <div className="text-right">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-12 mt-2"></div>
          </div>
        </div>
        <div className="mb-4">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
          </div>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6 mb-6 animate-pulse">
            <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mt-3"></div>
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => <PostCardSkeleton key={i} />)}
          </div>
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

  if (!subcategory) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">Sous-catégorie non trouvée.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link to="/forum" className="hover:text-blue-600 dark:hover:text-blue-400">
            Forum
          </Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 dark:text-white">{subcategory.category?.name}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 dark:text-white">{subcategory.name}</span>
        </nav>

        {/* En-tête */}
        <div className="simple-gradient-border mb-6">
          <div className="p-6">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {subcategory.name}
              </h1>
              {subcategory.is_locked && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Verrouillé
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {subcategory.description}
            </p>
            <div className="flex items-center space-x-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{posts.length} sujet{posts.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          {user && (!subcategory.is_locked || isAdmin) && (
            <div className="bg-gray-50 dark:bg-dark-900/50 p-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowCreatePost(true)}
                className="w-full justify-center bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Nouveau sujet</span>
              </button>
            </div>
          )}
        </div>

        {/* Message si pas connecté */}
        {!user && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-blue-800 dark:text-blue-200">
                <Link to="/login" className="font-medium underline hover:no-underline">
                  Connectez-vous
                </Link>{' '}
                pour créer un nouveau sujet ou répondre aux discussions.
              </p>
            </div>
          </div>
        )}

        {/* Message si catégorie verrouillée */}
        {user && subcategory.is_locked && !isAdmin && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-orange-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <p className="text-orange-800 dark:text-orange-200">
                Cette catégorie est verrouillée. La création de nouveaux sujets n'est pas autorisée pour le moment.
              </p>
            </div>
          </div>
        )}

        {/* Liste des posts */}
        {posts.length === 0 ? (
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Aucun sujet pour le moment
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Cette catégorie n'a pas encore de discussions. Soyez le premier à démarrer une conversation !
            </p>
            {user && (!subcategory.is_locked || isAdmin) && (
              <button
                onClick={() => setShowCreatePost(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 mx-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Créer le premier sujet</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/forum/post/${post.id}`}
                className="block group"
              >
                <div className="bg-white dark:bg-dark-800 rounded-xl shadow-md hover:shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:border-blue-200 dark:hover:border-blue-600">
                  <div className="p-6">
                    {/* En-tête : Avatar + Nom + Badges à gauche */}
                    <div className="flex items-center justify-between mb-4">
                      {/* Gauche : Avatar + Nom + Badges */}
                      <div className="flex items-center space-x-3">
                        <Avatar user={post.author} size="md" />
                        <div className="flex items-center space-x-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {post.author?.first_name} {post.author?.last_name}
                              </span>
                              {post.author?.modtools === 1 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 shadow-sm">
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Auteur
                            </div>
                          </div>
                          
                          {/* Badges du post */}
                          <div className="flex items-center space-x-2">
                            {post.is_pinned && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shadow-sm">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Épinglé
                              </span>
                            )}
                            {post.is_locked && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 shadow-sm">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                Verrouillé
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Titre du post */}
                    <div className="mb-3">
                      <h3 className={`text-xl group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 leading-tight ${
                        isUnread(post) ? 'font-bold text-gray-900 dark:text-white' : 'font-normal text-gray-600 dark:text-gray-400'
                      }`}>
                        {post.title}
                      </h3>
                    </div>

                    {/* Date et Vues */}
                    <div className="flex items-center space-x-4 mb-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>{post.view_count} vue{post.view_count > 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Statistiques et dernière activité */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                      {/* Statistiques */}
                      <div className="flex items-center space-x-4">
                        <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-2 text-center w-20">
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {post.reply_count?.[0]?.count || 0}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            Réponse{(post.reply_count?.[0]?.count || 0) > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center w-20">
                          <div className="text-lg font-bold text-red-500">
                            {post.like_count?.[0]?.count || 0}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            J'aime{(post.like_count?.[0]?.count || 0) > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Dernière activité + Flèche */}
                      <div className="flex items-center space-x-4">
                        {post.latest_reply?.[0] && (
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              Dernière réponse par
                            </div>
                            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                              {post.latest_reply[0].author?.first_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimeAgo(post.latest_reply[0].created_at)}
                            </div>
                          </div>
                        )}

                        {/* Flèche */}
                        <div className="flex-shrink-0">
                          <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <nav className="flex space-x-2">
              {currentPage > 1 && (
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-3 py-2 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                >
                  Précédent
                </button>
              )}
              
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                if (page > totalPages) return null;
                
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 border rounded-lg ${
                      page === currentPage
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-700'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              
              {currentPage < totalPages && (
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-3 py-2 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                >
                  Suivant
                </button>
              )}
            </nav>
          </div>
        )}

        {/* Modal création post */}
        {showCreatePost && user && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Nouveau sujet
              </h3>
              <form onSubmit={handleCreatePost}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Titre du sujet
                  </label>
                  <input
                    type="text"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    placeholder="Saisissez le titre de votre sujet..."
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contenu
                  </label>
                  <RichTextEditor
                    value={newPost.content}
                    onChange={(content) => setNewPost({ ...newPost, content })}
                    placeholder="Décrivez votre sujet en détail..."
                    maxLength={1000}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreatePost(false)}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Publier le sujet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Message de bannissement pour création de post */}
        {postBanDetails && <BanNotice banDetails={postBanDetails} />}
      </div>
    </div>
  );
};

export default ForumCategory; 