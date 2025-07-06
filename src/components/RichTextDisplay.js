import React from 'react';

const RichTextDisplay = ({ content, className = "" }) => {
  // Nettoyer et sécuriser le contenu HTML
  const sanitizeContent = (htmlContent) => {
    if (!htmlContent) return '';
    
    // Remplacer les mentions @utilisateur par des liens stylés
    // Utilise \p{L} pour capturer toutes les lettres Unicode (y compris les accents)
    // \p{N} pour les chiffres, _ pour underscore
    return htmlContent.replace(/@([\p{L}\p{N}_]+)/gu, '<span class="mention">@$1</span>');
  };

  return (
    <div className={`rich-text-display ${className}`}>
      <div 
        className="prose max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ 
          __html: sanitizeContent(content) 
        }}
      />
      
      {/* Styles CSS intégrés pour éviter les problèmes styled-jsx */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .rich-text-display .prose {
            color: inherit;
            line-height: 1.6;
          }
          
          .rich-text-display .prose h1 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 0.5em 0;
            color: inherit;
          }
          
          .rich-text-display .prose h2 {
            font-size: 1.3em;
            font-weight: bold;
            margin: 0.5em 0;
            color: inherit;
          }
          
          .rich-text-display .prose h3 {
            font-size: 1.1em;
            font-weight: bold;
            margin: 0.5em 0;
            color: inherit;
          }
          
          .rich-text-display .prose p {
            margin: 0.5em 0;
            color: inherit;
          }
          
          .rich-text-display .prose strong {
            font-weight: bold;
            color: inherit;
          }
          
          .rich-text-display .prose em {
            font-style: italic;
            color: inherit;
          }
          
          .rich-text-display .prose u {
            text-decoration: underline;
            color: inherit;
          }
          
          .rich-text-display .prose s {
            text-decoration: line-through;
            color: inherit;
          }
          
          .rich-text-display .prose ol {
            list-style-type: decimal;
            margin-left: 1.5em;
            margin: 0.5em 0 0.5em 1.5em;
          }
          
          .rich-text-display .prose ul {
            list-style-type: disc;
            margin-left: 1.5em;
            margin: 0.5em 0 0.5em 1.5em;
          }
          
          .rich-text-display .prose li {
            margin: 0.25em 0;
            color: inherit;
          }
          
          .rich-text-display .prose blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 1em;
            margin: 1em 0;
            font-style: italic;
            background-color: #f8fafc;
            padding: 0.75em 1em;
            border-radius: 4px;
            color: inherit;
          }
          
          .dark .rich-text-display .prose blockquote {
            background-color: #1f2937;
            border-left-color: #60a5fa;
          }
          
          .rich-text-display .prose pre {
            background-color: #f1f5f9;
            padding: 1em;
            border-radius: 4px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            margin: 0.5em 0;
          }
          
          .dark .rich-text-display .prose pre {
            background-color: #374151;
            color: #f9fafb;
          }
          
          .rich-text-display .prose code {
            background-color: #f1f5f9;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          
          .dark .rich-text-display .prose code {
            background-color: #374151;
            color: #f9fafb;
          }
          
          .rich-text-display .prose img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 0.5em 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          
          .rich-text-display .prose a {
            color: #3b82f6;
            text-decoration: underline;
          }
          
          .rich-text-display .prose a:hover {
            color: #1d4ed8;
          }
          
          .dark .rich-text-display .prose a {
            color: #60a5fa;
          }
          
          .dark .rich-text-display .prose a:hover {
            color: #93c5fd;
          }
          
          .rich-text-display .mention {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 0.2em 0.5em;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.9em;
            display: inline-block;
            margin: 0 0.1em;
            box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
          }
          
          .dark .rich-text-display .mention {
            background: linear-gradient(135deg, #60a5fa, #3b82f6);
            box-shadow: 0 2px 4px rgba(96, 165, 250, 0.3);
          }
        `
      }} />
    </div>
  );
};

export default RichTextDisplay; 