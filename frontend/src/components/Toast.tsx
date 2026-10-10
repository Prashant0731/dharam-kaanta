import { FC, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

export const Toast: FC<ToastProps> = ({ message, type = 'info', onClose, duration = 3000 }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const typeStyles = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  return (
    <div 
      className={clsx(
        'fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white',
        'animate-slide-in',
        typeStyles[type]
      )}
      style={{ minWidth: '280px', maxWidth: '400px' }}
    >
      <span className="flex-shrink-0">{icons[type]}</span>
      <p className="text-sm flex-1">{message}</p>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 300); }} className="flex-shrink-0 p-1 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Add animation CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in { animation: slide-in 0.3s ease-out; }
  `;
  document.head.appendChild(style);
}