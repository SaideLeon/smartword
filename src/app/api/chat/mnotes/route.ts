import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/mnotes/ai/ai-service';

export async function POST(req: NextRequest) {
  try {
    const { parts } = await req.json();
    const responseText = await AIService.generateContent(parts);
    return new NextResponse(responseText);
  } catch (error: unknown) {
    console.error('Chat API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return new NextResponse(message, { status: 500 });
  }
}
