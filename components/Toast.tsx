import React from 'react';
import ReactDOM from 'react-dom';
import { CheckCircleIcon, XCircleIcon } from './icons/Icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastProps {
    toast: ToastMessage;
    onDismiss: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    const [isExiting, setIsExiting] = React.useState(false);
    
    React.useEffect(() => {
        const timer = setTimeout(() => {
             setIsExiting(true);
        }, 4500); // Start exit animation before removal
        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = () => {
        setIsExiting(true);
    };

    const typeClasses = {
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        info: 'bg-blue-50 border-blue-200',
    };

    const iconClasses = {
        success: 'text-green-500',
        error: 'text-red-500',
        info: 'text-blue-500',
    };
    
    const icons = {
        success: <CheckCircleIcon solid className={`h-6 w-6 ${iconClasses.success}`} />,
        error: <XCircleIcon solid className={`h-6 w-6 ${iconClasses.error}`} />,
        info: <CheckCircleIcon solid className={`h-6 w-6 ${iconClasses.info}`} />,
    };

    const animationClasses = isExiting 
        ? 'opacity-0 translate-y-2' 
        : 'opacity-100 translate-y-0';
    
    return (
        <div
            onAnimationEnd={() => { if (isExiting) onDismiss(toast.id) }}
            className={`w-full max-w-sm rounded-lg shadow-lg pointer-events-auto border transform transition-all duration-300 ease-in-out ${typeClasses[toast.type]} ${animationClasses}`}
        >
            <div className="p-4 flex items-start">
                <div className="flex-shrink-0">{icons[toast.type]}</div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">{toast.message}</p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                    <button
                        onClick={handleDismiss}
                        className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-recife-red"
                    >
                        <span className="sr-only">Close</span>
                        <XCircleIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};


interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    const portalRoot = document.getElementById('toast-portal');
    if (!portalRoot) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 flex flex-col items-end px-4 py-6 pointer-events-none sm:p-6 z-50 space-y-4">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>,
        portalRoot
    );
};

export default ToastContainer;
