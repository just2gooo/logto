import type { ConnectorMetadata } from '@logto/connector-kit';
import { ConnectorPlatform, ConnectorConfigFormItemType } from '@logto/connector-kit';

import { type AilabConfig } from './types.js';

const productionBaseURL = 'https://sso.openxlab.org.cn';
const preprodBaseURL = 'https://sso.dev.openxlab.org.cn';
const getBaseURL = (config: AilabConfig) => {
  return config.environment === 'production' ? productionBaseURL : preprodBaseURL;
};

export const getAuthorizationEndpoint = (config: AilabConfig) => {
  return getBaseURL(config) + '/authentication';
};

export const getPublickKeyEndpoint = (config: AilabConfig) => {
  return getBaseURL(config) + '/gw/uaa-be/api/v1/cipher/getPubKey';
};

export const getAccessTokenEndpoint = (config: AilabConfig) => {
  return getBaseURL(config) + '/gw/uaa-be/api/v1/internal/getJwt';
};

export const getUserInfoEndpoint = (config: AilabConfig) => {
  return getBaseURL(config) + '/gw/uaa-be/api/v1/internal/getUserInfo';
};

// Default scope is read user profile
export const defaultScope = '1';

export const defaultMetadata: ConnectorMetadata = {
  id: 'ailab-universal',
  target: 'ailab',
  platform: ConnectorPlatform.Universal,
  name: {
    en: 'ailab',
    'zh-CN': '上海人工智能实验室',
  },
  logo: './logo.png',
  logoDark: null,
  description: {
    en: 'The SSO of Shanghai Artificial Intelligence Laboratory',
    'zh-CN': '上海人工智能实验室单点登录系统',
  },
  readme: './README.md',
  formItems: [
    {
      key: 'environment',
      label: 'Environment',
      type: ConnectorConfigFormItemType.Select,
      selectItems: [
        { title: 'Production', value: 'prod' },
        { title: 'Develop', value: 'preprod' },
      ],
      defaultValue: 'prod',
    },
    {
      key: 'clientId',
      type: ConnectorConfigFormItemType.Text,
      label: 'Client ID',
      required: true,
      placeholder: '<client-id>',
    },
    {
      key: 'clientSecret',
      type: ConnectorConfigFormItemType.Text,
      label: 'Client Secret',
      required: true,
      placeholder: '<client-secret>',
    },
    // {
    //   key: 'scope',
    //   type: ConnectorConfigFormItemType.Text,
    //   label: 'Scope',
    //   required: false,
    //   placeholder: '<scope>',
    //   description: 'The scope determines permissions granted by the user.',
    // },
  ],
};

export const defaultTimeout = 5000;
