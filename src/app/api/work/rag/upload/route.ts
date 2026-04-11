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

  const planError = await requireFeatureAccess(user.id, 'create_work');
  if (planError) return planError;

  const formData = await req.formData();
  const sessionId = formData.get('sessionId') as string | null;
  const sourceType = (formData.get('sourceType') as string) ?? 'reference';

  if (!sessionId) {
    return Response.json({ error: 'sessionId obrigatório' }, { status: 400 });
  }

  const rawFiles = [
    ...formData.getAll('file'),
    ...formData.getAll('files[]'),
  ].filter((v): v is File => v instanceof File);

  if (rawFiles.length === 0) {
    return Response.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 });
  }

  const totalSize = rawFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL) {
    return Response.json(
      {
        error: `Total dos ficheiros excede 50 MB (${(totalSize / 1024 / 1024).toFixed(1)} MB enviados)`,
      },
      { status: 413 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const supabase = await createClient();
        const results: Array<{
          ok: boolean;
          filename: string;
          sourceId?: string;
          chunksStored?: number;
          error?: string;
        }> = [];

        for (const file of rawFiles) {
          if (file.size > MAX_PER_FILE) {
            const r = { ok: false, filename: file.name, error: 'Ficheiro excede 10 MB' };
            results.push(r);
            emit({ type: 'file_error', ...r });
            continue;
          }

          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            if (!isAcceptedFile(file)) {
              const r = { ok: false, filename: file.name, error: `Tipo não suportado: ${file.type || 'desconhecido'}` };
              results.push(r);
              emit({ type: 'file_error', ...r });
              continue;
            }

            emit({ type: 'parsing', filename: file.name });
            const parsed = await parseUploadedFile(buffer, file.name);
            const totalChunks = parsed.textChunks?.length ?? parsed.binaryChunks?.length ?? 0;
            emit({ type: 'file_start', filename: file.name, totalChunks });

            const { data: source, error: srcErr } = await supabase
              .from('work_rag_sources')
              .insert({
                session_id: sessionId,
                user_id: user.id,
                filename: file.name,
                file_type: parsed.fileType,
                source_type: sourceType,
                char_count: parsed.charCount,
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
              (index, total) => emit({ type: 'chunk', filename: file.name, index, total }),
            );

            if (sourceType === 'institution_rules' && parsed.type === 'text' && parsed.textChunks?.length) {
              await supabase
                .from('work_sessions')
                .update({ institution_rules: parsed.textChunks.join('\n\n').slice(0, 8000) })
                .eq('id', sessionId)
                .eq('user_id', user.id);
            }

            const r = {
              ok: true,
              sourceId: source.id,
              chunksStored: totalChunks,
              filename: file.name,
            };
            results.push(r);
            emit({ type: 'file_done', ...r });
          } catch (err: any) {
            const r = { ok: false, filename: file.name, error: err.message ?? 'Erro interno' };
            results.push(r);
            emit({ type: 'file_error', ...r });
          }
        }

        if (results.some(r => r.ok)) {
          await supabase
            .from('work_sessions')
            .update({ rag_enabled: true })
            .eq('id', sessionId)
            .eq('user_id', user.id);
        }

        emit({ type: 'done', results });
      } catch (err: any) {
        console.error('[rag/upload]', err);
        emit({ type: 'fatal_error', error: err.message ?? 'Erro interno' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
