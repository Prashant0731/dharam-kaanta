import { FC, useState, useRef } from 'react';
import { Camera, Image, X } from 'lucide-react';
import { clsx } from 'clsx';
import { compressImage, validateImageFile } from '../services/image';

interface PhotoCaptureProps {
  value: string;
  onChange: (base64: string) => void;
  label?: string;
  placeholder?: string;
}

export const PhotoCapture: FC<PhotoCaptureProps> = ({ 
  value, 
  onChange, 
  label = 'Photo',
  placeholder = 'Camera / Gallery'
}) => {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [compressing, setCompressing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      onChange(compressed);
    } catch (error) {
      console.error('Compression failed:', error);
      alert('Failed to compress image');
    } finally {
      setCompressing(false);
    }
  };

  const triggerCameraInput = () => cameraInputRef.current?.click();
  const triggerGalleryInput = () => galleryInputRef.current?.click();

  const clearPhoto = () => {
    setPreview(null);
    onChange('');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />
      {/* Gallery input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />
      
      <div 
        className={clsx(
          'relative w-20 h-20 sm:w-24 sm:h-24 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-lg border-2 border-dashed',
          'flex items-center justify-center overflow-hidden cursor-pointer',
          'bg-gray-50 dark:bg-gray-800',
          'border-gray-300 dark:border-gray-600',
          'hover:border-green-400 dark:hover:border-green-500',
          'transition-colors'
        )}
        onClick={triggerCameraInput}
      >
        {preview ? (
          <>
            <img 
              src={preview} 
              alt={label}
              className="w-full h-full object-cover"
            />
            {compressing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); clearPhoto(); }}
              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
              aria-label="Remove photo"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 p-2 text-center">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); triggerCameraInput(); }}
                className="p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                aria-label="Open camera"
              >
                <Camera className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); triggerGalleryInput(); }}
                className="p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                aria-label="Open gallery"
              >
                <Image className="w-6 h-6" />
              </button>
            </div>
            <span className="text-xs font-medium text-center">{placeholder}</span>
          </div>
        )}
      </div>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center w-24 sm:w-28">
        {preview ? 'Photo captured' : placeholder}
      </p>
    </div>
  );
};