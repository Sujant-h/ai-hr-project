import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './client';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function err(status: number, body: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'x',
    json: () => Promise.resolve(body),
  });
}

describe('uploadCv', () => {
  it('posts multipart, because /api/cv reads Form fields and not JSON', async () => {
    fetchMock.mockReturnValue(ok({ candidate: {}, audit: [], backend: 'regelbasiert' }));
    const file = new File(['Skills: Python'], 'cv.txt', { type: 'text/plain' });
    await apiClient.uploadCv({ name: 'Lena', index: 0, file });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/cv');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);

    const body = init.body as FormData;
    expect(body.get('name')).toBe('Lena');
    expect(body.get('index')).toBe('0');
    expect(body.get('file')).toBe(file);
  });

  it('never sets Content-Type, so the browser can set the multipart boundary', async () => {
    fetchMock.mockReturnValue(ok({ candidate: {}, audit: [], backend: 'regelbasiert' }));
    await apiClient.uploadCv({ name: 'L', index: 0, file: new File(['x'], 'cv.txt') });

    const headers = (fetchMock.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('content-type');
  });

  it('sends pasted text as a Form field', async () => {
    fetchMock.mockReturnValue(ok({ candidate: {}, audit: [], backend: 'regelbasiert' }));
    await apiClient.uploadCv({ name: 'Lena', index: 2, text: 'Skills: Python' });

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('text')).toBe('Skills: Python');
    expect(body.get('index')).toBe('2');
    expect(body.has('file')).toBe(false);
  });

  it('surfaces the German 413 message for an oversized upload', async () => {
    fetchMock.mockReturnValue(err(413, { detail: 'Datei zu groß (max. 10 MB).' }));
    await expect(
      apiClient.uploadCv({ name: 'X', index: 0, file: new File(['x'], 'big.txt') }),
    ).rejects.toMatchObject({ status: 413, message: 'Datei zu groß (max. 10 MB).' });
  });
});

describe('analyze', () => {
  it('posts requirements and candidates, not job_text and cvs', async () => {
    fetchMock.mockReturnValue(ok({ analyses: [], audit: [] }));
    await apiClient.analyze({ requirements: [], candidates: [], cached_backends: ['regelbasiert'] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/analysis');
    expect(JSON.parse(init.body as string)).toEqual({
      requirements: [],
      candidates: [],
      cached_backends: ['regelbasiert'],
    });
  });
});

describe('draftEmail', () => {
  it('posts to /api/email with candidate and questions', async () => {
    fetchMock.mockReturnValue(ok({ to: 'a@b.c', subject: 's', body: 'b' }));
    await apiClient.draftEmail({ candidate: { id: 'c0' } as never, questions: ['Warum?'] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/email');
    expect(JSON.parse(init.body as string).questions).toEqual(['Warum?']);
  });
});

describe('errors', () => {
  it('raises ApiError carrying the status for a rate limit', async () => {
    fetchMock.mockReturnValue(err(429, { detail: 'Rate limit exceeded' }));
    const e = await apiClient.getBackend().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(429);
  });

  it('translates a rate limit into German, because the raw slowapi text is English', async () => {
    fetchMock.mockReturnValue(err(429, { detail: 'Rate limit exceeded' }));
    const e = (await apiClient.getBackend().catch((x: unknown) => x)) as ApiError;
    expect(e.message).toMatch(/Zu viele Anfragen/);
  });

  it('survives an error body that is not JSON', async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: () => Promise.reject(new Error('not json')),
      }),
    );
    await expect(apiClient.getBackend()).rejects.toBeInstanceOf(ApiError);
  });

  it('stringifies a FastAPI 422 detail array rather than showing [object Object]', async () => {
    fetchMock.mockReturnValue(
      err(422, { detail: [{ loc: ['body', 'name'], msg: 'field required' }] }),
    );
    const e = (await apiClient.getBackend().catch((x: unknown) => x)) as ApiError;
    expect(e.message).toContain('field required');
  });
});
