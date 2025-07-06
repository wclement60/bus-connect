import { supabase } from './supabase';
import { checkUserBanned, getActiveBan } from './banService';

// ==================== CATÉGORIES ====================

export const getForumCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('forum_categories')
      .select(`
        *,
        subcategories:forum_subcategories(
          *,
          post_count:forum_posts(count),
          latest_post:forum_posts(
            title,
            created_at,
            author:users!forum_posts_author_id_fkey(first_name, last_name, avatar_url, modtools)
          )
        )
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { foreignTable: 'subcategories.latest_post', ascending: false })
      .limit(1, { foreignTable: 'subcategories.latest_post' });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    throw error;
  }
};

export const createForumCategory = async (categoryData) => {
  try {
    const { data, error } = await supabase
      .from('forum_categories')
      .insert({
        ...categoryData,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    throw error;
  }
};

export const updateForumCategory = async (categoryId, updates) => {
  try {
    const { data, error } = await supabase
      .from('forum_categories')
      .update(updates)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    throw error;
  }
};

export const deleteForumCategory = async (categoryId) => {
  try {
    const { error } = await supabase
      .from('forum_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    throw error;
  }
};

// ==================== SOUS-CATÉGORIES ====================

export const getForumSubcategories = async (categoryId) => {
  try {
    const { data, error } = await supabase
      .from('forum_subcategories')
      .select(`
        *,
        category:forum_categories(name),
        post_count:forum_posts(count),
        latest_post:forum_posts(
          id,
          title,
          created_at,
          author:users!forum_posts_author_id_fkey(first_name, last_name, avatar_url, modtools),
          reply_count:forum_replies(count)
        )
      `)
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { foreignTable: 'latest_post', ascending: false })
      .limit(1, { foreignTable: 'latest_post' });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération des sous-catégories:', error);
    throw error;
  }
};

export const createForumSubcategory = async (subcategoryData) => {
  try {
    const { data, error } = await supabase
      .from('forum_subcategories')
      .insert({
        ...subcategoryData,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la création de la sous-catégorie:', error);
    throw error;
  }
};

export const updateForumSubcategory = async (subcategoryId, updates) => {
  try {
    const { data, error } = await supabase
      .from('forum_subcategories')
      .update(updates)
      .eq('id', subcategoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la sous-catégorie:', error);
    throw error;
  }
};

export const deleteForumSubcategory = async (subcategoryId) => {
  try {
    const { error } = await supabase
      .from('forum_subcategories')
      .delete()
      .eq('id', subcategoryId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de la sous-catégorie:', error);
    throw error;
  }
};

// ==================== POSTS ====================

export const getForumPosts = async (subcategoryId, page = 1, limit = 20) => {
  try {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('forum_posts')
      .select(`
        *,
        author:users!forum_posts_author_id_fkey(first_name, last_name, avatar_url, modtools),
        subcategory:forum_subcategories(
          name,
          category:forum_categories(name)
        ),
        reply_count:forum_replies(count),
        like_count:forum_likes(count)
      `, { count: 'exact' })
      .eq('subcategory_id', subcategoryId)
      .order('is_pinned', { ascending: false })
      .order('last_reply_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    
    // Pour chaque post, récupérer la dernière réponse séparément
    const postsWithLatestReply = await Promise.all(
      data.map(async (post) => {
        const { data: latestReply } = await supabase
          .from('forum_replies')
          .select(`
            created_at,
            author:users!forum_replies_author_id_fkey(first_name, last_name, avatar_url, modtools)
          `)
          .eq('post_id', post.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        return {
          ...post,
          latest_reply: latestReply || []
        };
      })
    );
    
    return { posts: postsWithLatestReply, totalCount: count };
  } catch (error) {
    console.error('Erreur lors de la récupération des posts:', error);
    throw error;
  }
};

export const getForumPost = async (postId) => {
  try {
    // Incrémenter le compteur de vues
    try {
      await supabase.rpc('increment_post_view_count', { post_id: postId });
    } catch (viewError) {
      console.log('Erreur compteur de vues (non critique):', viewError);
    }

    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        *,
        author:users!forum_posts_author_id_fkey(first_name, last_name, avatar_url, modtools),
        subcategory:forum_subcategories(
          name,
          category:forum_categories(id, name)
        ),
        like_count:forum_likes(count)
      `)
      .eq('id', postId)
      .single();

    if (error) throw error;

    // Vérifier si l'utilisateur actuel a liké ce post
    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      const userLiked = await checkUserLiked(postId, 'post', user.id);
      data.user_liked = userLiked;
    }

    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération du post:', error);
    throw error;
  }
};

