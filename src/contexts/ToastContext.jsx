/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

// --- TOAST NOTIFICATIONS ---
const ToastContext = createContext(null);

const TOAST_DEFAULT_DURATION = 4000;

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration === 0 ? 0 : (options.duration || TOAST_DEFAULT_DURATION),
      title: options.title || null
    };
    setToasts(prev => [...prev, toast]);
    if (toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration);
    }
    return id;
  }, [removeToast]);

  const api = useMemo(() => ({
    show: showToast,
    success: (msg, opts = {}) => showToast(msg, { ...opts, type: 'success' }),
    error: (msg, opts = {}) => showToast(msg, { ...opts, type: 'error' }),
    info: (msg, opts = {}) => showToast(msg, { ...opts, type: 'info' }),
    warning: (msg, opts = {}) => showToast(msg, { ...opts, type: 'warning' }),
    dismiss: removeToast
  }), [showToast, removeToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback seguro: caso algum componente seja renderizado fora do Provider
    return {
      show: (msg) => { console.warn('Toast fora do Provider:', msg); },
      success: (msg) => { console.warn('Toast fora do Provider:', msg); },
      error: (msg) => { console.warn('Toast fora do Provider:', msg); window.alert(msg); },
      info: (msg) => { console.warn('Toast fora do Provider:', msg); },
      warning: (msg) => { console.warn('Toast fora do Provider:', msg); },
      dismiss: () => {}
    };
  }
  return ctx;
}


function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-md w-[calc(100%-3rem)]">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const config = {
    success: {
      Icon: CheckCircle,
      iconClass: 'text-green-500',
      bar: 'from-green-500 to-emerald-400'
    },
    error: {
      Icon: AlertCircle,
      iconClass: 'text-red-500',
      bar: 'from-red-500 to-pink-500'
    },
    warning: {
      Icon: AlertCircle,
      iconClass: 'text-yellow-500',
      bar: 'from-yellow-500 to-amber-400'
    },
    info: {
      Icon: Info,
      iconClass: 'text-brand-500',
      bar: 'from-brand-500 to-brand-400'
    }
  };
  const { Icon, iconClass, bar } = config[toast.type] || config.info;

  return (
    <div
      role="status"
      className="pointer-events-auto bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
    >
      <div className={`h-1 bg-gradient-to-r ${bar}`} />
      <div className="flex items-start gap-3 p-4">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconClass}`} />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">{toast.title}</p>
          )}
          <p className="text-sm text-gray-700 dark:text-neutral-300 font-medium leading-snug break-words">
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-200 transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export { ToastContext, ToastProvider, useToast, ToastContainer, ToastItem };
