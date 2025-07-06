import React, { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { uploadImage } from '../services/imageUploadService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const RichTextEditor = ({ 
  value, 
  onChange, 
  placeholder = "Écrivez votre message...",
  maxLength = 1000,
  className = ""
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const editorRef = useRef(null);

  // Gestionnaire d'upload d'image personnalisé
  const handleImageUpload = (blobInfo, progress) => {
    return new Promise(async (resolve, reject) => {
      if (!user) {
        const errorMsg = 'Vous devez être connecté pour uploader des images';
        showToast(errorMsg, 'error');
        reject(errorMsg);
        return;
      }

      try {
        // Convertir le blob en fichier
        const file = blobInfo.blob();
        
        console.log('Upload image - Taille:', file.size, 'Type:', file.type);
        
        const result = await uploadImage(file, user.id);
        
        console.log('Résultat upload:', result);
        
        if (result.success) {
          showToast('Image uploadée avec succès', 'success');
          resolve(result.url);
        } else {
          const errorMsg = result.error || 'Erreur lors de l\'upload';
          showToast(errorMsg, 'error');
          console.error('Erreur upload détaillée:', result);
          reject(errorMsg);
        }
      } catch (error) {
        const errorMsg = 'Erreur lors de l\'upload de l\'image';
        showToast(errorMsg, 'error');
        console.error('Erreur upload exception:', error);
        reject(error.message || error);
      }
    });
  };

  // Calculer le nombre de caractères (texte brut)
  const getCharacterCount = () => {
    if (!editorRef.current) return 0;
    const content = editorRef.current.getContent({ format: 'text' });
    return content.length;
  };

  // Gérer le changement de contenu
  const handleEditorChange = (content, editor) => {
    const textLength = editor.getContent({ format: 'text' }).length;
    
    if (textLength <= maxLength) {
      onChange(content);
    } else {
      showToast(`Message trop long. Maximum ${maxLength} caractères.`, 'warning');
      // Annuler la dernière modification
      editor.undoManager.undo();
    }
  };

  return (
    <div className={`rich-text-editor ${className}`}>
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        <Editor
          apiKey="3g3ygqs056ss3tvunse85a96seansdhhw3qt0ummoq66wkc7"
          onInit={(evt, editor) => editorRef.current = editor}
          value={value}
          onEditorChange={handleEditorChange}
          init={{
            height: 300,
            menubar: false,
            plugins: [
              'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
              'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
              'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | blocks | ' +
              'bold italic underline strikethrough | forecolor backcolor | ' +
              'alignleft aligncenter alignright alignjustify | ' +
              'bullist numlist outdent indent | ' +
              'removeformat | link image | code | help',
            content_style: `
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; 
                font-size: 14px; 
                line-height: 1.6;
                color: #374151;
              }
              img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
              blockquote { 
                border-left: 4px solid #3b82f6; 
                padding-left: 16px; 
                margin: 16px 0; 
                font-style: italic; 
                background-color: #f8fafc; 
                padding: 12px 16px; 
                border-radius: 4px; 
              }
              code { 
                background-color: #f1f5f9; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-family: 'Courier New', monospace; 
                font-size: 0.9em; 
              }
              pre { 
                background-color: #f1f5f9; 
                padding: 12px; 
                border-radius: 4px; 
                overflow-x: auto; 
                font-family: 'Courier New', monospace; 
              }
            `,
            skin: 'oxide',
            placeholder: placeholder,
            branding: false,
            resize: false,
            elementpath: false,
            statusbar: false,
            
            // Configuration d'upload d'images
            images_upload_handler: handleImageUpload,
            automatic_uploads: true,
            images_reuse_filename: true,
            
            // Validation des images
            file_picker_types: 'image',
            images_file_types: 'jpg,jpeg,png,gif',
            
            // Configuration des couleurs
            color_map: [
              '000000', 'Noir',
              '993300', 'Marron foncé',
              '333300', 'Olive foncé',
              '003300', 'Vert foncé',
              '003366', 'Bleu foncé',
              '000080', 'Bleu marine',
              '333399', 'Indigo',
              '333333', 'Gris très foncé',
              '800000', 'Marron',
              'FF6600', 'Orange',
              '808000', 'Olive',
              '008000', 'Vert',
              '008080', 'Sarcelle',
              '0000FF', 'Bleu',
              '666699', 'Gris bleu',
              '808080', 'Gris',
              'FF0000', 'Rouge',
              'FF9900', 'Ambre',
              '99CC00', 'Vert jaune',
              '339966', 'Vert de mer',
              '33CCCC', 'Turquoise',
              '3366FF', 'Bleu royal',
              '800080', 'Violet',
              '999999', 'Gris moyen',
              'FF00FF', 'Magenta',
              'FFCC00', 'Or',
              'FFFF00', 'Jaune',
              '00FF00', 'Lime',
              '00FFFF', 'Cyan',
              '00CCFF', 'Bleu ciel',
              '993366', 'Rouge brun',
              'FFFFFF', 'Blanc'
            ],
            
            // Blocs personnalisés
            block_formats: 'Paragraphe=p; Titre 1=h1; Titre 2=h2; Titre 3=h3; Citation=blockquote; Code=pre',
            
            // Configuration de langue (optionnel)
            language: 'fr_FR',
            
            // Empêcher la saisie si limite atteinte
            setup: (editor) => {
              editor.on('keydown', (e) => {
                const textLength = editor.getContent({ format: 'text' }).length;
                if (textLength >= maxLength && e.keyCode !== 8 && e.keyCode !== 46) {
                  e.preventDefault();
                  showToast(`Maximum ${maxLength} caractères atteint`, 'warning');
                }
              });
            }
          }}
        />
      </div>
      
      {/* Compteur de caractères */}
      <div className="flex justify-between items-center mt-2 text-sm">
        <div className="text-gray-500 dark:text-gray-400">
          💡 Utilisez la barre d'outils pour formater votre texte et ajouter des images
        </div>
        <div className={`font-medium ${
          getCharacterCount() > maxLength * 0.9 
            ? 'text-red-600 dark:text-red-400' 
            : 'text-gray-500 dark:text-gray-400'
        }`}>
          {getCharacterCount()}/{maxLength}
        </div>
      </div>
    </div>
  );
};

export default RichTextEditor; 