export const createForumPost = async (postData) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Utilisateur non connecté');

    // Vérifier si l'utilisateur est banni
    const isBanned = await checkUserBanned(user.id);
    if (isBanned) {
      const banDetails = await getActiveBan(user.id);
      const error = new Error('Vous êtes banni du forum');
      error.banDetails = banDetails;
      throw error;
    }

    // Vérifier si la sous-catégorie est verrouillée
    const { data: subcategory } = await supabase
      .from('forum_subcategories')
      .select('is_locked')
      .eq('id', postData.subcategory_id)
      .single();

    // Vérifier si l'utilisateur est admin
    const { data: profile } = await supabase
      .from('users')
      .select('modtools')
      .eq('id', user.id)
      .single();

    if (subcategory?.is_locked && profile?.modtools !== 1) {
      throw new Error('Cette catégorie est verrouillée. La création de nouveaux posts n\'est pas autorisée.');
    }

    const { data, error } = await supabase
      .from('forum_posts')
      .insert({
        ...postData,
        author_id: user.id
      })
      .select(`
        *,
        author:users!forum_posts_author_id_fkey(first_name, last_name, avatar_url),
        subcategory:forum_subcategories(name, category:forum_categories(name))
      `)
      .single();

    if (error) throw error;
    
    // Déclencher un événement pour notifier la création d'un nouveau post
    window.dispatchEvent(new Event('forumPostCreated'));
    
    return data;
  } catch (error) {
    console.error('Erreur lors de la création du post:', error);
    throw error;
  }
};

export const updateForumPost = async (postId, updates) => {
  try {
    const { data, error } = await supabase
      .from('forum_posts')
      .update(updates)
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du post:', error);
    throw error;
  }
};

export const deleteForumPost = async (postId) => {
  try {
    const { error } = await supabase
      .from('forum_posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression du post:', error);
    throw error;
  }
};

// ==================== RÉPONSES ====================

export const getForumReplies = async (postId, page = 1, limit = 50) => {
  try {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('forum_replies')
      .select(`
        *,
        author:users!forum_replies_author_id_fkey(first_name, last_name, avatar_url, modtools),
        like_count:forum_likes(count)
      `, { count: 'exact' })
      .eq('post_id', postId)
      // Récupérer TOUTES les réponses (pas seulement niveau 1)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) throw error;

    // Vérifier si l'utilisateur actuel a liké chaque réponse
    const user = (await supabase.auth.getUser()).data.user;
    if (user && data) {
      const repliesWithLikeStatus = await Promise.all(
        data.map(async (reply) => {
          const userLiked = await checkUserLiked(reply.id, 'reply', user.id);
          return { ...reply, user_liked: userLiked };
        })
      );
      return { replies: repliesWithLikeStatus, totalCount: count };
    }

    return { replies: data, totalCount: count };
  } catch (error) {
    console.error('Erreur lors de la récupération des réponses:', error);
    throw error;
  }
};

export const getChildReplies = async (parentReplyId) => {
  try {
    const { data, error } = await supabase
      .from('forum_replies')
      .select(`
        *,
        author:users!forum_replies_author_id_fkey(first_name, last_name, avatar_url, modtools),
        like_count:forum_likes(count)
      `)
      .eq('parent_reply_id', parentReplyId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération des réponses imbriquées:', error);
    throw error;
  }
};

export const createForumReply = async (replyData) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Utilisateur non connecté');

    // Vérifier si l'utilisateur est banni
    const isBanned = await checkUserBanned(user.id);
    if (isBanned) {
      const banDetails = await getActiveBan(user.id);
      const error = new Error('Vous êtes banni du forum');
      error.banDetails = banDetails;
      throw error;
    }

    const { data, error } = await supabase
      .from('forum_replies')
      .insert({
        ...replyData,
        author_id: user.id
      })
      .select(`
        *,
        author:users!forum_replies_author_id_fkey(first_name, last_name, avatar_url, modtools)
      `)
      .single();

    if (error) throw error;
    
    // Mettre à jour last_reply_at du post
    const { error: updateError } = await supabase
      .from('forum_posts')
      .update({ last_reply_at: new Date().toISOString() })
      .eq('id', replyData.post_id);
      
    if (updateError) {
      console.error('Erreur lors de la mise à jour de last_reply_at:', updateError);
    }
    
    return data;
  } catch (error) {
    console.error('Erreur lors de la création de la réponse:', error);
    throw error;
  }
};

