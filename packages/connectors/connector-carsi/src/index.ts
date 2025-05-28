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

const { privateDecrypt, constants } = await import('node:crypto');

/**
 * 解密 Base64 编码的 RSA 加密数据
 * @param {string} base64Data - Base64 编码的数据
 * @param {string} privateKey - RSA 私钥
 * @returns {string} - 解密后的字符串
 */
function decryptBase64RSA(base64Data: string, privateKey: string) {
  // Base64 解码
  const decodedData = Buffer.from(base64Data, 'base64');

  // RSA 解密
  const decryptedData = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_PADDING,
    },
    decodedData
  );

  // 返回解密后的字符串
  return decryptedData.toString('utf8');
}

const authorizationCallbackHandler = async (parameterObject: unknown) => {
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

    return `${authorizationEndpoint}?${queryParameters.toString()}`;
  };

export const getAccessToken = async (
  config: CarsiConfig,
  codeObject: { code: string },
  redirectUri: string
) => {
  const { code } = codeObject;
  const { clientId: client_id, clientSecret: client_secret } = config;

  const formData = new URLSearchParams({
    client_id,
    client_secret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const accessTokenEndpoint = getAccessTokenEndpoint(config);

  const httpResponse = await ky
    .post(accessTokenEndpoint, {
      body: formData,
      timeout: defaultTimeout,
    })
    .text();

  const jsonResponse = jsonGuard.parse(JSON.parse(httpResponse.replace('&&&START&&&', '')));

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
    const { code, redirectUri } = await authorizationCallbackHandler(data);
    const config = await getConfig(defaultMetadata.id);
    validateConfig(config, carsiConfigGuard);
    const { accessToken } = await getAccessToken(config, { code }, redirectUri);

    const userInfoEndpoint = getUserInfoEndpoint(config);
    try {
      const response = await ky
        .get(userInfoEndpoint, {
          searchParams: {
            clientId: config.clientId,
            token: accessToken,
          },
          timeout: defaultTimeout,
        })
        .json();

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
