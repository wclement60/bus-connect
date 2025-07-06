import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp, signIn, updateProfile } from '../services/auth';
import { supabase } from '../services/supabase';

// Liste des départements français triés par code
const departements = [
  { code: "01", nom: "Ain" },
  { code: "02", nom: "Aisne" },
  { code: "03", nom: "Allier" },
  { code: "04", nom: "Alpes-de-Haute-Provence" },
  { code: "05", nom: "Hautes-Alpes" },
  { code: "06", nom: "Alpes-Maritimes" },
  { code: "07", nom: "Ardèche" },
  { code: "08", nom: "Ardennes" },
  { code: "09", nom: "Ariège" },
  { code: "10", nom: "Aube" },
  { code: "11", nom: "Aude" },
  { code: "12", nom: "Aveyron" },
  { code: "13", nom: "Bouches-du-Rhône" },
  { code: "14", nom: "Calvados" },
  { code: "15", nom: "Cantal" },
  { code: "16", nom: "Charente" },
  { code: "17", nom: "Charente-Maritime" },
  { code: "18", nom: "Cher" },
  { code: "19", nom: "Corrèze" },
  { code: "21", nom: "Côte-d'Or" },
  { code: "22", nom: "Côtes-d'Armor" },
  { code: "23", nom: "Creuse" },
  { code: "24", nom: "Dordogne" },
  { code: "25", nom: "Doubs" },
  { code: "26", nom: "Drôme" },
  { code: "27", nom: "Eure" },
  { code: "28", nom: "Eure-et-Loir" },
  { code: "29", nom: "Finistère" },
  { code: "2A", nom: "Corse-du-Sud" },
  { code: "2B", nom: "Haute-Corse" },
  { code: "30", nom: "Gard" },
  { code: "31", nom: "Haute-Garonne" },
  { code: "32", nom: "Gers" },
  { code: "33", nom: "Gironde" },
  { code: "34", nom: "Hérault" },
  { code: "35", nom: "Ille-et-Vilaine" },
  { code: "36", nom: "Indre" },
  { code: "37", nom: "Indre-et-Loire" },
  { code: "38", nom: "Isère" },
  { code: "39", nom: "Jura" },
  { code: "40", nom: "Landes" },
  { code: "41", nom: "Loir-et-Cher" },
  { code: "42", nom: "Loire" },
  { code: "43", nom: "Haute-Loire" },
  { code: "44", nom: "Loire-Atlantique" },
  { code: "45", nom: "Loiret" },
  { code: "46", nom: "Lot" },
  { code: "47", nom: "Lot-et-Garonne" },
  { code: "48", nom: "Lozère" },
  { code: "49", nom: "Maine-et-Loire" },
  { code: "50", nom: "Manche" },
  { code: "51", nom: "Marne" },
  { code: "52", nom: "Haute-Marne" },
  { code: "53", nom: "Mayenne" },
  { code: "54", nom: "Meurthe-et-Moselle" },
  { code: "55", nom: "Meuse" },
  { code: "56", nom: "Morbihan" },
  { code: "57", nom: "Moselle" },
  { code: "58", nom: "Nièvre" },
  { code: "59", nom: "Nord" },
  { code: "60", nom: "Oise" },
  { code: "61", nom: "Orne" },
  { code: "62", nom: "Pas-de-Calais" },
  { code: "63", nom: "Puy-de-Dôme" },
  { code: "64", nom: "Pyrénées-Atlantiques" },
  { code: "65", nom: "Hautes-Pyrénées" },
  { code: "66", nom: "Pyrénées-Orientales" },
  { code: "67", nom: "Bas-Rhin" },
  { code: "68", nom: "Haut-Rhin" },
  { code: "69", nom: "Rhône" },
  { code: "70", nom: "Haute-Saône" },
  { code: "71", nom: "Saône-et-Loire" },
  { code: "72", nom: "Sarthe" },
  { code: "73", nom: "Savoie" },
  { code: "74", nom: "Haute-Savoie" },
  { code: "75", nom: "Paris" },
  { code: "76", nom: "Seine-Maritime" },
  { code: "77", nom: "Seine-et-Marne" },
  { code: "78", nom: "Yvelines" },
  { code: "79", nom: "Deux-Sèvres" },
  { code: "80", nom: "Somme" },
  { code: "81", nom: "Tarn" },
  { code: "82", nom: "Tarn-et-Garonne" },
  { code: "83", nom: "Var" },
  { code: "84", nom: "Vaucluse" },
  { code: "85", nom: "Vendée" },
  { code: "86", nom: "Vienne" },
  { code: "87", nom: "Haute-Vienne" },
  { code: "88", nom: "Vosges" },
  { code: "89", nom: "Yonne" },
  { code: "90", nom: "Territoire de Belfort" },
  { code: "91", nom: "Essonne" },
  { code: "92", nom: "Hauts-de-Seine" },
  { code: "93", nom: "Seine-Saint-Denis" },
  { code: "94", nom: "Val-de-Marne" },
  { code: "95", nom: "Val-d'Oise" },
  { code: "971", nom: "Guadeloupe" },
  { code: "972", nom: "Martinique" },
  { code: "973", nom: "Guyane" },
  { code: "974", nom: "La Réunion" },
  { code: "976", nom: "Mayotte" }
].sort((a, b) => {
  // Convertir les codes en nombres pour le tri
  const numA = parseInt(a.code, 10);
  const numB = parseInt(b.code, 10);
  
  // Gérer les cas spéciaux (2A, 2B et DOM-TOM)
  if (a.code === "2A") return 20.1 - numB;
  if (a.code === "2B") return 20.2 - numB;
  if (b.code === "2A") return numA - 20.1;
  if (b.code === "2B") return numA - 20.2;
  if (a.code.startsWith("97")) return 1000;
  if (b.code.startsWith("97")) return -1000;
  
  return numA - numB;
});

