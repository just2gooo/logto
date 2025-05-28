/* eslint-disable unicorn/no-abusive-eslint-disable */
import { assert } from '@silverhand/essentials';

import {
  ConnectorError,
  ConnectorErrorCodes,
  validateConfig,
  ConnectorType,
  jsonGuard,
  type GetAuthorizationUri,
  type GetUserInfo,
  type SocialConnector,
  type CreateConnector,
  type GetConnectorConfig,
} from '@logto/connector-kit';
import ky, { HTTPError } from 'ky';

import {
  defaultScope,
  defaultMetadata,
  defaultTimeout,
  getAuthorizationEndpoint,
  getAccessTokenEndpoint,
  getUserInfoEndpoint,
} from './constant.js';
import type { CarsiConfig } from './types.js';
import {
  carsiConfigGuard,
  accessTokenResponseGuard,
  userInfoResponseGuard,
  authorizationCallbackErrorGuard,
  authResponseGuard,
  getUserInfoErrorGuard,
} from './types.js';

/* eslint-disable */
const NodeRSA = require('../dependencies/node-rsa');

function decryptBase64RSA(encryptedBase64: string, privateKey: string) {
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
}
/* eslint-enable */

const authorizationCallbackHandler = async (parameterObject: unknown) => {
  console.log('just2goo: authorizationCallbackHandler parameterObject:', parameterObject);
  const result = authResponseGuard.safeParse(parameterObject);

  if (!result.success) {
    const parsedError = authorizationCallbackErrorGuard.safeParse(parameterObject);

    if (!parsedError.success) {
      throw new ConnectorError(ConnectorErrorCodes.General, JSON.stringify(parameterObject));
    }

    const { error, error_description } = parsedError.data;

    throw new ConnectorError(ConnectorErrorCodes.General, {
      error,
      errorDescription: error_description,
    });
  }

  return result.data;
};

const getAuthorizationUri =
  (getConfig: GetConnectorConfig): GetAuthorizationUri =>
  async ({ state, redirectUri }) => {
    console.log('just2goo: getAuthorizationUri begin');
    const config = await getConfig(defaultMetadata.id);
    validateConfig(config, carsiConfigGuard);

    const queryParameters = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: config.scope ?? defaultScope,
    });
    const authorizationEndpoint = getAuthorizationEndpoint(config);

    console.log(
      'just2goo: AuthorizationUri:',
      `${authorizationEndpoint}?${queryParameters.toString()}`
    );

    return `${authorizationEndpoint}?${queryParameters.toString()}`;
  };

export const getAccessToken = async (
  config: CarsiConfig,
  codeObject: { code: string },
  redirectUri: string
) => {
  console.log('just2goo: getAccessToken codeObject:', codeObject);
  const { code } = codeObject;
  const { clientId: client_id, clientSecret: client_secret } = config;

  const formData = new URLSearchParams({
    client_id,
    client_secret,
    code,
    grant_type: 'authorization_code',
  });
  const accessTokenEndpoint = getAccessTokenEndpoint(config);

  const httpResponse = await ky
    .post(accessTokenEndpoint, {
      body: formData,
      timeout: defaultTimeout,
    })
    .text();

  console.log('just2goo: getAccessToken httpResponse:', httpResponse);

  const jsonResponse = jsonGuard.parse(JSON.parse(httpResponse));

  const result = accessTokenResponseGuard.safeParse(jsonResponse);

  if (!result.success) {
    throw new ConnectorError(ConnectorErrorCodes.SocialAuthCodeInvalid);
  }

  const { access_token: accessToken } = result.data;

  assert(accessToken, new ConnectorError(ConnectorErrorCodes.SocialAuthCodeInvalid));

  return { accessToken };
};

const getUserInfo =
  (getConfig: GetConnectorConfig): GetUserInfo =>
  async (data) => {
    console.log('just2goo: getUserInfo data:', data);
    const { code, redirectUri } = await authorizationCallbackHandler(data);
    const config = await getConfig(defaultMetadata.id);
    validateConfig(config, carsiConfigGuard);
    const { accessToken } = await getAccessToken(config, { code }, redirectUri);

    const userInfoEndpoint = getUserInfoEndpoint(config);
    try {
      const response = await ky
        .get(userInfoEndpoint, {
          searchParams: {
            client_id: config.clientId,
            access_token: accessToken,
          },
          timeout: defaultTimeout,
        })
        .json();

      console.log('just2goo: getUserInfo response:', response);

      const userInfoResult = userInfoResponseGuard.safeParse(response);

      if (!userInfoResult.success) {
        throw new ConnectorError(ConnectorErrorCodes.InvalidResponse);
      }

      const { carsiAffiliation, carsiPersistentUid, resourceId } = userInfoResult.data;

      return {
        id: decryptBase64RSA(carsiPersistentUid, config.rsaPrivateKey),
        name: decryptBase64RSA(carsiAffiliation, config.rsaPrivateKey),
        rawData: jsonGuard.parse(response),
      };
    } catch (error: unknown) {
      if (error instanceof HTTPError) {
        const errorBody: unknown = await error.response.json();
        const parsedError = getUserInfoErrorGuard.safeParse(errorBody);

        if (!parsedError.success) {
          throw new ConnectorError(ConnectorErrorCodes.General, parsedError.error);
        }

        const { code, description } = parsedError.data;
        if (error.response.status === 403) {
          throw new ConnectorError(ConnectorErrorCodes.SocialAccessTokenInvalid);
        }

        throw new ConnectorError(ConnectorErrorCodes.General, {
          code,
          description,
        });
      }

      throw error;
    }
  };

const createCarsiConnector: CreateConnector<SocialConnector> = async ({ getConfig }) => {
  return {
    metadata: defaultMetadata,
    type: ConnectorType.Social,
    configGuard: carsiConfigGuard,
    getAuthorizationUri: getAuthorizationUri(getConfig),
    getUserInfo: getUserInfo(getConfig),
  };
};

export default createCarsiConnector;
