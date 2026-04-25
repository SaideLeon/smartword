import { NextResponse } from 'next/server';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase';
import { parseUploadedFile } from '@/lib/work/rag-parser';
import { storeDocumentSource } from '@/lib/work/rag-service';

const MAX_PER_FILE = 10 * 1024 * 1024;   // 10 MB por ficheiro
const MAX_TOTAL    = 50 * 1024 * 1024;   // 50 MB total por pedido


const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
]);

function isAcceptedFile(file: File): boolean {
  if (file.type && ACCEPTED_TYPES.has(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['pdf', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'mp3', 'wav'].includes(ext);
}


export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth();
  if (authError || !user) return authError;

  const planError = await requireFeatureAccess(user.id, 'create_work', req);
  if (planError) return planError;

  try {
    const formData = await req.formData();
    const sessionId  = formData.get('sessionId') as string | null;
    const sourceType = (formData.get('sourceType') as string) ?? 'reference';

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId obrigatório' }, { status: 400 });
    }

    // Recolher todos os ficheiros enviados (campo 'file' ou 'files[]')
    const rawFiles = [
      ...formData.getAll('file'),
      ...formData.getAll('files[]'),
    ].filter((v): v is File => v instanceof File);

    if (rawFiles.length === 0) {
      return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 });
    }

    // Validar tamanho total (50 MB)
    const totalSize = rawFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL) {
      return NextResponse.json(
        {
          error: `Total dos ficheiros excede 50 MB (${(totalSize / 1024 / 1024).toFixed(1)} MB enviados)`,
        },
        { status: 413 },
      );
    }

    const supabase = await createClient();

    // Processar todos em paralelo
    const results = await Promise.all(
      rawFiles.map(async (file) => {
        if (file.size > MAX_PER_FILE) {
          return { ok: false, filename: file.name, error: 'Ficheiro excede 10 MB' };
        }

        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          if (!isAcceptedFile(file)) {
            return { ok: false, filename: file.name, error: `Tipo não suportado: ${file.type || 'desconhecido'}` };
          }

          const parsed = await parseUploadedFile(buffer, file.name);

          const { data: source, error: srcErr } = await supabase
            .from('work_rag_sources')
            .insert({
              session_id:  sessionId,
              user_id:     user.id,
              filename:    file.name,
              file_type:   parsed.fileType,
              source_type: sourceType,
              char_count:  parsed.charCount,
            })
            .select('id')
            .single();

          if (srcErr || !source) throw new Error(srcErr?.message ?? 'Erro ao criar fonte RAG');

          await storeDocumentSource(
            sessionId,
            user.id,
            source.id,
            parsed,
            { filename: file.name, source_type: sourceType as 'reference' | 'institution_rules' },
          );

          if (sourceType === 'institution_rules' && parsed.type === 'text' && parsed.textChunks?.length) {
            await supabase
              .from('work_sessions')
              .update({ institution_rules: parsed.textChunks.join('\n\n').slice(0, 8000) })
              .eq('id', sessionId)
              .eq('user_id', user.id);
          }

          return {
            ok: true,
            sourceId: source.id,
            chunksStored: parsed.textChunks?.length ?? parsed.binaryChunks?.length ?? 0,
            filename: file.name,
          };
        } catch (err: any) {
          return { ok: false, filename: file.name, error: err.message ?? 'Erro interno' };
        }
      }),
    );

    // Activar RAG se pelo menos um ficheiro foi guardado
    if (results.some(r => r.ok)) {
      await supabase
        .from('work_sessions')
        .update({ rag_enabled: true })
        .eq('id', sessionId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('[rag/upload]', err);
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 });
  }
}
