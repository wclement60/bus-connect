import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useForumNotifications } from '../context/ForumNotificationContext';
import { 
  getForumPost, 
  getForumReplies, 
  createForumReply, 
  toggleForumLike,
  updateForumPost,
  updateForumReply,
  deleteForumReply,
  deleteForumPost,
  markPostAsRead
} from '../services/forumService';
import LoadingSpinner from '../components/LoadingSpinner';
import ForumPostSkeleton from '../components/ForumPostSkeleton';
import Avatar from '../components/Avatar';
import BanNotice from '../components/BanNotice';
import RichTextEditor from '../components/RichTextEditor';
import RichTextDisplay from '../components/RichTextDisplay';
import LikesList from '../components/LikesList';
import { useBanStatus } from '../hooks/useBanStatus';

const ForumPost = () => {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditPost, setShowEditPost] = useState(false);
  const [newReply, setNewReply] = useState({ content: '', parent_reply_id: null });
  const [editPostData, setEditPostData] = useState({ title: '', content: '' });
  const [replyToId, setReplyToId] = useState(null);
  const [replyBanDetails, setReplyBanDetails] = useState(null);
  const [showLoginWarning, setShowLoginWarning] = useState(false);
  // const [expandedReplies, setExpandedReplies] = useState(new Set()); // Désactivé temporairement
  
  // Référence pour le formulaire de réponse
  const replyFormRef = useRef(null);
  
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isBanned, banDetails, loading: banLoading } = useBanStatus();
  const { refreshNotificationCount } = useForumNotifications();
  
  const isAdmin = profile?.modtools === 1;
  const canEdit = user && (user.id === post?.author_id || isAdmin);

  useEffect(() => {
    const initPost = async () => {
      setLoading(true);
      await loadPost();
      await loadReplies();
      setLoading(false);
      
      // Marquer le post comme lu pour l'utilisateur connecté
      if (user) {
        markPostAsRead(postId);
        // Rafraîchir le compteur de notifications après avoir marqué comme lu
        refreshNotificationCount();
      }
    };
    initPost();
  }, [postId, user]);

  const loadPost = async () => {
    try {
      const data = await getForumPost(postId);
      setPost(data);
      setEditPostData({ title: data.title, content: data.content });
    } catch (error) {
      showToast('Erreur lors du chargement du post', 'error');
      navigate('/forum');
    }
  };

  const loadReplies = async () => {
    try {
      const result = await getForumReplies(postId);
      setReplies(result.replies);
    } catch (error) {
      showToast('Erreur lors du chargement des réponses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReply = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await createForumReply({
        ...newReply,
        post_id: postId
      });
      setNewReply({ content: '', parent_reply_id: null });
      setShowReplyForm(false);
      setReplyToId(null);
      loadReplies();
      showToast('Réponse publiée avec succès', 'success');
      // Rafraîchir les notifications pour les autres utilisateurs
      refreshNotificationCount();
    } catch (error) {
      if (error.banDetails) {
        setReplyBanDetails(error.banDetails);
      } else {
        showToast('Erreur lors de la publication de la réponse', 'error');
      }
    }
  };

  const handleEditPost = async (e) => {
    e.preventDefault();
    if (!canEdit) return;

    try {
      await updateForumPost(postId, editPostData);
      setShowEditPost(false);
      loadPost();
      showToast('Post modifié avec succès', 'success');
    } catch (error) {
      showToast('Erreur lors de la modification du post', 'error');
    }
  };

  const handleLike = async (targetId, targetType) => {
    if (!user) {
      setShowLoginWarning(true);
      return;
    }

    try {
      await toggleForumLike(targetId, targetType);
      if (targetType === 'post') {
        loadPost();
      } else {
        loadReplies();
      }
    } catch (error) {
      showToast('Erreur lors du like', 'error');
    }
  };

  const handleReplyTo = (replyId, authorName) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setReplyToId(replyId);
    setNewReply({ 
      content: `@${authorName} `, 
      parent_reply_id: replyId 
    });
    setShowReplyForm(true);
    
    // Scroll automatique vers le formulaire avec un petit délai pour l'animation
    setTimeout(() => {
      replyFormRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  };

  const handleDeleteReply = async (replyId) => {
    if (!isAdmin) return;
    
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette réponse ? Cette action est irréversible.')) {
      return;
    }

    try {
      await deleteForumReply(replyId);
      showToast('Réponse supprimée avec succès', 'success');
      loadReplies();
    } catch (error) {
      showToast('Erreur lors de la suppression de la réponse', 'error');
    }
  };

  const handleDeletePost = async () => {
    if (!isAdmin) return;
    
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce post et toutes ses réponses ? Cette action est irréversible.')) {
      return;
    }

    try {
      await deleteForumPost(postId);
      showToast('Post supprimé avec succès', 'success');
      navigate(`/forum/category/${post.subcategory_id}`);
    } catch (error) {
      showToast('Erreur lors de la suppression du post', 'error');
    }
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

  const formatContent = (content) => {
    // Remplacer les mentions @utilisateur par des liens stylés plus visibles
    // Capture les lettres avec accents : À-ÿ inclut tous les accents français
    return content.replace(/@([a-zA-ZÀ-ÿ0-9_]+)/g, '<span class="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">@$1</span>');
  };

  // const toggleReplyExpansion = (replyId) => {
  //   const newExpanded = new Set(expandedReplies);
  //   if (newExpanded.has(replyId)) {
  //     newExpanded.delete(replyId);
  //   } else {
  //     newExpanded.add(replyId);
  //   }
  //   setExpandedReplies(newExpanded);
  // };

  if (loading || banLoading) {
    return <ForumPostSkeleton />;
  }

  // Si l'utilisateur est banni, afficher seulement le message de bannissement
  if (user && isBanned) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
        <BanNotice banDetails={banDetails} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">Post non trouvé.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20">
      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link to="/forum" className="hover:text-blue-600 dark:hover:text-blue-400">
            Forum
          </Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link to={`/forum#category-${post.subcategory?.category?.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">
            {post.subcategory?.category?.name}
          </Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link 
            to={`/forum/category/${post.subcategory_id}`}
            className="hover:text-blue-600 dark:hover:text-blue-400"
          >
            {post.subcategory?.name}
          </Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-800 dark:text-white truncate" style={{ maxWidth: '250px' }}>
            {post.title}
          </span>
        </nav>

        {/* Post principal */}
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
          {/* En-tête avec badges */}
          {(post.is_pinned || post.is_locked) && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 px-6 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                {post.is_pinned && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shadow-sm">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Épinglé
                  </span>
                )}
                {post.is_locked && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 shadow-sm">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Verrouillé
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="p-8">
            {/* En-tête du post avec auteur */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                  {post.title}
                </h1>
                
                {/* Informations auteur stylées */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                  <Avatar user={post.author} size="lg" />
                  <div className="flex-1">
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
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatDate(post.created_at)}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>{post.view_count} vue{post.view_count > 1 ? 's' : ''}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {canEdit && (
                      <button
                        onClick={() => setShowEditPost(true)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                        title="Modifier"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={handleDeletePost}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                        title="Supprimer ce post"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Contenu du post */}
            <div className="mb-8 text-gray-800 dark:text-gray-200 leading-relaxed">
              <RichTextDisplay content={post.content} />
            </div>

            {/* Actions et statistiques */}
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                                  <button
                  onClick={() => handleLike(post.id, 'post')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200 font-medium ${
                    post.user_liked
                      ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white shadow-md'
                      : 'bg-white dark:bg-dark-600 border-gray-200 dark:border-gray-600 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:border-red-600 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400'
                  }`}
                >
                  <svg className="w-5 h-5" fill={post.user_liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>{post.like_count?.[0]?.count || 0}</span>
                </button>
                  
                  {user && !post.is_locked && (
                    <button
                      onClick={() => {
                        setShowReplyForm(!showReplyForm);
                        if (!showReplyForm) {
                          setTimeout(() => {
                            replyFormRef.current?.scrollIntoView({ 
                              behavior: 'smooth', 
                              block: 'start' 
                            });
                          }, 100);
                        }
                      }}
                      className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      <span className="font-medium">Répondre</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Liste des likes du post */}
              <LikesList 
                targetId={post.id} 
                targetType="post" 
                likeCount={post.like_count?.[0]?.count || 0} 
              />
            </div>
          </div>
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
                pour répondre à ce sujet.
              </p>
            </div>
          </div>
        )}

        {/* Liste des réponses */}
        <div className="space-y-6">
          {replies.map((reply, index) => (
            <div key={reply.id} className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="p-6">
                {/* En-tête de la réponse avec avatar et infos */}
                <div className="flex items-start space-x-4 mb-4">
                  <div className="relative">
                    <Avatar user={reply.author} size="lg" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {reply.author?.first_name} {reply.author?.last_name}
                          </h4>
                          {reply.author?.modtools === 1 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 shadow-sm">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{formatDate(reply.created_at)}</span>
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteReply(reply.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                          title="Supprimer cette réponse"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Contenu de la réponse */}
                <div className="ml-20 mb-4">
                  <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    <RichTextDisplay content={reply.content} />
                  </div>
                </div>

                {/* Actions de la réponse */}
                <div className="ml-20 bg-gray-50 dark:bg-dark-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleLike(reply.id, 'reply')}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all duration-200 text-sm font-medium ${
                          reply.user_liked
                            ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white shadow-md'
                            : 'bg-white dark:bg-dark-600 border-gray-200 dark:border-gray-600 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:border-red-600 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                        }`}
                      >
                        <svg className="w-4 h-4" fill={reply.user_liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span>{reply.like_count?.[0]?.count || 0}</span>
                      </button>
                      
                      {user && !post.is_locked && (
                        <button
                          onClick={() => handleReplyTo(reply.id, reply.author?.first_name)}
                          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 shadow-sm hover:shadow-md text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          <span className="font-medium">Répondre</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Liste des likes de la réponse */}
                  <LikesList 
                    targetId={reply.id} 
                    targetType="reply" 
                    likeCount={reply.like_count?.[0]?.count || 0} 
                  />
                </div>

                {/* Réponses imbriquées - Fonctionnalité temporairement désactivée */}
                {/* TODO: Implémenter les réponses imbriquées avec getChildReplies() */}
              </div>
            </div>
          ))}
        </div>

        {/* Formulaire de réponse - Toujours en bas de page */}
        {showReplyForm && user && (
          <>
            <style dangerouslySetInnerHTML={{
              __html: `
                @keyframes fadeInUp {
                  from {
                    opacity: 0;
                    transform: translateY(20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `
            }} />
            <div 
              ref={replyFormRef}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-xl border-2 border-blue-200 dark:border-blue-700 p-8 mt-8"
              style={{
                animation: 'fadeInUp 0.4s ease-out forwards'
              }}
            >
            {/* En-tête du formulaire */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {replyToId ? 'Répondre au message' : 'Nouvelle réponse'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Partagez vos idées avec la communauté
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyToId(null);
                  setNewReply({ content: '', parent_reply_id: null });
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-dark-700 rounded-lg transition-all duration-200"
                title="Fermer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleCreateReply} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Votre réponse
                </label>
                <RichTextEditor
                  value={newReply.content}
                  onChange={(content) => setNewReply({ ...newReply, content })}
                  placeholder={replyToId ? "Tapez votre réponse ici..." : "Écrivez votre réponse..."}
                  maxLength={1000}
                />
              </div>

              {/* Aide et Actions */}
              <div className="space-y-4">
                {/* Conseil d'utilisation */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        💡 Conseil
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                        Utilisez <code className="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded text-blue-800 dark:text-blue-200 font-mono text-xs">@nom</code> pour mentionner quelqu'un dans votre réponse
                      </p>
                    </div>
                  </div>
                </div>

                {/* Boutons d'action */}
                <div className="flex items-center justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyToId(null);
                      setNewReply({ content: '', parent_reply_id: null });
                    }}
                    className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-700 border-2 border-gray-300 dark:border-gray-500 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-600 hover:border-gray-400 dark:hover:border-gray-400 transition-all duration-200 font-medium flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Annuler</span>
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-semibold flex items-center space-x-2 transform hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Publier la réponse</span>
                  </button>
                </div>
              </div>
            </form>
            </div>
          </>
        )}

        {/* Modal modification post */}
        {showEditPost && canEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Modifier le sujet
              </h3>
              <form onSubmit={handleEditPost}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Titre
                  </label>
                  <input
                    type="text"
                    value={editPostData.title}
                    onChange={(e) => setEditPostData({ ...editPostData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contenu
                  </label>
                  <textarea
                    value={editPostData.content}
                    onChange={(e) => setEditPostData({ ...editPostData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-700 dark:text-white"
                    rows="8"
                    required
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditPost(false)}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Sauvegarder
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Avertissement de connexion */}
        {showLoginWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4 text-center shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Connexion requise
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Vous devez être connecté pour pouvoir aimer un message ou une réponse.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  type="button"
                  onClick={() => setShowLoginWarning(false)}
                  className="px-6 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-700 border-2 border-gray-300 dark:border-gray-500 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-600 transition-all duration-200 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginWarning(false);
                    navigate('/login');
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                >
                  Se connecter
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Message de bannissement pour réponse */}
        {replyBanDetails && <BanNotice banDetails={replyBanDetails} />}
      </div>
    </div>
  );
};

export default ForumPost; 