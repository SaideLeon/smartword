'use client';

import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, FileText, SkipForward, Upload } from 'lucide-react';

interface UploadedFile {
  name: string;
  chunks: number;
  type: 'reference' | 'institution_rules';
}

interface Props {
  sessionId: string;
  onUpload: (file: File, sessionId: string, type: 'reference' | 'institution_rules') => Promise<any>;
  onConfirm: () => void;
  onSkip: () => void;
  uploading: boolean;
}

export function ResourceUploadStep({ sessionId, onUpload, onConfirm, onSkip, uploading }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [activeType, setActiveType] = useState<'reference' | 'institution_rules'>('reference');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    for (const file of selected) {
      const result = await onUpload(file, sessionId, activeType);
      if (result?.ok) setFiles(prev => [...prev, { name: file.name, chunks: result.chunksStored, type: activeType }]);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-6 p-3">
      <div>
        <h2 className="text-xl font-semibold mb-1">Adicionar Recursos de Referência</h2>
        <p className="text-sm text-muted-foreground">Opcional. A IA usará estes documentos como base real.</p>
      </div>

      <div className="flex gap-2">
        {(['reference', 'institution_rules'] as const).map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${activeType === type ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}
          >
            {type === 'reference' ? <><BookOpen size={14} /> Referências</> : <><FileText size={14} /> Normas da Instituição</>}
          </button>
        ))}
      </div>

      <div onClick={() => inputRef.current?.click()} className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 transition-colors">
        <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Clica para seleccionar ficheiros</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX ou TXT — máx. 10MB</p>
        <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt,.md" onChange={handleFileChange} className="hidden" disabled={uploading} />
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
              <FileText size={14} className="text-primary shrink-0" />
              <span className="flex-1 truncate font-medium">{f.name}</span>
              <span className="text-xs text-muted-foreground">{f.chunks} chunks</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 justify-end mt-2">
        <button onClick={onSkip} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          <SkipForward size={14} /> Saltar
        </button>
        <button onClick={onConfirm} disabled={uploading} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
          Continuar <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
