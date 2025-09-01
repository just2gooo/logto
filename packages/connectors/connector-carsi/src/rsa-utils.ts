import { ConnectorError, ConnectorErrorCodes } from '@logto/connector-kit';
// Note: node-rsa doesn't have proper TypeScript definitions, so we disable type checking
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
// eslint-disable-next-line import/no-extraneous-dependencies
import NodeRSA from 'node-rsa';

console.info('Calling node-rsa');

export const decryptBase64RSA = (encryptedBase64: string, privateKey: string): string => {
  try {
    const key = new NodeRSA(privateKey);

    key.setOptions({ encryptionScheme: 'pkcs1', environment: 'browser' });

    const decrypted = key.decrypt(Buffer.from(encryptedBase64, 'base64'), 'utf8');
    if (typeof decrypted !== 'string') {
      throw new TypeError('Failed to decrypt string');
    }
    return decrypted;
  } catch (error: unknown) {
    console.error('decryptBase64RSA error:', error);
    throw new ConnectorError(ConnectorErrorCodes.General, 'Failed to decrypt data');
  }
};
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
