import { base64ByteLength, base64ToBytes, bytesToBase64, sniffImageMime } from './base64';

describe('base64 helpers', () => {
  it('round-trips every byte value, including large inputs', () => {
    const bytes = new Uint8Array(100_003).map((_, i) => i % 256);
    const text = bytesToBase64(bytes);
    expect(base64ToBytes(text)).toEqual(bytes);
    expect(base64ByteLength(text)).toBe(bytes.length);
  });
  it('knows the decoded length for each padding', () => {
    for (const n of [0, 1, 2, 3, 4, 5]) {
      expect(base64ByteLength(bytesToBase64(new Uint8Array(n)))).toBe(n);
    }
  });
  it('sniffs png, jpeg and webp', () => {
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0]))).toBe('image/png');
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageMime(webp)).toBe('image/webp');
    expect(sniffImageMime(new Uint8Array([1, 2, 3]))).toBe('application/octet-stream');
  });
});
