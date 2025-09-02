import {
  ConnectorError,
  ConnectorErrorCodes,
  validateConfig,
  type GetConnectorConfig,
} from '@logto/connector-kit';
import ky, { HTTPError } from 'ky';

import { getSchoolInfo } from './cache.js';
import {
  defaultMetadata,
  defaultTimeout,
  getUserInfoEndpoint,
  isInPreProduction,
} from './constant.js';
import { carsiConfigGuard, userInfoResponseGuard, getUserInfoErrorGuard } from './types.js';

/* eslint-disable */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const NodeRSA = require('node-rsa');
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
// 解析CARSI affiliation获取学校信息
const parseSchoolFromAffiliation = async (
  affiliation: string,
  isPreview = false
): Promise<{ school: { zh: string; en: string; logo: string }; role: string }> => {
  // 解析格式：faculty@pku.edu.cn
  const parts = affiliation.split('@');
  if (parts.length !== 2) {
    return {
      school: { zh: '未知学校', en: 'Unknown School', logo: '' },
      role: 'Unknown',
    };
  }

  const role = parts[0] ?? '';
  const domain = parts[1] ?? '';

  // 角色映射
  const roleMap: Record<string, string> = {
    faculty: '教师',
    student: '学生',
    staff: '员工',
    alum: '校友',
    member: '成员',
    affiliate: '附属人员',
    employee: '聘用人员',
    other: '其他',
  };

  // 从缓存获取学校信息
  const schoolInfo = await getSchoolInfo(domain, isPreview);

  if (schoolInfo) {
    const roleValue = role || 'Unknown';
    return {
      school: {
        zh: schoolInfo.zh,
        en: schoolInfo.en,
        logo: schoolInfo.logo,
      },
      role: roleMap[roleValue] ?? roleValue,
    };
  }

  console.log('无法从缓存中获取学校信息，使用域名作为学校名');
  // 如果缓存中没有，返回域名作为学校名
  const roleValue = role || 'Unknown';
  return {
    school: {
      zh: domain,
      en: domain,
      logo: '',
    },
    role: roleMap[roleValue] ?? roleValue,
  };
};

export const fetchUserInfo = async (getConfig: GetConnectorConfig, accessToken: string) => {
  const config = await getConfig(defaultMetadata.id);
  validateConfig(config, carsiConfigGuard);

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

    const decryptedAffiliation = carsiAffiliation
      ? decryptBase64RSA(carsiAffiliation, config.rsaPrivateKey)
      : '';
    const decryptedPersistentUid = carsiPersistentUid
      ? decryptBase64RSA(carsiPersistentUid, config.rsaPrivateKey)
      : '';
    const decryptedResourceId = resourceId
      ? decryptBase64RSA(resourceId, config.rsaPrivateKey)
      : '';

    const { school, role } = await parseSchoolFromAffiliation(
      decryptedAffiliation,
      isInPreProduction(config)
    );

    // 构建增强的rawData，包含解析后的学校信息
    const enhancedRawData = {
      'carsi-affiliation': decryptedAffiliation,
      'carsi-persistent-uid': decryptedPersistentUid,
      resource_id: decryptedResourceId,
      role,
      school,
    };

    return {
      id: decryptedPersistentUid,
      name: decryptedAffiliation,
      avatar: school.logo,
      rawData: enhancedRawData,
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
