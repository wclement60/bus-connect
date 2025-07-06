import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

const ResetPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();

  const handleVerification = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !birthDate) {
      setError('Veuillez fournir votre email et votre date de naissance.');
      setIsLoading(false);
      return;
    }

    try {
      // Récupérer l'utilisateur depuis la table users avec une comparaison insensible à la casse
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, birth_date')
        .ilike('email', email)
        .single();

      if (userError || !userData) {
        console.error('Erreur Supabase:', userError);
        throw new Error('Aucun utilisateur trouvé avec ces informations.');
      }
      
      // La date de naissance peut inclure l'heure, donc on ne compare que la partie date
      const dbBirthDate = new Date(userData.birth_date).toISOString().split('T')[0];
      const inputBirthDate = new Date(birthDate).toISOString().split('T')[0];

      if (dbBirthDate === inputBirthDate) {
        setUserId(userData.id);
        setStep(2);
      } else {
        throw new Error('La date de naissance ne correspond pas.');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .rpc('reset_password_without_email', {
          p_user_id: userId,
          p_password: password
        });

      if (error) throw error;
      if (!data.success) throw new Error(data.message || 'Erreur lors de la réinitialisation du mot de passe.');

      setSuccess('Votre mot de passe a été réinitialisé avec succès ! Vous allez être redirigé vers la page de connexion.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      setError('Erreur lors de la réinitialisation du mot de passe. ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderStepOne = () => (
    <form className="space-y-5" onSubmit={handleVerification}>
      <div className="group">
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

      <div className="group">
        <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
          Date de naissance
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center py-3 px-4 rounded-[30px] text-base font-medium text-white bg-[#22C55E] hover:bg-green-600 focus:outline-none transform transition-all duration-150 ${
            isLoading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Vérification en cours...
            </div>
          ) : (
            'Vérifier'
          )}
        </button>
      </div>
    </form>
  );

  const renderStepTwo = () => (
    <form className="space-y-5" onSubmit={handlePasswordReset}>
      <div className="group">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
          Nouveau mot de passe
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div className="group">
        <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
          Confirmer le mot de passe
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isLoading || success}
          className={`w-full flex justify-center py-3 px-4 rounded-[30px] text-base font-medium text-white bg-[#22C55E] hover:bg-green-600 focus:outline-none transform transition-all duration-150 ${
            (isLoading || success) ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Chargement...
            </div>
          ) : (
            'Réinitialiser le mot de passe'
          )}
        </button>
      </div>
    </form>
  );

  return (
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
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
              {step === 1 ? 'Mot de passe oublié ?' : 'Nouveau mot de passe'}
            </h2>
            <p className="text-center text-gray-500 text-sm mb-8">
              {step === 1 
                ? 'Pour réinitialiser votre mot de passe, veuillez confirmer votre identité.' 
                : 'Choisissez un nouveau mot de passe sécurisé.'}
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

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 animate-fade-in">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800 font-medium">
                      {success}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 1 ? renderStepOne() : renderStepTwo()}

            <div className="mt-6">
              <Link 
                to="/login" 
                className="w-full flex justify-center py-3 px-4 rounded-[30px] text-base font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 focus:outline-none transform transition-all duration-150"
              >
                Retour à la connexion
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 