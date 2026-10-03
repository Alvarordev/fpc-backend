import { parseCorsOrigins } from './cors-origin';

describe('parseCorsOrigins', () => {
  it('accepts a single origin', () => {
    expect(parseCorsOrigins('http://localhost:5173')).toEqual([
      'http://localhost:5173',
    ]);
  });

  it('accepts localhost and 127.0.0.1 together', () => {
    expect(
      parseCorsOrigins('http://localhost:5173, http://127.0.0.1:5173'),
    ).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });

  it('rejects a wildcard origin', () => {
    expect(() => parseCorsOrigins('http://localhost:5173,*')).toThrow(
      'CORS_ORIGIN cannot include *',
    );
  });
});
