export async function readApiErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return fallbackMessage;
  }

  const body = await response.json().catch(() => ({})) as { error?: unknown };
  return typeof body.error === 'string' && body.error.trim()
    ? body.error
    : fallbackMessage;
}

