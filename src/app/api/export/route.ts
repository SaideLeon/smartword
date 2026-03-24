import { NextResponse } from 'next/server';
import { generateDocx } from '@/lib/docx';

export async function POST(req: Request) {
  try {
    const { content, filename = 'document' } = await req.json();
    
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const buffer = await generateDocx(content);
    
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      }
    });
  } catch (error: any) {
    console.error('Error generating DOCX:', error.stack || error);
    return NextResponse.json({ error: error.message || 'Failed to generate DOCX', stack: error.stack }, { status: 500 });
  }
}
