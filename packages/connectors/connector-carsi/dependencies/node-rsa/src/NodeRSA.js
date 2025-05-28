/*!
 * RSA library for Node.js
 *
 * Author: rzcoder
 * License MIT
 */

const constants = require('node:constants');
const crypt = require('node:crypto');

const rsa = require('./libs/rsa.js');

const ber = require('../../asn1').Ber;

const schemes = require('./schemes/schemes.js');
const { _ } = require('./utils');
const utils = require('./utils');
const formats = require('./formats/formats.js');

if (constants.RSA_NO_PADDING === undefined) {
  // Patch for node v0.10.x, constants do not defined
  constants.RSA_NO_PADDING = 3;
}

module.exports = (function () {
  const SUPPORTED_HASH_ALGORITHMS = {
    node10: ['md4', 'md5', 'ripemd160', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'],
    node: ['md4', 'md5', 'ripemd160', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'],
    iojs: ['md4', 'md5', 'ripemd160', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'],
    browser: ['md5', 'ripemd160', 'sha1', 'sha256', 'sha512'],
  };

  const DEFAULT_ENCRYPTION_SCHEME = 'pkcs1_oaep';
  const DEFAULT_SIGNING_SCHEME = 'pkcs1';

  const DEFAULT_EXPORT_FORMAT = 'private';
  const EXPORT_FORMAT_ALIASES = {
    private: 'pkcs1-private-pem',
    'private-der': 'pkcs1-private-der',
    public: 'pkcs8-public-pem',
    'public-der': 'pkcs8-public-der',
  };

  /**
   * @param key {string|buffer|object} Key in PEM format, or data for generate key {b: bits, e: exponent}
   * @constructor
   */
  function NodeRSA(key, format, options) {
    if (!(this instanceof NodeRSA)) {
      return new NodeRSA(key, format, options);
    }

    if (_.isObject(format)) {
      options = format;
      format = undefined;
    }

    this.$options = {
      signingScheme: DEFAULT_SIGNING_SCHEME,
      signingSchemeOptions: {
        hash: 'sha256',
        saltLength: null,
      },
      encryptionScheme: DEFAULT_ENCRYPTION_SCHEME,
      encryptionSchemeOptions: {
        hash: 'sha1',
        label: null,
      },
      environment: utils.detectEnvironment(),
      rsaUtils: this,
    };
    this.keyPair = new rsa.Key();
    this.$cache = {};

    if (Buffer.isBuffer(key) || _.isString(key)) {
      this.importKey(key, format);
    } else if (_.isObject(key)) {
      this.generateKeyPair(key.b, key.e);
    }

    this.setOptions(options);
  }

  /**
   * Set and validate options for key instance
   * @param options
   */
  NodeRSA.prototype.setOptions = function (options) {
    options ||= {};
    if (options.environment) {
      this.$options.environment = options.environment;
    }

    if (options.signingScheme) {
      if (_.isString(options.signingScheme)) {
        const signingScheme = options.signingScheme.toLowerCase().split('-');
        if (signingScheme.length == 1) {
          if (SUPPORTED_HASH_ALGORITHMS.node.includes(signingScheme[0])) {
            this.$options.signingSchemeOptions = {
              hash: signingScheme[0],
            };
            this.$options.signingScheme = DEFAULT_SIGNING_SCHEME;
          } else {
            this.$options.signingScheme = signingScheme[0];
            this.$options.signingSchemeOptions = {
              hash: null,
            };
          }
        } else {
          this.$options.signingSchemeOptions = {
            hash: signingScheme[1],
          };
          this.$options.signingScheme = signingScheme[0];
        }
      } else if (_.isObject(options.signingScheme)) {
        this.$options.signingScheme = options.signingScheme.scheme || DEFAULT_SIGNING_SCHEME;
        this.$options.signingSchemeOptions = _.omit(options.signingScheme, 'scheme');
      }

      if (!schemes.isSignature(this.$options.signingScheme)) {
        throw new Error('Unsupported signing scheme');
      }

      if (
        this.$options.signingSchemeOptions.hash &&
        !SUPPORTED_HASH_ALGORITHMS[this.$options.environment].includes(
          this.$options.signingSchemeOptions.hash
        )
      ) {
        throw new Error(
          'Unsupported hashing algorithm for ' + this.$options.environment + ' environment'
        );
      }
    }

    if (options.encryptionScheme) {
      if (_.isString(options.encryptionScheme)) {
        this.$options.encryptionScheme = options.encryptionScheme.toLowerCase();
        this.$options.encryptionSchemeOptions = {};
      } else if (_.isObject(options.encryptionScheme)) {
        this.$options.encryptionScheme =
          options.encryptionScheme.scheme || DEFAULT_ENCRYPTION_SCHEME;
        this.$options.encryptionSchemeOptions = _.omit(options.encryptionScheme, 'scheme');
      }

      if (!schemes.isEncryption(this.$options.encryptionScheme)) {
        throw new Error('Unsupported encryption scheme');
      }

      if (
        this.$options.encryptionSchemeOptions.hash &&
        !SUPPORTED_HASH_ALGORITHMS[this.$options.environment].includes(
          this.$options.encryptionSchemeOptions.hash
        )
      ) {
        throw new Error(
          'Unsupported hashing algorithm for ' + this.$options.environment + ' environment'
        );
      }
    }

    this.keyPair.setOptions(this.$options);
  };

  /**
   * Generate private/public keys pair
   *
   * @param bits {int} length key in bits. Default 2048.
   * @param exp {int} public exponent. Default 65537.
   * @returns {NodeRSA}
   */
  NodeRSA.prototype.generateKeyPair = function (bits, exp) {
    bits ||= 2048;
    exp ||= 65_537;

    if (bits % 8 !== 0) {
      throw new Error('Key size must be a multiple of 8.');
    }

    this.keyPair.generate(bits, exp.toString(16));
    this.$cache = {};
    return this;
  };

  /**
   * Importing key
   * @param keyData {string|buffer|Object}
   * @param format {string}
   */
  NodeRSA.prototype.importKey = function (keyData, format) {
    if (!keyData) {
      throw new Error('Empty key given');
    }

    format &&= EXPORT_FORMAT_ALIASES[format] || format;

    if (!formats.detectAndImport(this.keyPair, keyData, format) && format === undefined) {
      throw new Error('Key format must be specified');
    }

    this.$cache = {};

    return this;
  };

  /**
   * Exporting key
   * @param [format] {string}
   */
  NodeRSA.prototype.exportKey = function (format) {
    format ||= DEFAULT_EXPORT_FORMAT;
    format = EXPORT_FORMAT_ALIASES[format] || format;

    if (!this.$cache[format]) {
      this.$cache[format] = formats.detectAndExport(this.keyPair, format);
    }

    return this.$cache[format];
  };

  /**
   * Check if key pair contains private key
   */
  NodeRSA.prototype.isPrivate = function () {
    return this.keyPair.isPrivate();
  };

  /**
   * Check if key pair contains public key
   * @param [strict] {boolean} - public key only, return false if have private exponent
   */
  NodeRSA.prototype.isPublic = function (strict) {
    return this.keyPair.isPublic(strict);
  };

  /**
   * Check if key pair doesn't contains any data
   */
  NodeRSA.prototype.isEmpty = function (strict) {
    return !(this.keyPair.n || this.keyPair.e || this.keyPair.d);
  };

  /**
   * Encrypting data method with public key
   *
   * @param buffer {string|number|object|array|Buffer} - data for encrypting. Object and array will convert to JSON string.
   * @param encoding {string} - optional. Encoding for output result, may be 'buffer', 'binary', 'hex' or 'base64'. Default 'buffer'.
   * @param source_encoding {string} - optional. Encoding for given string. Default utf8.
   * @returns {string|Buffer}
   */
  NodeRSA.prototype.encrypt = function (buffer, encoding, source_encoding) {
    return this.$$encryptKey(false, buffer, encoding, source_encoding);
  };

  /**
   * Decrypting data method with private key
   *
   * @param buffer {Buffer} - buffer for decrypting
   * @param encoding - encoding for result string, can also take 'json' or 'buffer' for the automatic conversion of this type
   * @returns {Buffer|object|string}
   */
  NodeRSA.prototype.decrypt = function (buffer, encoding) {
    return this.$$decryptKey(false, buffer, encoding);
  };

  /**
   * Encrypting data method with private key
   *
   * Parameters same as `encrypt` method
   */
  NodeRSA.prototype.encryptPrivate = function (buffer, encoding, source_encoding) {
    return this.$$encryptKey(true, buffer, encoding, source_encoding);
  };

  /**
   * Decrypting data method with public key
   *
   * Parameters same as `decrypt` method
   */
  NodeRSA.prototype.decryptPublic = function (buffer, encoding) {
    return this.$$decryptKey(true, buffer, encoding);
  };

  /**
   * Encrypting data method with custom key
   */
  NodeRSA.prototype.$$encryptKey = function (usePrivate, buffer, encoding, source_encoding) {
    try {
      const res = this.keyPair.encrypt(
        this.$getDataForEncrypt(buffer, source_encoding),
        usePrivate
      );

      if (encoding == 'buffer' || !encoding) {
        return res;
      }
      return res.toString(encoding);
    } catch (error) {
      throw new Error('Error during encryption. Original error: ' + error);
    }
  };

  /**
   * Decrypting data method with custom key
   */
  NodeRSA.prototype.$$decryptKey = function (usePublic, buffer, encoding) {
    try {
      buffer = _.isString(buffer) ? Buffer.from(buffer, 'base64') : buffer;
      const res = this.keyPair.decrypt(buffer, usePublic);

      if (res === null) {
        throw new Error('Key decrypt method returns null.');
      }

      return this.$getDecryptedData(res, encoding);
    } catch (error) {
      throw new Error('Error during decryption (probably incorrect key). Original error: ' + error);
    }
  };

  /**
   *  Signing data
   *
   * @param buffer {string|number|object|array|Buffer} - data for signing. Object and array will convert to JSON string.
   * @param encoding {string} - optional. Encoding for output result, may be 'buffer', 'binary', 'hex' or 'base64'. Default 'buffer'.
   * @param source_encoding {string} - optional. Encoding for given string. Default utf8.
   * @returns {string|Buffer}
   */
  NodeRSA.prototype.sign = function (buffer, encoding, source_encoding) {
    if (!this.isPrivate()) {
      throw new Error('This is not private key');
    }

    let res = this.keyPair.sign(this.$getDataForEncrypt(buffer, source_encoding));

    if (encoding && encoding != 'buffer') {
      res = res.toString(encoding);
    }

    return res;
  };

  /**
   *  Verifying signed data
   *
   * @param buffer - signed data
   * @param signature
   * @param source_encoding {string} - optional. Encoding for given string. Default utf8.
   * @param signature_encoding - optional. Encoding of given signature. May be 'buffer', 'binary', 'hex' or 'base64'. Default 'buffer'.
   * @returns {*}
   */
  NodeRSA.prototype.verify = function (buffer, signature, source_encoding, signature_encoding) {
    if (!this.isPublic()) {
      throw new Error('This is not public key');
    }
    signature_encoding =
      !signature_encoding || signature_encoding == 'buffer' ? null : signature_encoding;
    return this.keyPair.verify(
      this.$getDataForEncrypt(buffer, source_encoding),
      signature,
      signature_encoding
    );
  };

  /**
   * Returns key size in bits
   * @returns {int}
   */
  NodeRSA.prototype.getKeySize = function () {
    return this.keyPair.keySize;
  };

  /**
   * Returns max message length in bytes (for 1 chunk) depending on current encryption scheme
   * @returns {int}
   */
  NodeRSA.prototype.getMaxMessageSize = function () {
    return this.keyPair.maxMessageLength;
  };

  /**
   * Preparing given data for encrypting/signing. Just make new/return Buffer object.
   *
   * @param buffer {string|number|object|array|Buffer} - data for encrypting. Object and array will convert to JSON string.
   * @param encoding {string} - optional. Encoding for given string. Default utf8.
   * @returns {Buffer}
   */
  NodeRSA.prototype.$getDataForEncrypt = function (buffer, encoding) {
    if (_.isString(buffer) || _.isNumber(buffer)) {
      return Buffer.from(String(buffer), encoding || 'utf8');
    }
    if (Buffer.isBuffer(buffer)) {
      return buffer;
    }
    if (_.isObject(buffer)) {
      return Buffer.from(JSON.stringify(buffer));
    }
    throw new Error('Unexpected data type');
  };

  /**
   *
   * @param buffer {Buffer} - decrypted data.
   * @param encoding - optional. Encoding for result output. May be 'buffer', 'json' or any of Node.js Buffer supported encoding.
   * @returns {*}
   */
  NodeRSA.prototype.$getDecryptedData = function (buffer, encoding) {
    encoding ||= 'buffer';

    if (encoding == 'buffer') {
      return buffer;
    }
    if (encoding == 'json') {
      return JSON.parse(buffer.toString());
    }
    return buffer.toString(encoding);
  };

  return NodeRSA;
})();
