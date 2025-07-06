import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6">
        <div className="flex flex-col items-center">
          {/* Logo */}
          <div className="mb-4">
            <Link to="/" className="flex items-center">
              <img 
                src="/logo_white.svg" 
                alt="Bus Connect Logo" 
                className="h-36 w-auto"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/240x60?text=Bus+Connect';
                }}
              />
            </Link>
          </div>
          
          {/* Navigation rapide - centré et flexible */}
          <div className="flex flex-wrap justify-center text-white text-sm mb-6">

            <Link to="/account" className="hover:text-white/80 transition-colors mx-2 my-1">
              Mon Compte
            </Link>
            <span className="text-white/60 mx-1 my-1">•</span>
            <Link to="/privacy-policy" className="hover:text-white/80 transition-colors mx-2 my-1">
              Confidentialité
            </Link>
            <span className="text-white/60 mx-1 my-1">•</span>
            <Link to="/legal-notice" className="hover:text-white/80 transition-colors mx-2 my-1">
              Mentions légales
            </Link>
          </div>
          
          {/* Bouton Contact */}
          <div className="w-full max-w-xs mx-auto mb-6">
            <Link 
              to="/contact" 
              className="flex items-center justify-center bg-white hover:bg-white/90 transition-all duration-200 py-3 px-6 rounded-full shadow-lg font-bold"
            >
              <svg className="w-5 h-5 mr-2 text-[#07d6fb]" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
              </svg>
              <span className="bg-gradient-to-r from-[#07d6fb] to-[#ff66c4] text-transparent bg-clip-text">Nous contacter</span>
            </Link>
          </div>
        </div>
        
        <div className="text-white/80 text-xs text-center mt-4 pt-3 border-t border-white/20">
          <div className="mb-1 text-white/60">v.prod beta 4.0.0</div>
          © {currentYear} Bus Connect. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
};

export default Footer; 