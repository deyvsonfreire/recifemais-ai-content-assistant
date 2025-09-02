import React, { useState, FC } from 'react';
import { GoogleEvent, InitialAgendaData, InitialHistoriaData, InitialOrganizadorData, InitialPostData } from '../../types';

interface CptHostProps {
    postType: string;
    postTypeName: string;
    ListComponent: FC<any>;
    EditorComponent: FC<any>;
    initialCreateData?: any;
    onCreationFromEvent?: (event: GoogleEvent) => void;
}

const CptHost: React.FC<CptHostProps> = ({ 
    postType, 
    postTypeName, 
    ListComponent, 
    EditorComponent,
    initialCreateData,
}) => {
    const [view, setView] = useState<'list' | 'edit' | 'create'>(initialCreateData ? 'create' : 'list');
    const [currentId, setCurrentId] = useState<number | null>(null);
    
    // This state is used to pass data from another page (like AI generator) to the editor
    const [initialData, setInitialData] = useState<InitialPostData | InitialAgendaData | InitialHistoriaData | InitialOrganizadorData | null>(initialCreateData || null);

    const handleCreate = () => {
        setCurrentId(null);
        setInitialData(null);
        setView('create');
    };

    const handleEdit = (id: number) => {
        setCurrentId(id);
        setInitialData(null);
        setView('edit');
    };

    const handleBackToList = () => {
        setCurrentId(null);
        setInitialData(null);
        setView('list');
    };

    switch (view) {
        case 'create':
            return <EditorComponent onSave={handleBackToList} onCancel={handleBackToList} initialData={initialData} />;
        case 'edit':
            return <EditorComponent postId={currentId!} onSave={handleBackToList} onCancel={handleBackToList} />;
        case 'list':
        default:
            return <ListComponent postType={postType} postTypeName={postTypeName} onCreate={handleCreate} onEdit={handleEdit} />;
    }
};

export default CptHost;
