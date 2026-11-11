export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch('/api' + path, {
    method,
    headers: {
      'X-Margin-Client': '1',
      ...(!form && body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const value = await response.json();
      message = value.error || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}
export function upload(path: string, file: File) {
  const data = new FormData();
  data.append('file', file);
  return api(path, 'POST', data);
}