export const updateForumReply = async (replyId, updates) => {
  try {
    const { data, error } = await supabase
      .from('forum_replies')
      .update(updates)
      .eq('id', replyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la réponse:', error);
    throw error;
  }
};

export const deleteForumReply = async (replyId) => {
  try {
    const { error } = await supabase
      .from('forum_replies')
      .delete()
      .eq('id', replyId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de la réponse:', error);
    throw error;
  }
};

// ==================== LIKES ====================

// Marquer un post comme lu
export const markPostAsRead = async (postId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Ne fait rien pour les invités

    const { error } = await supabase.rpc('mark_post_as_read', { p_post_id: postId });
    if (error) throw error;
  } catch (error) {
    // Erreur non critique, on ne la montre pas à l'utilisateur
    console.error('Erreur lors du marquage comme lu:', error.message);
  }
};

// Obtenir le statut de lecture pour plusieurs posts
export const getPostsViewStatus = async (postIds) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !postIds || postIds.length === 0) return {};

    const { data, error } = await supabase
      .from('forum_post_views')
      .select('post_id, last_read_at')
      .eq('user_id', user.id)
      .in('post_id', postIds);
      
    if (error) throw error;

    // Convertit le tableau en objet pour un accès facile : { postId: last_read_at }
    return data.reduce((acc, view) => {
      acc[view.post_id] = view.last_read_at;
      return acc;
    }, {});
  } catch (error) {
    console.error('Erreur lors de la récupération du statut de lecture:', error);
    return {};
  }
};

export const checkUserLiked = async (targetId, targetType, userId) => {
  try {
    if (!userId) return false;
    
    const { data, error } = await supabase
      .from('forum_likes')
      .select('id')
      .eq('user_id', userId)
      .eq(targetType === 'post' ? 'post_id' : 'reply_id', targetId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Erreur lors de la vérification du like:', error);
    return false;
  }
};

export const toggleForumLike = async (targetId, targetType) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Utilisateur non connecté');

    const likeData = {
      user_id: user.id,
      [targetType === 'post' ? 'post_id' : 'reply_id']: targetId
    };

    // Vérifier si le like existe déjà
    const { data: existingLike, error: checkError } = await supabase
      .from('forum_likes')
      .select('id')
      .eq('user_id', user.id)
      .eq(targetType === 'post' ? 'post_id' : 'reply_id', targetId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingLike) {
      // Supprimer le like existant
      const { error: deleteError } = await supabase
        .from('forum_likes')
        .delete()
        .eq('id', existingLike.id);

      if (deleteError) throw deleteError;
      return { liked: false };
    } else {
      // Créer un nouveau like
      const { error: insertError } = await supabase
        .from('forum_likes')
        .insert(likeData);

      if (insertError) throw insertError;
      return { liked: true };
    }
  } catch (error) {
    console.error('Erreur lors du toggle du like:', error);
    // Ne pas faire planter l'app pour un like
    return { liked: false };
  }
};

