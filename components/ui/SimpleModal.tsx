import React, { ReactNode } from 'react';
import { XCircleIcon } from './icons/Icons';

interface SimpleModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer: ReactNode;
}

const SimpleModal: React.FC<SimpleModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50"
            aria-modal="true"
            role="dialog"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    aria-label="Close"
                >
                    <XCircleIcon className="h-8 w-8" />
                </button>
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
                    <div className="flex-grow space-y-4">
                        {children}
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                        {footer}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SimpleModal;
