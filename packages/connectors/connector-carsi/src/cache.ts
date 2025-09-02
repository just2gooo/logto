import ky from 'ky';

/* eslint-disable */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xml2js = require('xml2js');
const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
/* eslint-enable */

type SchoolInfo = {
  zh: string;
  en: string;
  logo: string;
  domain: string;
};

type CacheEntry = {
  data: Map<string, SchoolInfo>;
  timestamp: number;
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存

// 使用类来管理缓存状态，避免全局变量重新赋值
class CacheManager {
  private cache: CacheEntry | undefined = undefined;

  getCache(): CacheEntry | undefined {
    return this.cache;
  }

  setCache(cache: CacheEntry): void {
    this.cache = cache;
  }

  clearCache(): void {
    this.cache = undefined;
  }
}

const cacheManager = new CacheManager();

// 从CARSI metadata XML解析学校信息
export const parseCarsiMetadata = async (isPreview = false): Promise<Map<string, SchoolInfo>> => {
  // See https://carsi.atlassian.net/wiki/spaces/CAW/pages/101122108/CARSI+SP+OAuth
  const metadataUrl = isPreview
    ? 'https://www.carsi.edu.cn/carsimetadata/carsifed-metadata.xml' // 预览环境404了，暂时用生产环境代替
    : 'https://www.carsi.edu.cn/carsimetadata/carsifed-metadata.xml';

  console.log('Fetching CARSI metadata from:', metadataUrl);

  try {
    const response = await ky.get(metadataUrl, { timeout: 30_000 });
    const xmlText = await response.text();

    console.log(`Received XML content length: ${xmlText.length} characters`);

    return parseXmlToSchools(xmlText);
  } catch (error: unknown) {
    console.error('Failed to parse CARSI metadata:', error);
    return new Map();
  }
};

/* eslint-disable */
const parseXmlToSchools = (xmlText: string): Map<string, SchoolInfo> => {
  const resultMap = new Map<string, SchoolInfo>();
  parser.parseString(xmlText, (err: any, result: any) => {
    if (err) throw err;
    let noDomainCount = 0;
    let noUIInfoCount = 0;
    let noLanguageCount = 0;
    let noLangValueCount = 0;
    let notIDPSSODescriptorCount = 0;
    let parsedCount = 0;
    for (const key in result.EntitiesDescriptor.EntityDescriptor) {
      const entityDescriptor = result.EntitiesDescriptor.EntityDescriptor[key];
      if ('IDPSSODescriptor' in entityDescriptor) {
        const iDPSSODescriptor = entityDescriptor.IDPSSODescriptor;
        let domain = '';
        if ('mdui:UIInfo' in iDPSSODescriptor.Extensions) {
          if ('mdui:Description' in iDPSSODescriptor.Extensions['mdui:UIInfo']) { 
            if ('_' in iDPSSODescriptor.Extensions['mdui:UIInfo']['mdui:Description']) {
              domain = iDPSSODescriptor.Extensions['mdui:UIInfo']['mdui:Description']['_'];
              resultMap.set(domain, {
                zh: domain,
                en: domain,
                domain,
                logo: '',
              });
              parsedCount++;
              for (let item of iDPSSODescriptor.Extensions['mdui:UIInfo']['mdui:DisplayName']) {
                const lang = item.$['xml:lang'];
                if (lang) {
                  const value = item._;
                  if (lang == 'zh') {
                    resultMap.get(domain)!.zh = item._;
                  } else if (lang == 'en') {
                    resultMap.get(domain)!.en = item._;
                  } else {
                    noLangValueCount++;
                  }
                } else {
                  noLanguageCount++;
                }
              }
              if ('mdui:Logo' in iDPSSODescriptor.Extensions['mdui:UIInfo']) {
                const item = iDPSSODescriptor.Extensions['mdui:UIInfo']['mdui:Logo']
                resultMap.get(domain)!.logo = item._;
              }
            } else {
              noDomainCount++;
            }
          } else {
            noDomainCount++;
          }
        } else {
          noUIInfoCount++;
        }
      } else {
        notIDPSSODescriptorCount++;
      }
    }
    console.log(`resultMap: ${JSON.stringify(Array.from(resultMap), null, 2)}`);
    console.log(`noDomainCount: ${noDomainCount}`);
    console.log(`noUIInfoCount: ${noUIInfoCount}`);
    console.log(`notIDPSSODescriptorCount: ${notIDPSSODescriptorCount}`);
    console.log(`noLanguageCount: ${noLanguageCount}`);
    console.log(`noLangValueCount: ${noLangValueCount}`);
    console.log(`parsedCount++;: ${parsedCount++}`);
  });
  return resultMap;
};
/* eslint-enable */

// 获取学校信息（带缓存）
export const getSchoolInfo = async (
  domain: string,
  isPreview = false
): Promise<SchoolInfo | undefined> => {
  const now = Date.now();
  const currentCache = cacheManager.getCache();

  // 检查缓存是否过期
  const shouldUpdateCache =
    !currentCache || now - currentCache.timestamp > CACHE_DURATION || currentCache.data.size === 0;

  if (shouldUpdateCache) {
    console.log('Updating CARSI school cache...');
    try {
      const newSchoolCache = await parseCarsiMetadata(isPreview);
      cacheManager.setCache({
        data: newSchoolCache,
        timestamp: now,
      });
      console.log(`Updated cache with ${newSchoolCache.size} schools`);
    } catch (error) {
      console.error('Failed to update school cache, using existing cache:', error);
    }
  }

  return cacheManager.getCache()?.data.get(domain);
};

// 预加载学校信息缓存
export const initializeSchoolCache = async (isPreview = false): Promise<void> => {
  try {
    console.log('Initializing CARSI school cache...');
    const newSchoolCache = await parseCarsiMetadata(isPreview);
    cacheManager.setCache({
      data: newSchoolCache,
      timestamp: Date.now(),
    });
    console.log(`Initialized cache with ${newSchoolCache.size} schools`);
  } catch (error) {
    console.error('Failed to initialize school cache:', error);
  }
};

// 手动刷新学校信息缓存
export const refreshSchoolCache = async (isPreview = false): Promise<void> => {
  try {
    console.log('Manually refreshing CARSI school cache...');
    const newSchoolCache = await parseCarsiMetadata(isPreview);
    cacheManager.setCache({
      data: newSchoolCache,
      timestamp: Date.now(),
    });
    console.log(`Refreshed cache with ${newSchoolCache.size} schools`);
  } catch (error) {
    console.error('Failed to refresh school cache:', error);
    throw error;
  }
};

// 获取当前缓存的学校信息（用于调试）
export const getCachedSchools = (): Map<string, SchoolInfo> => {
  const currentCache = cacheManager.getCache();
  if (!currentCache) {
    return new Map<string, SchoolInfo>();
  }
  const cacheCopy = new Map<string, SchoolInfo>();
  for (const [key, value] of currentCache.data) {
    cacheCopy.set(key, value);
  }
  return cacheCopy;
};

// 测试XML解析功能
export const testXmlParsing = async (isPreview = false): Promise<void> => {
  console.log('Testing CARSI XML parsing...');
  const schools = await parseCarsiMetadata(isPreview);
  console.log(`Test completed. Parsed ${schools.size} schools.`);

  // 显示前5个学校信息
  const sampleSchools = Array.from(schools.entries()).slice(0, 5);
  console.log('Sample schools from test:', sampleSchools);
};

export type { SchoolInfo };
