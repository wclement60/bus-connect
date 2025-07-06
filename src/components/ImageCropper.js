import React, { useState, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';

const ImageCropper = ({ imageSrc, onCropComplete, onCancel, isOpen }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const canvasRef = useRef(null);

  const onCropChange = useCallback((crop) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteHandler = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Fonction pour créer l'image recadrée
  const createCroppedImage = useCallback(async () => {
    if (!croppedAreaPixels || !imageSrc) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        // Définir la taille du canvas pour un carré
        const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height);
        canvas.width = size;
        canvas.height = size;

        // Dessiner l'image recadrée
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          size,
          size
        );

        // Convertir en blob
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.9);
      };
      image.src = imageSrc;
    });
  }, [croppedAreaPixels, imageSrc]);

  const handleCropConfirm = async () => {
    try {
      const croppedImageBlob = await createCroppedImage();
      if (croppedImageBlob) {
        onCropComplete(croppedImageBlob);
      }
    } catch (error) {
      console.error('Error during crop:', error);
      alert('Erreur lors du recadrage de l\'image. Veuillez réessayer.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
            Recadrer votre photo
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
            Utilisez les gestes tactiles : glissez pour déplacer, pincez pour zoomer
          </p>
        </div>

        {/* Image cropping area */}
        <div className="relative flex-1 min-h-0">
          <div className="h-[40vh] sm:h-[50vh] relative">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1} // Carré
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteHandler}
              showGrid={true}
              style={{
                containerStyle: {
                  background: '#000',
                },
                cropAreaStyle: {
                  border: '2px solid #60a5fa',
                  color: 'rgba(96, 165, 250, 0.5)',
                },
              }}
            />
          </div>

          {/* Contrôles de zoom (desktop) */}
          <div className="hidden sm:flex absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 rounded-full px-4 py-2 items-center space-x-3">
            <button
              onClick={() => setZoom(Math.max(1, zoom - 0.1))}
              className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white hover:bg-opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-white text-sm font-medium min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.1))}
              className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white hover:bg-opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contrôles mobile - en bas, séparés */}
        <div className="sm:hidden bg-gray-100 dark:bg-gray-700 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Zoom</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <div className="flex items-center space-x-3 mt-2">
            <button
              onClick={() => setZoom(Math.max(1, zoom - 0.1))}
              className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #60a5fa 0%, #60a5fa ${((zoom - 1) / 2) * 100}%, #cbd5e1 ${((zoom - 1) / 2) * 100}%, #cbd5e1 100%)`
              }}
            />
            
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.1))}
              className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer with buttons */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-stretch sm:items-center space-y-3 sm:space-y-0 flex-shrink-0">
          {/* Mobile: Stack buttons vertically */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full">
            <button
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Annuler
            </button>
            
            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }}
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
              >
                Reset
              </button>
              
              <button
                onClick={handleCropConfirm}
                disabled={!croppedAreaPixels}
                className="flex-1 sm:flex-none px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>

        {/* Canvas caché pour le rendu de l'image recadrée */}
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default ImageCropper; 