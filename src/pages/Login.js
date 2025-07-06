import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useAnimation } from '../context/AnimationContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { playWelcomeAnimation } = useAnimation();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    
    try {
      setError('');
      setIsLoading(true);

      // Connexion de l'utilisateur
      await signIn(email, password);

      // Récupérer les informations de l'utilisateur
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Erreur lors de la connexion');
      }

      // Récupérer le prénom de l'utilisateur
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('first_name')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;
      
      // Déclencher l'animation globale et naviguer
      playWelcomeAnimation({ firstName: userData.first_name });
      navigate('/');

    } catch (error) {
      console.error('Erreur de connexion:', error);
      let errorMessage = 'Une erreur est survenue lors de la connexion.';
      
      // Gérer les différents types d'erreurs
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email ou mot de passe incorrect.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Veuillez confirmer votre adresse email avant de vous connecter.';
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Adresse email invalide.';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="w-full max-w-md mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.2)]">
            {/* Bannière supérieure */}
            <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyB0cmFuc2Zvcm09InJvdGF0ZSg0NSAxMDQgNjUpIiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgb3BhY2l0eT0iMC4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxwYXRoIGQ9Ik0xMDIgMTlsMTIgMTJNMTA5IDEybDEyIDEyTTk3IDE0bDEyIDEyTTEwOSAyNmwxMiAxMk05OCA0NWwxMiAxMk0xMjEgMzNsMTIgMTJNMTI3IDQ3bDEyIDEyTTEwNyA1MmwxMiAxMk0xMTggNjZsMTIgMTJNOTcgNjFsMTIgMTJNMTE2IDgybDEyIDEyTTk0IDc3bDEyIDEyTTg5IDEwMGwxMiAxMk03MCA5NWwxMiAxMk04OSAxMjBsMTIgMTJNNjIgMTAxbDEyIDEyTTU3IDEyM2wxMiAxMk03NSAxMjZsMTIgMTIiLz48L2c+PC9zdmc+')] bg-center mix-blend-overlay"></div>
              <div className="flex items-center justify-center">
                <img src="/logo_white.svg" alt="Bus Connect Logo" className="h-20" />
              </div>
            </div>

            <div className="px-8 py-6">
              <p className="text-center text-gray-500 text-sm mb-8">
                Connectez-vous pour accéder à vos itinéraires et favoris
              </p>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 animate-fade-in">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800 font-medium">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <form className="" onSubmit={handleLogin}>
                <div className="group mb-5">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                    Adresse e-mail
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm"
                      placeholder="exemple@email.com"
                    />
                  </div>
                </div>

                <div className="group mb-5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="text-sm text-right mb-5">
                  <Link to="/reset-password" className="font-medium text-blue-600 hover:text-blue-500 inline-flex items-center">
                    Mot de passe oublié ?
                    <span 
                      className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{
                        background: 'linear-gradient(135deg, #07d6fb, #ff66c4)'
                      }}
                    >
                      nouveau
                    </span>
                  </Link>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full flex justify-center py-3 px-4 rounded-[30px] text-base font-medium text-white 
                    ${isLoading ? 'bg-green-400' : 'bg-[#22C55E] hover:bg-green-600'}
                    focus:outline-none transform transition-all duration-150
                    ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connexion en cours...
                      </div>
                    ) : (
                      'Se connecter'
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  to="/register" 
                  className="w-full inline-flex justify-center py-3 px-4 rounded-[30px] text-base font-medium text-white bg-[#2563EB] hover:bg-blue-600 focus:outline-none transform transition-all duration-150"
                >
                  S'inscrire
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login; 