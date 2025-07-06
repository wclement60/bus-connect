import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const ReferralLeaderboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('monthly');
  const [monthlyRanking, setMonthlyRanking] = useState([]);
  const [allTimeRanking, setAllTimeRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState({ monthly: null, allTime: null });

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      // Test: Vérifier les données mensuelles
      const { data: testData, error: testError } = await supabase
        .rpc('test_monthly_data');
      
      console.log('Test données mensuelles:', testData, 'Erreur test:', testError);
      
      // Debug: Vérifier les points existants
      const { data: debugPoints, error: debugError } = await supabase
        .rpc('debug_referral_points');
      
      console.log('Points de parrainage existants:', debugPoints);
      
      // Debug: Vérifier l'historique
      const { data: debugHistory, error: debugHistoryError } = await supabase
        .rpc('debug_referral_history');
      
      console.log('Historique des parrainages:', debugHistory);
      
      // Récupérer le classement mensuel
      const { data: monthlyData, error: monthlyError } = await supabase
        .rpc('get_monthly_referral_ranking', { p_limit: 100 });
      
      console.log('Données classement mensuel:', monthlyData, 'Erreur:', monthlyError);
      
      if (!monthlyError && monthlyData) {
        setMonthlyRanking(monthlyData);
        // Trouver le rang de l'utilisateur actuel
        const userMonthlyRank = monthlyData.find(r => r.user_id === user?.id);
        if (userMonthlyRank) {
          setUserRank(prev => ({ ...prev, monthly: userMonthlyRank.rank }));
        }
      }

      // Récupérer le classement à vie
      const { data: allTimeData, error: allTimeError } = await supabase
        .rpc('get_all_time_referral_ranking', { p_limit: 100 });
      
      console.log('Données classement à vie:', allTimeData, 'Erreur:', allTimeError);
      
      if (!allTimeError && allTimeData) {
        setAllTimeRanking(allTimeData);
        // Trouver le rang de l'utilisateur actuel
        const userAllTimeRank = allTimeData.find(r => r.user_id === user?.id);
        if (userAllTimeRank) {
          setUserRank(prev => ({ ...prev, allTime: userAllTimeRank.rank }));
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des classements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-yellow-600'; // Jaune foncé
    if (rank === 2) return 'bg-gray-400'; // Argent
    if (rank === 3) return 'bg-orange-600'; // Bronze
    return ''; // Pas de background pour 4ème et plus
  };

  const getRankText = (rank) => {
    if (rank === 1) return '1er';
    if (rank === 2) return '2ème';
    if (rank === 3) return '3ème';
    return `${rank}ème`;
  };

  const getRankTextColor = (rank) => {
    if (rank <= 3) return 'text-black'; // Texte noir pour les 3 premiers
    return 'text-gray-900 dark:text-white'; // Texte normal pour les autres
  };

  const RankingTable = ({ data, type }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Rang
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Utilisateur
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Points
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => (
            <tr 
              key={item.user_id}
              className={`${item.user_id === user?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <span className={`font-semibold text-sm px-2.5 py-1 rounded-md shadow-sm border ${getRankColor(item.rank)} ${getRankTextColor(item.rank)} ${item.rank <= 3 ? 'border-transparent' : 'border-gray-300 dark:border-gray-600'}`}>
                    {getRankText(item.rank)}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    {item.avatar_url ? (
                      <img 
                        src={item.avatar_url} 
                        alt="Avatar" 
                        className="h-10 w-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold border-2 border-gray-200 dark:border-gray-700">
                        {(item.first_name || item.email || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.first_name && item.last_name 
                        ? `${item.first_name} ${item.last_name.charAt(0).toUpperCase()}.`
                        : item.email}
                    </div>
                    {item.user_id === user?.id && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        C'est vous !
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {type === 'monthly' ? item.monthly_points : item.total_points}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  pts
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-cyan-400 to-pink-500 rounded-xl p-8 text-white mb-8 shadow-lg">
          <Link to="/account" className="inline-flex items-center text-white/80 hover:text-white mb-4 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour au compte
          </Link>
          <h1 className="text-3xl font-bold mb-2">Classement du parrainage</h1>
          <p className="text-white/80">
            Découvrez qui sont les meilleurs parrains de la communauté Bus Connect !
          </p>
          {user && (userRank.monthly || userRank.allTime) && (
            <div className="mt-4 flex flex-wrap gap-4">
              {userRank.monthly && (
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <span className="text-sm opacity-80">Votre rang mensuel :</span>
                  <span className="ml-2 font-bold text-lg">#{userRank.monthly}</span>
                </div>
              )}
              {userRank.allTime && (
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <span className="text-sm opacity-80">Votre rang à vie :</span>
                  <span className="ml-2 font-bold text-lg">#{userRank.allTime}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Onglets */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('monthly')}
                className={`relative px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'monthly'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Classement du mois
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('allTime')}
                className={`relative px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'allTime'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Classement à vie
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  Tous les temps
                </span>
              </button>
            </nav>
          </div>

          {/* Contenu */}
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {activeTab === 'monthly' && (
                  monthlyRanking.length > 0 ? (
                    <RankingTable data={monthlyRanking} type="monthly" />
                  ) : (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="mt-2 text-gray-500 dark:text-gray-400">
                        Aucun parrainage ce mois-ci. Soyez le premier !
                      </p>
                    </div>
                  )
                )}

                {activeTab === 'allTime' && (
                  allTimeRanking.length > 0 ? (
                    <RankingTable data={allTimeRanking} type="allTime" />
                  ) : (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="mt-2 text-gray-500 dark:text-gray-400">
                        Aucun parrainage pour le moment. Commencez à partager !
                      </p>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralLeaderboard; 