import type { ConnectorMetadata } from '@logto/connector-kit';
import { ConnectorPlatform, ConnectorConfigFormItemType } from '@logto/connector-kit';

import { type CarsiConfig } from './types.js';

export const authorizationEndpointPreProduction = 'https://spoauth2pre.carsi.edu.cn/api/authorize';
export const accessTokenEndpointPreProduction = 'https://spoauth2pre.carsi.edu.cn/api/token';
export const userInfoEndpointPreProduction = 'https://spoauth2pre.carsi.edu.cn/api/resource';

export const getAuthorizationEndpoint = (config: CarsiConfig) => {
  return config.environment === 'production'
    ? `https://sp-{$client_id}.carsi.edu.cn/api/authorize`
    : authorizationEndpointPreProduction;
};

export const getAccessTokenEndpoint = (config: CarsiConfig) => {
  return config.environment === 'production'
    ? `https://sp-{$client_id}.carsi.edu.cn/api/token`
    : accessTokenEndpointPreProduction;
};

export const getUserInfoEndpoint = (config: CarsiConfig) => {
  return config.environment === 'production'
    ? `https://sp-{$client_id}.carsi.edu.cn/api/resource`
    : userInfoEndpointPreProduction;
};

// Default scope is read user profile
export const defaultScope = '1';

export const defaultMetadata: ConnectorMetadata = {
  id: 'carsi-universal',
  target: 'carsi',
  platform: ConnectorPlatform.Universal,
  name: {
    en: 'CARSI',
    'zh-CN': '教育网联邦认证与资源共享基础设施',
  },
  logo: './logo.png',
  logoDark: null,
  description: {
    en: 'The China Education and Research Computer Network Federated Authentication and Resource Sharing Infrastructure (CARSI) provides federal authentication and global academic information resource sharing services for universities and research institutions that have established unified identity authentication on campus networks.',
    'zh-CN':
      '中国教育和科研计算机网联邦认证与资源共享基础设施（CERNET Authentication and Resource Sharing Infrastructure），简称CARSI，为已经建立校园网统一身份认证的高校和科研单位，提供联邦认证和全球学术信息资源共享服务。',
  },
  readme: './README.md',
  formItems: [
    {
      key: 'environment',
      label: 'Environment',
      type: ConnectorConfigFormItemType.Select,
      selectItems: [
        { title: 'Production', value: 'prod' },
        { title: 'PreProduction', value: 'preprod' },
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
    {
      key: 'rsaPrivateKey',
      type: ConnectorConfigFormItemType.MultilineText,
      label: 'RSA Private Key',
      required: true,
      placeholder: '<private-key>',
    },
    {
      key: 'scope',
      type: ConnectorConfigFormItemType.Text,
      label: 'Scope',
      required: false,
      placeholder: '<scope>',
      description: 'The scope determines permissions granted by the user.',
    },
  ],
};

export const defaultTimeout = 5000;
