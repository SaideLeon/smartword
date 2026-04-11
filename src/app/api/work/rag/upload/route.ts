import { NextResponse } from 'next/server';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase';
import { parseUploadedFile, chunkText } from '@/lib/work/rag-parser';
import { storeDocumentChunks } from '@/lib/work/rag-service';

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth();
  if (authError || !user) return authError;

  const planError = await requireFeatureAccess(user.id, 'create_work');
  if (planError) return planError;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;
    const sourceType = (formData.get('sourceType') as string) ?? 'reference';

    if (!file || !sessionId) {
      return NextResponse.json({ error: 'file e sessionId obrigatórios' }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx 10MB)' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseUploadedFile(buffer, file.name);
    const chunks = chunkText(parsed.text);

    const supabase = await createClient();
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

    await storeDocumentChunks(
      sessionId,
      user.id,
      source.id,
      chunks,
      { filename: file.name, source_type: sourceType },
    );

    if (sourceType === 'institution_rules') {
      await supabase
        .from('work_sessions')
        .update({ institution_rules: parsed.text.slice(0, 8000) })
        .eq('id', sessionId)
        .eq('user_id', user.id);
    }

    await supabase
      .from('work_sessions')
      .update({ rag_enabled: true })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    return NextResponse.json({
      ok: true,
      sourceId: source.id,
      chunksStored: chunks.length,
      filename: file.name,
    });
  } catch (err: any) {
    console.error('[rag/upload]', err);
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 });
  }
}
