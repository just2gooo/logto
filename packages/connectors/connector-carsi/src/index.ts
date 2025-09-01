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
import ky from 'ky';

import { initializeSchoolCache } from './cache.js';
import {
  defaultScope,
  defaultMetadata,
  defaultTimeout,
  getAuthorizationEndpoint,
  getAccessTokenEndpoint,
  isInPreProduction,
} from './constant.js';
import type { CarsiConfig } from './types.js';
import {
  carsiConfigGuard,
  accessTokenResponseGuard,
  authorizationCallbackErrorGuard,
  authResponseGuard,
} from './types.js';
import { fetchUserInfo } from './user-info.js';

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

    return fetchUserInfo(getConfig, accessToken);
  };

const createCarsiConnector: CreateConnector<SocialConnector> = async ({ getConfig }) => {
  // 初始化学校信息缓存
  const config = await getConfig(defaultMetadata.id);
  validateConfig(config, carsiConfigGuard);

  // 初始化缓存
  await initializeSchoolCache(isInPreProduction(config));

  // 返回连接器
  return {
    metadata: defaultMetadata,
    type: ConnectorType.Social,
    configGuard: carsiConfigGuard,
    getAuthorizationUri: getAuthorizationUri(getConfig),
    getUserInfo: getUserInfo(getConfig),
  };
};

// 导出所有需要的函数用于外部调用

export default createCarsiConnector;

export { refreshSchoolCache, getCachedSchools, testXmlParsing } from './cache.js';
