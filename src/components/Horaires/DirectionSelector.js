import React, { useState, useRef, useEffect } from 'react';
import { IoArrowForward } from 'react-icons/io5';
import '../Horaires/Horaires.css';

const DirectionSelector = ({ value, onChange, directions = [], disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDirection = directions.find(d => d.direction_id === value);

  return (
    <div className="direction-selector-container">
      <div className="direction-select-label">
        Sélectionner une direction
      </div>
      <div className="direction-select-group" ref={dropdownRef}>
        <button
          type="button"
          className={`direction-select-button ${isOpen ? 'open' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <div className="direction-select-content">
            <IoArrowForward className="direction-select-icon" />
            <span className="direction-select-text">
              {selectedDirection?.name || "Choisir une direction"}
            </span>
          </div>
          <svg 
            className={`direction-select-chevron ${isOpen ? 'rotate' : ''}`}
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="direction-select-dropdown">
            {directions.map((direction) => (
              <button
                key={direction.direction_id}
                className={`direction-select-option ${direction.direction_id === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(direction.direction_id);
                  setIsOpen(false);
                }}
              >
                {direction.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectionSelector; 