import { createHash } from 'crypto';

export class CryptoUtils {
  static computeSHA256(data: Buffer | string): string {
    const hash = createHash('sha256');
    if (Buffer.isBuffer(data)) {
      hash.update(data);
    } else {
      hash.update(data, 'utf8');
    }
    return hash.digest('hex');
  }

  static computeFileHash(fileBuffer: Buffer): string {
    return this.computeSHA256(fileBuffer);
  }

  static isValidSHA256Hash(hash: string): boolean {
    return /^[a-f0-9]{64}$/i.test(hash);
  }
}
