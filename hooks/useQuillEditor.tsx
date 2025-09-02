import { useEffect, useRef, useCallback } from 'react';

declare var Quill: any;

const QUILL_TOOLBAR_OPTIONS = [
    [{ 'header': [2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['link', 'image', 'video'],
    ['clean']
];

/**
 * A custom hook to manage a Quill editor instance.
 * It encapsulates initialization, content setting, and event handling.
 * @param placeholder - The placeholder text for the editor.
 * @returns An object with a ref for the editor element, and functions to initialize and set content.
 */
export const useQuillEditor = (placeholder: string) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<any>(null);

    /**
     * Initializes the Quill instance on the editor element and sets up the text-change handler.
     * Should be called from a useEffect in the component.
     */
    const initializeQuill = useCallback((onTextChange: (html: string) => void) => {
        if (editorRef.current && !quillRef.current) {
            try {
                const quill = new Quill(editorRef.current, {
                    theme: 'snow',
                    modules: {
                        toolbar: QUILL_TOOLBAR_OPTIONS
                    },
                    placeholder,
                });

                quill.on('text-change', (delta: any, oldDelta: any, source: string) => {
                    // Only update state if the change came from the user
                    if (source === 'user') {
                        const html = quill.root.innerHTML;
                        // When clearing the editor, Quill leaves an empty paragraph tag.
                        // We treat this as an empty string for consistency.
                        if (html === '<p><br></p>') {
                            onTextChange('');
                        } else {
                            onTextChange(html);
                        }
                    }
                });

                quillRef.current = quill;
            } catch (error) {
                console.error('Erro ao inicializar Quill:', error);
            }
        }
    }, [placeholder]);

    /**
     * Sets the content of the Quill editor programmatically.
     * Uses dangerouslyPasteHTML to ensure Quill's model remains consistent.
     */
    const setContent = useCallback((htmlContent: string) => {
        const quill = quillRef.current;
        // Ensure Quill is initialized
        if (quill) {
            if (htmlContent) {
                // Set the content using dangerouslyPasteHTML
                quill.clipboard.dangerouslyPasteHTML(0, htmlContent);
            } else {
                // Clear the editor if no content is provided
                quill.setText('');
            }
        }
    }, []);

    // Effect for cleaning up the Quill instance to prevent memory leaks.
    useEffect(() => {
        return () => {
            if (quillRef.current) {
                // Potentially clear instance on unmount, though refs usually handle this well.
                // For now, leaving it simple as full component unmounts are expected.
            }
        };
    }, []);

    return { editorRef, initializeQuill, setContent };
};
