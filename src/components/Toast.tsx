import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  title: string;
  message?: string;
  hash?: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

export function Toast({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onRemove(toast.id), 300);
      }, toast.duration || 5000);
      
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'loading':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'loading':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
    }
  };

  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-800 dark:text-green-200';
      case 'error':
        return 'text-red-800 dark:text-red-200';
      case 'loading':
        return 'text-blue-800 dark:text-blue-200';
      default:
        return 'text-blue-800 dark:text-blue-200';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${getBgColor()}
        border rounded-lg p-4 shadow-lg max-w-sm w-full
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${getTextColor()}`}>
            {toast.title}
          </div>
          {toast.message && (
            <div className={`mt-1 text-sm ${getTextColor()} opacity-90`}>
              {toast.message}
            </div>
          )}
          {toast.hash && (
            <div className="mt-2">
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${toast.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                View Transaction: {toast.hash.slice(0, 8)}...{toast.hash.slice(-8)}
              </a>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onRemove(toast.id), 300);
          }}
          className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Toast utility functions
export const createToast = (
  type: Toast['type'],
  title: string,
  message?: string,
  hash?: string,
  duration?: number
): Toast => ({
  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  type,
  title,
  message,
  hash,
  duration: duration !== undefined ? duration : (type === 'loading' ? 0 : 5000)
});

export const showToast = (
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>,
  type: Toast['type'],
  title: string,
  message?: string,
  hash?: string,
  duration?: number
) => {
  const toast = createToast(type, title, message, hash, duration);
  setToasts(prev => [...prev, toast]);
  return toast.id;
};

export const updateToast = (
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>,
  id: string,
  updates: Partial<Toast>
) => {
  setToasts(prev => prev.map(toast => 
    toast.id === id ? { ...toast, ...updates } : toast
  ));
};

export const removeToast = (
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>,
  id: string
) => {
  setToasts(prev => prev.filter(toast => toast.id !== id));
}; 