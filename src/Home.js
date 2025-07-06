import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-animated-gradient">
      {/* Logo centré */}
      <div>
        <img src="bc.svg" alt="Logo" className="w-80 h-80 object-contain" />
      </div>
      {/* Paragraphe de présentation rapproché du logo */}
      <div className="-mt-4 text-center max-w-xl px-4">
        <p className="text-white text-sm">
          Bienvenue sur la version 4 de Bus Connect, cette nouvelle version offre des nouveautés et une fluidité 100x plus performante qu'avant, un design retravaillé de A à Z pour vous faciliter la navigation.
        </p>
      </div>
      {/* Boutons */}
      <div className="mt-8 flex flex-col space-y-4">

        <button
          onClick={() => navigate('/networks')}
          className="w-64 px-6 py-3 border-2 border-white text-white font-semibold rounded-full shadow-md hover:bg-white hover:text-yellow-500 transition"
        >
          Continuer en tant qu'invité
        </button>
      </div>
    </div>
  );
};

export default Home;
