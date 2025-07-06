import React from 'react';

const BanNotice = ({ banDetails }) => {
  if (!banDetails) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl p-6 max-w-md w-full">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 bg-red-100 dark:bg-red-900 rounded-full p-3">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
            Accès au forum restreint
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Raison du bannissement
            </h3>
            <p className="mt-1 text-gray-900 dark:text-white">
              {banDetails.reason}
            </p>
          </div>

          {banDetails.message && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Message de l'administration
              </h3>
              <p className="mt-1 text-gray-900 dark:text-white">
                {banDetails.message}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Période de bannissement
            </h3>
            <p className="mt-1 text-gray-900 dark:text-white">
              Du {formatDate(banDetails.banned_at)}
              {banDetails.expires_at ? (
                <> au {formatDate(banDetails.expires_at)}</>
              ) : (
                <> - <span className="text-red-600 dark:text-red-400 font-medium">Permanent</span></>
              )}
            </p>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Banni par : {banDetails.banned_by_name}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Si vous pensez que ce bannissement est une erreur, vous pouvez contacter l'administration via le formulaire de contact.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BanNotice; 