import React, { useState, useRef, useEffect } from 'react';

const MarqueeSelect = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldMarquee, setShouldMarquee] = useState({});
  const wrapperRef = useRef(null);
  const selectedTextRef = useRef(null);

  // Trouve l'option actuellement sélectionnée
  const selectedOption = options.find(opt => opt.value.toString() === value.toString());
  const selectedText = selectedOption ? selectedOption.label : placeholder || 'Sélectionner';

  // Vérifie si le texte est plus large que son conteneur
  useEffect(() => {
    if (selectedTextRef.current) {
      const { offsetWidth, scrollWidth } = selectedTextRef.current;
      setShouldMarquee(prev => ({
        ...prev,
        selected: scrollWidth > offsetWidth
      }));
    }
  }, [selectedText]);

  // Gère les clics en dehors du composant pour fermer le menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className="flex items-center p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-dark-700 rounded-xl"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="w-6 h-6 text-gray-500 dark:text-gray-400 shrink-0 ml-1 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        
        <div className="flex-1 overflow-hidden whitespace-nowrap marquee-wrapper">
          {shouldMarquee.selected ? (
            <div className="marquee-container">
              <div className="fade-left"></div>
              <div className="marquee-content">
                <span className="text-base sm:text-lg text-gray-700 dark:text-gray-200 font-medium">{selectedText}</span>
                <span className="text-base sm:text-lg text-gray-700 dark:text-gray-200 font-medium spacer">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                <span className="text-base sm:text-lg text-gray-700 dark:text-gray-200 font-medium">{selectedText}</span>
              </div>
              <div className="fade-right"></div>
            </div>
          ) : (
            <div className="text-base sm:text-lg text-gray-700 dark:text-gray-200 font-medium" ref={selectedTextRef}>
              {selectedText}
            </div>
          )}
        </div>
        
        <svg className="w-6 h-6 text-gray-500 dark:text-gray-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-800 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto border border-gray-200 dark:border-dark-600">
          {options.map((option, index) => (
            <div 
              key={index} 
              className={`p-4 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer transition-colors ${option.value.toString() === value.toString() ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <div className="text-base sm:text-lg text-gray-800 dark:text-gray-100 flex items-center">
                {option.value.toString() === value.toString() && (
                  <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {option.label}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <style jsx="true">{`
        .marquee-wrapper {
          position: relative;
        }
        
        .marquee-container {
          width: 100%;
          overflow: hidden;
          position: relative;
        }
        
        .marquee-content {
          display: inline-flex;
          white-space: nowrap;
          animation: marquee-scroll 15s linear infinite;
          padding: 0 5px;
        }
        
        @keyframes marquee-scroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .marquee-content:hover {
          animation-play-state: paused;
        }
        
        .spacer {
          opacity: 0.5;
        }
        
        .fade-left, .fade-right {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 20px;
          z-index: 2;
          pointer-events: none;
        }
        
        .fade-left {
          left: 0;
          background: linear-gradient(to right, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));
        }
        
        .dark .fade-left {
          background: linear-gradient(to right, rgba(30, 41, 59, 1), rgba(30, 41, 59, 0));
        }
        
        .fade-right {
          right: 0;
          background: linear-gradient(to left, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));
        }
        
        .dark .fade-right {
          background: linear-gradient(to left, rgba(30, 41, 59, 1), rgba(30, 41, 59, 0));
        }
      `}</style>
    </div>
  );
};

export default MarqueeSelect; 