import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  hash?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

export function Toast({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
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
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
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
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-200';
      default:
        return 'text-blue-800 dark:text-blue-200';
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-300 dark:border-green-700';
      case 'error':
        return 'border-red-300 dark:border-red-700';
      case 'loading':
        return 'border-blue-300 dark:border-blue-700';
      case 'warning':
        return 'border-yellow-300 dark:border-yellow-700';
      default:
        return 'border-blue-300 dark:border-blue-700';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${getBgColor()} ${getBorderColor()}
        border rounded-lg p-4 shadow-lg w-full max-w-xs sm:max-w-sm
        flex items-start space-x-3
      `}
      role="alert"
      aria-live="polite"
    >
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
              aria-label="View transaction on explorer"
            >
              View Transaction: {toast.hash.slice(0, 8)}...{toast.hash.slice(-8)}
            </a>
          </div>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className={`mt-2 text-xs font-medium ${
              toast.type === 'error' ? 'text-red-600 dark:text-red-400' :
              toast.type === 'success' ? 'text-green-600 dark:text-green-400' :
              toast.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
              'text-blue-600 dark:text-blue-400'
            } hover:underline`}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {toast.type !== 'loading' && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function ToastContainer({ 
  toasts, 
  onRemove, 
  position = 'top-right' 
}: ToastContainerProps) {
  const getPositionClass = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  return (
    <div 
      className={`fixed z-50 space-y-2 ${getPositionClass()}`}
      aria-live="assertive"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Toast utility functions
export const createToast = (
  type: ToastType,
  title: string,
  options?: {
    message?: string;
    hash?: string;
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
): Toast => ({
  id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
  type,
  title,
  message: options?.message,
  hash: options?.hash,
  duration: options?.duration !== undefined 
    ? options.duration 
    : (type === 'loading' ? 0 : 5000),
  action: options?.action
});

export const showToast = (
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>,
  type: ToastType,
  title: string,
  options?: {
    message?: string;
    hash?: string;
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
) => {
  const toast = createToast(type, title, options);
  setToasts(prev => [...prev, toast]);
  return toast.id;
};

export const updateToast = (
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>,
  id: string,
  updates: Partial<Omit<Toast, 'id'>>
) => {
  setToasts(prev => prev.map(toast => 
    toast.id === id ? { ...toast, ...updates } : toast
  ));
};

export const dismissToast = (
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>,
  id: string
) => {
  setToasts(prev => prev.filter(toast => toast.id !== id));
};

export const useToasts = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  return {
    toasts,
    showToast: (
      type: ToastType,
      title: string,
      options?: {
        message?: string;
        hash?: string;
        duration?: number;
        action?: {
          label: string;
          onClick: () => void;
        };
      }
    ) => showToast(setToasts, type, title, options),
    updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => 
      updateToast(setToasts, id, updates),
    dismissToast: (id: string) => dismissToast(setToasts, id),
    dismissAllToasts: () => setToasts([]),
    ToastContainer: ({ position }: { position?: ToastContainerProps['position'] }) => (
      <ToastContainer 
        toasts={toasts} 
        onRemove={(id) => dismissToast(setToasts, id)} 
        position={position}
      />
    )
  };
};