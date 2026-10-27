import { getCorsOrigins } from './cors.config';

describe('getCorsOrigins', () => {
  it('uses localhost when configuration is missing outside production', () => {
    expect(getCorsOrigins('development', undefined)).toEqual([
      'http://localhost:5173',
    ]);
  });

  it('requires CORS_ORIGIN in production', () => {
    expect(() => getCorsOrigins('production', undefined)).toThrow(
      /CORS_ORIGIN must be explicitly set in production/,
    );
  });

  it('rejects empty configuration in production', () => {
    expect(() => getCorsOrigins('production', '  ')).toThrow(
      /CORS_ORIGIN must be explicitly set in production/,
    );
  });

  it('accepts multiple explicit origins and trims whitespace', () => {
    expect(
      getCorsOrigins(
        'production',
        ' https://frontend.example.com, https://admin.example.com ',
      ),
    ).toEqual(['https://frontend.example.com', 'https://admin.example.com']);
  });

  it('rejects malformed origins', () => {
    expect(() => getCorsOrigins('production', 'not-a-url')).toThrow(
      /invalid origin/,
    );
  });

  it('rejects origins containing a path', () => {
    expect(() =>
      getCorsOrigins('production', 'https://frontend.example.com/app'),
    ).toThrow(/invalid origin/);
  });

  it('rejects wildcard origins when credentials are enabled', () => {
    expect(() => getCorsOrigins('production', '*')).toThrow(
      /wildcard origins are not allowed/,
    );
  });

  it('rejects wildcard patterns', () => {
    expect(() => getCorsOrigins('production', 'https://*.example.com')).toThrow(
      /wildcard origins are not allowed/,
    );
  });

  it('rejects empty entries in a comma-separated list', () => {
    expect(() =>
      getCorsOrigins(
        'production',
        'https://frontend.example.com, ,https://admin.example.com',
      ),
    ).toThrow(/empty origin/);
  });

  it('rejects duplicate origins', () => {
    expect(() =>
      getCorsOrigins(
        'production',
        'https://frontend.example.com,https://frontend.example.com',
      ),
    ).toThrow(/duplicate origins/);
  });
});
