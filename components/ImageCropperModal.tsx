import React, { useEffect, useRef } from 'react';
import { XCircleIcon } from './icons/Icons';
import LoadingSpinner from './LoadingSpinner';

declare var Cropper: any;

interface ImageCropperModalProps {
    imageSrc: string;
    onClose: () => void;
    onCropComplete: (blob: Blob) => void;
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ imageSrc, onClose, onCropComplete }) => {
    const imageRef = useRef<HTMLImageElement>(null);
    const cropperRef = useRef<any>(null);
    const [isCropping, setIsCropping] = React.useState(false);

    useEffect(() => {
        if (imageRef.current) {
            cropperRef.current = new Cropper(imageRef.current, {
                aspectRatio: 900 / 600,
                viewMode: 1,
                dragMode: 'move',
                background: false,
                autoCropArea: 0.9,
            });
        }

        return () => {
            if (cropperRef.current) {
                cropperRef.current.destroy();
            }
        };
    }, [imageSrc]);

    const handleCrop = () => {
        if (cropperRef.current) {
            setIsCropping(true);
            const canvas = cropperRef.current.getCroppedCanvas({
                width: 900,
                height: 600,
                imageSmoothingQuality: 'high',
            });
            canvas.toBlob((blob: Blob) => {
                if (blob) {
                   onCropComplete(blob);
                }
                setIsCropping(false);
            }, 'image/webp', 0.85); // Convert to WebP with 85% quality
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50"
            aria-modal="true"
            role="dialog"
        >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 relative">
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    aria-label="Close"
                >
                    <XCircleIcon className="h-8 w-8" />
                </button>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Cortar Imagem</h2>
                <p className="text-gray-600 mb-4">Ajuste a imagem para o formato 900x600 pixels.</p>
                <div className="max-h-[60vh] bg-gray-100">
                    <img ref={imageRef} src={imageSrc} style={{ maxWidth: '100%' }} alt="Source for cropping" />
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCrop}
                        disabled={isCropping}
                        className="flex justify-center items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-recife-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-recife-red disabled:bg-gray-400"
                    >
                         {isCropping ? <><LoadingSpinner /> Processando...</> : 'Cortar e Usar Imagem'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageCropperModal;