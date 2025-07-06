import React from 'react';

const ForumPostSkeleton = () => {
  const SkeletonLine = ({ width, height = 'h-4', className = '' }) => (
    <div className={`bg-gray-200 dark:bg-dark-700 rounded ${height} ${width} ${className}`}></div>
  );

  const ReplySkeleton = () => (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-start space-x-4">
        <div className="w-12 h-12 bg-gray-300 dark:bg-dark-600 rounded-full flex-shrink-0"></div>
        <div className="flex-1 space-y-3">
          <SkeletonLine width="w-1/3" />
          <div className="space-y-2">
            <SkeletonLine width="w-full" />
            <SkeletonLine width="w-5/6" />
            <SkeletonLine width="w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 pt-4 pb-20 animate-pulse">
      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center space-x-2 mb-4">
          <SkeletonLine width="w-16" height="h-5" />
          <SkeletonLine width="w-4 h-4" />
          <SkeletonLine width="w-24" height="h-5" />
          <SkeletonLine width="w-4 h-4" />
          <SkeletonLine width="w-32" height="h-5" />
        </div>

        {/* Main Post Skeleton */}
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 mb-8">
          {/* Title Skeleton */}
          <SkeletonLine width="w-3/4" height="h-8" className="mb-4" />
          
          {/* Author Info Skeleton */}
          <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg mb-6">
            <div className="w-16 h-16 bg-gray-300 dark:bg-dark-600 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <SkeletonLine width="w-1/4" />
              <SkeletonLine width="w-1/3" height="h-3" />
            </div>
          </div>
          
          {/* Content Skeleton */}
          <div className="space-y-3 mb-8">
            <SkeletonLine width="w-full" />
            <SkeletonLine width="w-full" />
            <SkeletonLine width="w-11/12" />
            <SkeletonLine width="w-full" />
            <SkeletonLine width="w-5/6" />
          </div>
          
          {/* Actions Skeleton */}
          <div className="flex items-center space-x-3">
            <SkeletonLine width="w-20" height="h-10" />
            <SkeletonLine width="w-24" height="h-10" />
          </div>
        </div>
        
        {/* Replies Skeleton */}
        <div className="space-y-6">
          <ReplySkeleton />
          <ReplySkeleton />
          <ReplySkeleton />
        </div>
      </div>
    </div>
  );
};

export default ForumPostSkeleton; 