// Récupérer les utilisateurs qui ont liké un post ou une réponse
export const getForumLikes = async (targetId, targetType) => {
  try {
    const { data, error } = await supabase
      .from('forum_likes')
      .select(`
        id,
        created_at,
        user:users!forum_likes_user_id_fkey(
          id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq(targetType === 'post' ? 'post_id' : 'reply_id', targetId)
      .order('created_at', { ascending: false }); // Le plus récent en premier

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des likes:', error);
    return [];
  }
};

// ==================== FONCTIONS UTILES ====================

export const searchForumPosts = async (query, page = 1, limit = 20) => {
  try {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('forum_posts')
      .select(`
        *,
        author:users!forum_posts_author_id_fkey(first_name, last_name, avatar_url, modtools),
        subcategory:forum_subcategories(name, category:forum_categories(name)),
        reply_count:forum_replies(count)
      `, { count: 'exact' })
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('last_reply_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { posts: data, totalCount: count };
  } catch (error) {
    console.error('Erreur lors de la recherche:', error);
    throw error;
  }
};

export const getRecentForumActivity = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        id,
        title,
        created_at,
        last_reply_at,
        author:users!forum_posts_author_id_fkey(first_name, last_name, avatar_url, modtools),
        subcategory:forum_subcategories(name, category:forum_categories(name)),
        reply_count:forum_replies(count)
      `)
      .order('last_reply_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'activité récente:', error);
    throw error;
  }
};

// Fonction PostgreSQL pour incrémenter le compteur de vues
export const createIncrementViewCountFunction = async () => {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION increment_post_view_count(post_id UUID)
        RETURNS void AS $$
        BEGIN
          UPDATE forum_posts 
          SET view_count = view_count + 1 
          WHERE id = post_id;
        END;
        $$ LANGUAGE plpgsql;
      `
    });

    if (error) throw error;
  } catch (error) {
    console.error('Erreur lors de la création de la fonction:', error);
    throw error;
  }
};

// ==================== NOTIFICATIONS ====================

// Compter les sujets où l'utilisateur a reçu de nouvelles réponses non lues d'autres utilisateurs
export const getUnreadForumNotificationsCount = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    // 1. Récupérer tous les posts créés par l'utilisateur
    const { data: userPosts, error: postsError } = await supabase
      .from('forum_posts')  
      .select('id, last_reply_at, created_at')
      .eq('author_id', user.id);

    if (postsError) throw postsError;

    // 2. Récupérer tous les posts où l'utilisateur a participé (répondu)
    const { data: participatedPosts, error: participatedError } = await supabase
      .from('forum_replies')
      .select(`
        post_id,
        forum_posts!inner(id, last_reply_at, created_at, author_id)
      `)
      .eq('author_id', user.id);

    if (participatedError) throw participatedError;

    // 3. Combiner les deux listes et éliminer les doublons
    const allRelevantPosts = new Map();
    
    // Ajouter les posts créés par l'utilisateur
    if (userPosts) {
      userPosts.forEach(post => {
        allRelevantPosts.set(post.id, {
          id: post.id,
          last_reply_at: post.last_reply_at,
          created_at: post.created_at,
          is_author: true
        });
      });
    }

    // Ajouter les posts où l'utilisateur a participé
    if (participatedPosts) {
      participatedPosts.forEach(reply => {
        const post = reply.forum_posts;
        if (!allRelevantPosts.has(post.id)) {
          allRelevantPosts.set(post.id, {
            id: post.id,
            last_reply_at: post.last_reply_at,
            created_at: post.created_at,
            is_author: post.author_id === user.id
          });
        }
      });
    }

    if (allRelevantPosts.size === 0) return 0;

    // 4. Récupérer le statut de lecture pour tous ces posts
    const postIds = Array.from(allRelevantPosts.keys());
    const viewStatus = await getPostsViewStatus(postIds);

    // 5. Compter les posts qui ont de nouvelles réponses non lues d'autres utilisateurs
    let unreadCount = 0;
    
    for (const [postId, postInfo] of allRelevantPosts) {
      const lastReadAt = viewStatus[postId];
      
      // Récupérer la dernière réponse qui N'EST PAS de l'utilisateur actuel
      const { data: lastReplyFromOthers, error: replyError } = await supabase
        .from('forum_replies')
        .select('created_at, author_id')
        .eq('post_id', postId)
        .neq('author_id', user.id) // Exclure les réponses de l'utilisateur actuel
        .order('created_at', { ascending: false })
        .limit(1);

      if (replyError) {
        console.error('Erreur lors de la récupération des réponses:', replyError);
        continue;
      }

      // Si il y a une réponse d'un autre utilisateur
      if (lastReplyFromOthers && lastReplyFromOthers.length > 0) {
        const lastReplyAt = lastReplyFromOthers[0].created_at;
        
        // Déterminer la date de référence pour la comparaison
        let referenceDate;
        if (!lastReadAt) {
          // Si pas de lecture enregistrée, utiliser la date de création du post
          // ou la date de la première participation de l'utilisateur
          referenceDate = postInfo.created_at;
        } else {
          // Si lecture enregistrée, utiliser cette date
          referenceDate = lastReadAt;
        }
        
        // Si la dernière réponse d'un autre utilisateur est plus récente que la référence
        if (new Date(lastReplyAt) > new Date(referenceDate)) {
          unreadCount++;
        }
      }
    }

    return unreadCount;
  } catch (error) {
    console.error('Erreur lors du comptage des notifications forum:', error);
    return 0;
  }
}; 