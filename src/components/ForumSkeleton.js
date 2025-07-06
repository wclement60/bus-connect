import React from 'react';

const ForumSkeleton = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-dark-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-200 dark:bg-gray-700 h-24 p-6"></div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-2/3 mt-2"></div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ForumSkeleton; 