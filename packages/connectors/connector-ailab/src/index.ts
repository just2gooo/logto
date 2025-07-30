import crypto from 'node:crypto';

import {
  ConnectorError,
  ConnectorErrorCodes,
  validateConfig,
  ConnectorType,
  type GetAuthorizationUri,
  type GetUserInfo,
  type SocialConnector,
  type CreateConnector,
  type GetConnectorConfig,
} from '@logto/connector-kit';
import ky, { HTTPError } from 'ky';

import {
  defaultMetadata,
  defaultTimeout,
  getAuthorizationEndpoint,
  getAccessTokenEndpoint,
  getUserInfoEndpoint,
  getPublickKeyEndpoint,
} from './constant.js';
import type { AilabConfig } from './types.js';
import {
  ailabConfigGuard,
  userInfoResponseGuard,
  authorizationCallbackErrorGuard,
  authResponseGuard,
  getUserInfoErrorGuard,
  pubKeyResponseGuard,
  accessTokenResponseGuard,
} from './types.js';

async function rsaEncode(encode: string[], pubKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // 1. 添加时间戳并拼接字符串
      const ts = Math.floor(Date.now() / 1000); // 秒级时间戳
      const encodeWithTimestamp = [...encode, ts.toString()];
      const encodeString = encodeWithTimestamp.join('||');

      // 2. Base64 解码公钥
      const keyBytes = Buffer.from(pubKey, 'base64');

      // 3. 创建公钥对象 (DER 格式的 SPKI 公钥)
      const publicKey = crypto.createPublicKey({
        key: keyBytes,
        format: 'der',
        type: 'spki',
      });

      // 4. RSA 加密 (PKCS1v15 填充)
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(encodeString)
      );

      // 5. 返回Base64编码的加密结果
      resolve(encrypted.toString('base64'));
    } catch (error) {
      // 统一错误处理
      reject(
        new ConnectorError(
          ConnectorErrorCodes.General,
          `RSA encryption failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  });
}

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
    console.log('just2goo: getAuthorizationUri config:', config);
    validateConfig(config, ailabConfigGuard);

    const queryParameters = new URLSearchParams({
      clientId: config.clientId,
      redirect: redirectUri,
      state,
      // Response_type: 'code',
      // Scope: config.scope ?? defaultScope,
      // Lang: 'zh-CN', // TODO 应该传入当前语言
    });
    const authorizationEndpoint = getAuthorizationEndpoint(config);

    console.log(
      'just2goo: AuthorizationUri:',
      `${authorizationEndpoint}?${queryParameters.toString()}`
    );

    return `${authorizationEndpoint}?${queryParameters.toString()}`;
  };

const encodeClientConfig = async (
  client_id: string,
  client_secret: string,
  config: AilabConfig
) => {
  const publicKeyEndpoint = getPublickKeyEndpoint(config);

  const publicKeyHttpResponse = await ky
    .post(publicKeyEndpoint, {
      json: {
        type: 'auth',
        from: 'platform',
        clientId: client_id,
      },
      timeout: defaultTimeout,
    })
    .json();
  console.log('just2goo: getPublicKey publicKeyHttpResponse:', publicKeyHttpResponse);
  const pubKeyResult = pubKeyResponseGuard.safeParse(publicKeyHttpResponse);
  if (!pubKeyResult.success) {
    throw new ConnectorError(ConnectorErrorCodes.SocialAuthCodeInvalid);
  }

  const {
    data: { pubKey: rsaEncodedPublicKey },
  } = pubKeyResult.data;
  console.log('just2goo: getPublicKey rsaEncodedPublicKey:', rsaEncodedPublicKey);
  return rsaEncode([client_id, client_secret], rsaEncodedPublicKey);
};

export const getAccessToken = async (config: AilabConfig, code: string, redirectUri: string) => {
  console.log('just2goo: getAccessToken code:', code);
  const { clientId: client_id, clientSecret: client_secret } = config;

  const encryptedKey = await encodeClientConfig(client_id, client_secret, config);

  const accessTokenEndpoint = getAccessTokenEndpoint(config);

  const httpResponse = await ky
    .post(accessTokenEndpoint, {
      json: {
        clientId: client_id,
        code,
        d: encryptedKey,
      },
      timeout: defaultTimeout,
    })
    .json();

  console.log('just2goo: getAccessToken httpResponse:', httpResponse);

  const result = accessTokenResponseGuard.safeParse(httpResponse);

  if (!result.success) {
    console.log('just2goo: getAccessToken validation failed:', result.error);
    console.log('just2goo: getAccessToken actual response:', JSON.stringify(httpResponse, null, 2));
    throw new ConnectorError(
      ConnectorErrorCodes.SocialAuthCodeInvalid,
      `Access token response validation failed: ${JSON.stringify(result.error.issues)}`
    );
  }

  const {
    data: { jwt: accessToken },
  } = result.data;

  assert(accessToken, new ConnectorError(ConnectorErrorCodes.SocialAuthCodeInvalid));

  console.log('just2goo: getAccessToken accessToken:', accessToken);

  return { accessToken };
};

const processUserInfoResponse = async (
  response: unknown,
  userInfoResult: ReturnType<typeof userInfoResponseGuard.safeParse>
) => {
  if (!userInfoResult.success) {
    console.log('just2goo: getUserInfo validation failed:', userInfoResult.error);
    console.log('just2goo: getUserInfo actual response:', JSON.stringify(response, null, 2));
    throw new ConnectorError(
      ConnectorErrorCodes.InvalidResponse,
      `User info response validation failed: ${JSON.stringify(userInfoResult.error.issues)}`
    );
  }

  const { data: userInfo } = userInfoResult.data;
  console.log('just2goo: getUserInfo userInfo:', userInfo);

  // 如果userInfo.phone是不以+为开头的，则需要加上+86
  const processedPhone =
    userInfo.phone && !userInfo.phone.startsWith('+') ? `+86${userInfo.phone}` : userInfo.phone;

  return {
    id: userInfo.ssoUid,
    email: userInfo.email ?? '',
    phone: processedPhone ?? '',
    avatar: userInfo.avatar ?? '',
    name: userInfo.username ?? '',
    rawData: userInfo,
  };
};

const handleUserInfoError = async (error: unknown) => {
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
};

const getUserInfo =
  (getConfig: GetConnectorConfig): GetUserInfo =>
  async (data) => {
    console.log('just2goo: getUserInfo data:', data);
    const { code, redirectUri } = await authorizationCallbackHandler(data);
    console.log(`just2gooo: getUserInfo code: ${code}, redirectUri: ${redirectUri}`);
    const config = await getConfig(defaultMetadata.id);
    validateConfig(config, ailabConfigGuard);
    const { accessToken } = await getAccessToken(config, code, redirectUri);
    const { clientId: client_id, clientSecret: client_secret } = config;

    const encryptedKey = await encodeClientConfig(client_id, client_secret, config);

    const userInfoEndpoint = getUserInfoEndpoint(config);
    try {
      const response = await ky
        .post(userInfoEndpoint, {
          json: {
            clientId: client_id,
            token: accessToken,
            d: encryptedKey,
          },
          timeout: defaultTimeout,
        })
        .json();

      console.log('just2goo: getUserInfo response:', response);

      const userInfoResult = userInfoResponseGuard.safeParse(response);
      return await processUserInfoResponse(response, userInfoResult);
    } catch (error: unknown) {
      return handleUserInfoError(error);
    }
  };

const createAilabConnector: CreateConnector<SocialConnector> = async ({ getConfig }) => {
  return {
    metadata: defaultMetadata,
    type: ConnectorType.Social,
    configGuard: ailabConfigGuard,
    getAuthorizationUri: getAuthorizationUri(getConfig),
    getUserInfo: getUserInfo(getConfig),
  };
};

export default createAilabConnector;

function assert(value: unknown, error: ConnectorError): asserts value {
  if (!value) {
    throw error;
  }
}
