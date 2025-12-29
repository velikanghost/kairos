import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly secretKey: Buffer;

  constructor(private configService: ConfigService) {
    const secretKeyHex = this.configService.get<string>('encryption.secretKey');

    if (!secretKeyHex) {
      throw new Error('ENCRYPTION_SECRET_KEY is not configured');
    }

    // Convert hex string to Buffer (32 bytes for AES-256)
    this.secretKey = Buffer.from(secretKeyHex, 'hex');

    if (this.secretKey.length !== 32) {
      throw new Error('ENCRYPTION_SECRET_KEY must be 32 bytes (64 hex characters)');
    }

    this.logger.log('✅ Encryption service initialized');
  }

  /**
   * Encrypt a private key using AES-256-GCM
   * Returns a JSON string containing the encrypted data, IV, and auth tag
   */
  encrypt(privateKey: string): string {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);

      // Encrypt the private key
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Return all components as a JSON string
      return JSON.stringify({
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      });
    } catch (error) {
      this.logger.error('Encryption failed:', error.message);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt a private key using AES-256-GCM
   * Takes a JSON string containing encrypted data, IV, and auth tag
   */
  decrypt(encryptedData: string): string {
    try {
      // Parse the encrypted data
      const { encrypted, iv, authTag } = JSON.parse(encryptedData);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.secretKey,
        Buffer.from(iv, 'hex'),
      );

      // Set the authentication tag
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      // Decrypt the private key
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error.message);
      throw new Error('Failed to decrypt private key');
    }
  }
}