const Register = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState(new Date().toISOString().split('T')[0]);
  const [gender, setGender] = useState('');
  const [departement, setDepartement] = useState('');
  const [referralCode, setReferralCode] = useState('BUSCO-');
  const [referralError, setReferralError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Fonction pour gérer le changement du code de parrainage avec préfixe BUSCO- fixe
  const handleReferralCodeChange = (e) => {
    let value = e.target.value;
    
    // S'assurer que le préfixe BUSCO- est toujours présent
    if (!value.startsWith('BUSCO-')) {
      value = 'BUSCO-';
    }
    
    // Limiter la longueur totale (BUSCO-XXXXXXX = 15 caractères max)
    if (value.length > 15) {
      value = value.substring(0, 15);
    }
    
    setReferralCode(value);
    setReferralError(''); // Réinitialiser l'erreur quand l'utilisateur tape
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation des champs
    if (!firstName || !lastName || !email || !password || !confirmPassword || !birthDate || !gender || !departement) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    // Validation de la date de naissance
    const birthDateObj = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    if (age < 13) {
      setError('Vous devez avoir au moins 13 ans pour créer un compte.');
      return;
    }

    try {
      setError('');
      setReferralError('');
      setIsLoading(true);

      // Si un code de parrainage a été fourni, le valider AVANT de créer le compte
      if (referralCode && referralCode.trim() !== '' && referralCode.trim() !== 'BUSCO-') {
        // Utiliser directement le code saisi (déjà au format BUSCO-XXXX)
        const fullReferralCode = referralCode;
        console.log('Validation du code de parrainage avant création du compte:', fullReferralCode);
        
        // Vérifier si le code existe et est valide
        const { data: existingCode, error: codeCheckError } = await supabase
          .from('user_referral_codes')
          .select('user_id')
          .eq('referral_code', fullReferralCode)
          .single();
        
        if (codeCheckError || !existingCode) {
          setReferralError('Code de parrainage invalide. Veuillez vérifier le code ou laisser le champ vide.');
          setReferralCode('BUSCO-'); // Remettre à BUSCO- en cas d'erreur
          setIsLoading(false);
          return; // Arrêter l'inscription
        }
        
        console.log('Code de parrainage valide, création du compte...');
      }
      
      const userProfileData = {
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
        gender: gender,
        departement: departement
      };
      
      // Créer le compte seulement si le code est valide ou absent
      const { user } = await signUp(email, password, userProfileData);
      
      // Attendre que le code de parrainage personnel soit créé
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          const { data: userCode, error: codeError } = await supabase
            .from('user_referral_codes')
            .select('referral_code')
            .eq('user_id', user.id)
            .single();
          
          if (!codeError && userCode) {
            console.log('Code de parrainage personnel créé:', userCode.referral_code);
            break;
          }
        } catch (err) {
          console.log('Tentative', attempts + 1, 'de récupération du code...');
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Appliquer le code de parrainage si fourni et valide
      if (referralCode && referralCode.trim() !== '' && referralCode.trim() !== 'BUSCO-') {
        try {
          // Utiliser directement le code saisi (déjà au format BUSCO-XXXX)
          const fullReferralCode = referralCode;
          console.log('Application du code de parrainage:', fullReferralCode);
          
          const { data: result, error: referralApplyError } = await supabase
            .rpc('validate_and_apply_referral_code', {
              p_referred_user_id: user.id,
              p_referral_code: fullReferralCode
            });
          
          if (referralApplyError || !result.success) {
            console.error('Erreur lors de l\'application du code de parrainage');
            // Le code a été validé avant, donc cette erreur ne devrait pas arriver
          } else {
            console.log('Code de parrainage appliqué avec succès !');
          }
        } catch (error) {
          console.error('Erreur lors de l\'application du code de parrainage:', error);
        }
      }
      
      // Inscription réussie
      setSuccess("Votre compte a été créé avec succès ! Vous allez être redirigé vers la page d'accueil.");
      
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error("Erreur d'inscription:", error);
      setError(error.message || 'Une erreur est survenue lors de l\'inscription.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="w-full max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.2)]">
          {/* Bannière supérieure */}
          <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyB0cmFuc2Zvcm09InJvdGF0ZSg0NSAxMDQgNjUpIiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgb3BhY2l0eT0iMC4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxwYXRoIGQ9Ik0xMDIgMTlsMTIgMTJNMTA5IDEybDEyIDEyTTk3IDE0bDEyIDEyTTEwOSAyNmwxMiAxMk05OCA0NWwxMiAxMk0xMjEgMzNsMTIgMTJNMTI3IDQ3bDEyIDEyTTEwNyA1MmwxMiAxMk0xMTggNjZsMTIgMTJNOTcgNjFsMTIgMTJNMTE2IDgybDEyIDEyTTk0IDc3bDEyIDEyTTg5IDEwMGwxMiAxMk03MCA5NWwxMiAxMk04OSAxMjBsMTIgMTJNNjIgMTAxbDEyIDEyTTU3IDEyM2wxMiAxMk03NSAxMjZsMTIgMTIiLz48L2c+PC9zdmc+')] bg-center mix-blend-overlay"></div>
            <div className="flex items-center justify-center">
              <img src="/logo_white.svg" alt="Bus Connect Logo" className="h-20" />
            </div>
          </div>

          <div className="px-8 py-6">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-1">
              Créer un compte
            </h2>
            <p className="text-center text-gray-500 text-sm mb-8">
              Rejoignez-nous pour profiter de toutes les fonctionnalités
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
              <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 animate-pulse">
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

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                <div className="group">
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                    Prénom
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm"
                      placeholder="John"
                    />
                  </div>
                </div>

                <div className="group">
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                    Nom
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                    </div>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm"
                      placeholder="Doe"
                    />
                  </div>
                </div>
              </div>

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
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm"
                    placeholder="••••••••"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 ml-1">Le mot de passe doit contenir au moins 6 caractères</p>
              </div>

              <div className="group">
                <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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

              <div className="group">
                <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                  Date de naissance
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="birth_date"
                    name="birth_date"
                    type="date"
                    autoComplete="bday"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm appearance-none"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group">
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                  Genre
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select
                    id="gender"
                    name="gender"
                    required
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm appearance-none"
                  >
                    <option value="">Sélectionnez votre genre</option>
                    <option value="male">Homme</option>
                    <option value="female">Femme</option>
                    <option value="other">Autre</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group">
                <label htmlFor="departement" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                  Département
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select
                    id="departement"
                    name="departement"
                    required
                    value={departement}
                    onChange={(e) => setDepartement(e.target.value)}
                    className="pl-10 block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm appearance-none"
                  >
                    <option value="">Sélectionnez votre département</option>
                    {departements.map((dep) => (
                      <option key={dep.code} value={dep.code}>
                        {dep.nom} ({dep.code})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="group">
                <label htmlFor="referral_code" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                  Code de parrainage <span className="text-gray-400 text-xs">(optionnel)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                  </div>
                  <input
                    id="referral_code"
                    name="referral_code"
                    type="text"
                    value={referralCode}
                    onChange={handleReferralCodeChange}
                    className={`pl-10 block w-full px-4 py-3 rounded-xl border ${referralError ? 'border-red-300' : 'border-gray-200'} focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white shadow-sm text-sm`}
                    placeholder="BUSCO-XXXXXXX"
                  />
                </div>
                {referralError && (
                  <p className="mt-1 text-xs text-red-600 ml-1">{referralError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 ml-1">Si un ami vous a donné son code, saisissez-le ici. Vous gagnerez tous les deux 1 point ! 🎉</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || success}
                  className={`w-full flex justify-center py-3 px-4 rounded-[30px] text-base font-medium text-white 
                  ${isLoading || success ? 'bg-blue-400' : 'bg-[#2563EB] hover:bg-blue-600'}
                  focus:outline-none transform transition-all duration-150
                  ${isLoading || success ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Inscription en cours...
                    </div>
                  ) : success ? 'Compte créé !' : 'S\'inscrire'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <Link 
                to="/login" 
                className="w-full inline-flex justify-center py-3 px-6 rounded-[20px] text-base font-medium text-white bg-[#22C55E] hover:bg-green-600 focus:outline-none transform transition-all duration-150"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register; 