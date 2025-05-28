const ber = require('../../../asn1').Ber;
const { _ } = require('../utils');
const utils = require('../utils');

const PRIVATE_OPENING_BOUNDARY = '-----BEGIN RSA PRIVATE KEY-----';
const PRIVATE_CLOSING_BOUNDARY = '-----END RSA PRIVATE KEY-----';

const PUBLIC_OPENING_BOUNDARY = '-----BEGIN RSA PUBLIC KEY-----';
const PUBLIC_CLOSING_BOUNDARY = '-----END RSA PUBLIC KEY-----';

module.exports = {
  privateExport(key, options) {
    options ||= {};

    const n = key.n.toBuffer();
    const d = key.d.toBuffer();
    const p = key.p.toBuffer();
    const q = key.q.toBuffer();
    const dmp1 = key.dmp1.toBuffer();
    const dmq1 = key.dmq1.toBuffer();
    const coeff = key.coeff.toBuffer();

    const length =
      n.length + d.length + p.length + q.length + dmp1.length + dmq1.length + coeff.length + 512; // Magic
    const writer = new ber.Writer({ size: length });

    writer.startSequence();
    writer.writeInt(0);
    writer.writeBuffer(n, 2);
    writer.writeInt(key.e);
    writer.writeBuffer(d, 2);
    writer.writeBuffer(p, 2);
    writer.writeBuffer(q, 2);
    writer.writeBuffer(dmp1, 2);
    writer.writeBuffer(dmq1, 2);
    writer.writeBuffer(coeff, 2);
    writer.endSequence();

    if (options.type === 'der') {
      return writer.buffer;
    }
    return (
      PRIVATE_OPENING_BOUNDARY +
      '\n' +
      utils.linebrk(writer.buffer.toString('base64'), 64) +
      '\n' +
      PRIVATE_CLOSING_BOUNDARY
    );
  },

  privateImport(key, data, options) {
    options ||= {};
    let buffer;

    if (options.type !== 'der') {
      if (Buffer.isBuffer(data)) {
        data = data.toString('utf8');
      }

      if (_.isString(data)) {
        const pem = utils
          .trimSurroundingText(data, PRIVATE_OPENING_BOUNDARY, PRIVATE_CLOSING_BOUNDARY)
          .replaceAll(/\s+|\n\r|\n|\r$/gm, '');
        buffer = Buffer.from(pem, 'base64');
      } else {
        throw new TypeError('Unsupported key format');
      }
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      throw new TypeError('Unsupported key format');
    }

    const reader = new ber.Reader(buffer);
    reader.readSequence();
    reader.readString(2, true); // Just zero
    key.setPrivate(
      reader.readString(2, true), // Modulus
      reader.readString(2, true), // PublicExponent
      reader.readString(2, true), // PrivateExponent
      reader.readString(2, true), // Prime1
      reader.readString(2, true), // Prime2
      reader.readString(2, true), // Exponent1 -- d mod (p1)
      reader.readString(2, true), // Exponent2 -- d mod (q-1)
      reader.readString(2, true) // Coefficient -- (inverse of q) mod p
    );
  },

  publicExport(key, options) {
    options ||= {};

    const n = key.n.toBuffer();
    const length = n.length + 512; // Magic

    const bodyWriter = new ber.Writer({ size: length });
    bodyWriter.startSequence();
    bodyWriter.writeBuffer(n, 2);
    bodyWriter.writeInt(key.e);
    bodyWriter.endSequence();

    if (options.type === 'der') {
      return bodyWriter.buffer;
    }
    return (
      PUBLIC_OPENING_BOUNDARY +
      '\n' +
      utils.linebrk(bodyWriter.buffer.toString('base64'), 64) +
      '\n' +
      PUBLIC_CLOSING_BOUNDARY
    );
  },

  publicImport(key, data, options) {
    options ||= {};
    let buffer;

    if (options.type !== 'der') {
      if (Buffer.isBuffer(data)) {
        data = data.toString('utf8');
      }

      if (_.isString(data)) {
        const pem = utils
          .trimSurroundingText(data, PUBLIC_OPENING_BOUNDARY, PUBLIC_CLOSING_BOUNDARY)
          .replaceAll(/\s+|\n\r|\n|\r$/gm, '');
        buffer = Buffer.from(pem, 'base64');
      }
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      throw new TypeError('Unsupported key format');
    }

    const body = new ber.Reader(buffer);
    body.readSequence();
    key.setPublic(
      body.readString(0x02, true), // Modulus
      body.readString(0x02, true) // PublicExponent
    );
  },

  /**
   * Trying autodetect and import key
   * @param key
   * @param data
   */
  autoImport(key, data) {
    // [\S\s]* matches zero or more of any character
    if (
      /^[\S\s]*-{5}BEGIN RSA PRIVATE KEY-{5}\s*(?=(([\d+/=A-Za-z]+\s*)+))\1-{5}END RSA PRIVATE KEY-{5}[\S\s]*$/g.test(
        data
      )
    ) {
      module.exports.privateImport(key, data);
      return true;
    }

    if (
      /^[\S\s]*-{5}BEGIN RSA PUBLIC KEY-{5}\s*(?=(([\d+/=A-Za-z]+\s*)+))\1-{5}END RSA PUBLIC KEY-{5}[\S\s]*$/g.test(
        data
      )
    ) {
      module.exports.publicImport(key, data);
      return true;
    }

    return false;
  },
};
