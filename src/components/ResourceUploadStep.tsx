'use client';

import { useCallback, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, FileText, Loader2, SkipForward, Upload, XCircle } from 'lucide-react';

type SourceType = 'reference' | 'institution_rules';

interface FileStatus {
  name:   string;
  size:   number;
  state:  'pending' | 'uploading' | 'done' | 'error';
  chunks?: number;
  error?:  string;
  type:    SourceType;
}

interface Props {
  sessionId:    string;
  /** Envia múltiplos ficheiros de uma vez e devolve array de resultados */
  onUploadMany: (
    files:      File[],
    sessionId:  string,
    type:       SourceType,
  ) => Promise<Array<{ ok: boolean; filename: string; chunksStored?: number; error?: string }>>;
  onConfirm: () => void;
  onSkip:    () => void;
  uploading: boolean;
}

const MAX_TOTAL_MB = 50;
const MAX_TOTAL    = MAX_TOTAL_MB * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ResourceUploadStep({ sessionId, onUploadMany, onConfirm, onSkip, uploading }: Props) {
  const [fileStatuses, setFileStatuses]   = useState<FileStatus[]>([]);
  const [activeType, setActiveType]       = useState<SourceType>('reference');
  const [globalError, setGlobalError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = fileStatuses.reduce((sum, f) => sum + f.size, 0);
  const isUploading = fileStatuses.some(f => f.state === 'uploading');
  const hasUploaded = fileStatuses.some(f => f.state === 'done');

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (selected.length === 0) return;

    setGlobalError(null);

    // Validar total acumulado
    const newTotal = totalBytes + selected.reduce((s, f) => s + f.size, 0);
    if (newTotal > MAX_TOTAL) {
      setGlobalError(
        `Limite de ${MAX_TOTAL_MB} MB excedido. Tens ${formatSize(totalBytes)} já carregados e estás a tentar adicionar mais ${formatSize(selected.reduce((s, f) => s + f.size, 0))}.`,
      );
      return;
    }

    // Registar ficheiros como "a aguardar"
    const initial: FileStatus[] = selected.map(f => ({
      name:  f.name,
      size:  f.size,
      state: 'pending',
      type:  activeType,
    }));
    setFileStatuses(prev => [...prev, ...initial]);

    // Marcar como "a enviar"
    setFileStatuses(prev =>
      prev.map(fs =>
        initial.some(i => i.name === fs.name && fs.state === 'pending')
          ? { ...fs, state: 'uploading' }
          : fs,
      ),
    );

    try {
      const results = await onUploadMany(selected, sessionId, activeType);

      setFileStatuses(prev =>
        prev.map(fs => {
          const result = results.find(r => r.filename === fs.name);
          if (!result) return fs;
          return result.ok
            ? { ...fs, state: 'done',  chunks: result.chunksStored }
            : { ...fs, state: 'error', error: result.error };
        }),
      );
    } catch (err: any) {
      setGlobalError(err.message ?? 'Erro ao enviar ficheiros');
      setFileStatuses(prev =>
        prev.map(fs =>
          initial.some(i => i.name === fs.name)
            ? { ...fs, state: 'error', error: 'Falhou' }
            : fs,
        ),
      );
    }
  }, [activeType, onUploadMany, sessionId, totalBytes]);

  const removeFile = (name: string) =>
    setFileStatuses(prev => prev.filter(f => f.name !== name));

  return (
    <div className="flex flex-col gap-6 p-3">
      <div>
        <h2 className="text-xl font-semibold mb-1">Adicionar Recursos de Referência</h2>
        <p className="text-sm text-muted-foreground">
          Opcional. A IA usará estes documentos como base real.
          Podes seleccionar múltiplos ficheiros de uma vez (máx. {MAX_TOTAL_MB} MB no total).
        </p>
      </div>

      {/* Selector de tipo */}
      <div className="flex gap-2">
        {(['reference', 'institution_rules'] as const).map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
              activeType === type
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {type === 'reference'
              ? <><BookOpen size={14} /> Referências</>
              : <><FileText size={14} /> Normas da Instituição</>}
          </button>
        ))}
      </div>

      {/* Zona de drop / clique */}
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isUploading
            ? 'border-border opacity-60 cursor-not-allowed'
            : 'border-border hover:border-primary/60 cursor-pointer'
        }`}
      >
        <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">
          {isUploading ? 'A processar…' : 'Clica para seleccionar ficheiros'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOCX ou TXT — até {MAX_TOTAL_MB} MB no total
        </p>
        {totalBytes > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Usado: {formatSize(totalBytes)} / {MAX_TOTAL_MB} MB
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading || uploading}
        />
      </div>

      {/* Erro global */}
      {globalError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
          {globalError}
        </p>
      )}

      {/* Lista de ficheiros */}
      {fileStatuses.length > 0 && (
        <div className="flex flex-col gap-2">
          {fileStatuses.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm"
            >
              {f.state === 'uploading' && <Loader2 size={14} className="text-primary shrink-0 animate-spin" />}
              {f.state === 'done'      && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
              {f.state === 'error'     && <XCircle size={14} className="text-destructive shrink-0" />}
              {f.state === 'pending'   && <FileText size={14} className="text-muted-foreground shrink-0" />}

              <span className="flex-1 truncate font-medium">{f.name}</span>

              {f.state === 'done'  && <span className="text-xs text-muted-foreground">{f.chunks} chunks</span>}
              {f.state === 'error' && <span className="text-xs text-destructive">{f.error}</span>}
              {f.state !== 'uploading' && (
                <button
                  onClick={() => removeFile(f.name)}
                  className="text-muted-foreground hover:text-foreground ml-1"
                  aria-label="Remover"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Acções */}
      <div className="flex gap-3 justify-end mt-2">
        <button
          onClick={onSkip}
          className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <SkipForward size={14} /> Saltar
        </button>
        <button
          onClick={onConfirm}
          disabled={isUploading || uploading}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {hasUploaded ? <>Continuar <ArrowRight size={14} /></> : <>Saltar <SkipForward size={14} /></>}
        </button>
      </div>
    </div>
  );
}
