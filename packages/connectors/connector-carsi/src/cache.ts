import ky from 'ky';

type SchoolInfo = {
  zh: string;
  en: string;
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
  const metadataUrl = isPreview
    ? 'https://dspre.carsi.edu.cn/carsifed-metadata-pre.xml'
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

const extractDomainFromEntity = (entityContent: string) => {
  // 提取scope信息 - 使用更宽松的匹配，支持多种格式
  const scopeMatch = /<shibmd:Scope[^>]*>([^<]+)<\/shibmd:Scope>/.exec(entityContent);

  // 如果没有找到shibmd:Scope，尝试其他可能的scope标签
  const finalScopeMatch = scopeMatch ?? /<Scope[^>]*>([^<]+)<\/Scope>/.exec(entityContent);

  if (!finalScopeMatch?.[1]) {
    return null;
  }

  return finalScopeMatch[1].trim();
};

const extractNamesFromEntity = (entityContent: string) => {
  // 提取中文名称 - 支持多种格式
  const zhNameMatch = /<mdui:DisplayName[^>]*xml:lang="zh"[^>]*>([^<]+)<\/mdui:DisplayName>/.exec(
    entityContent
  );
  const enNameMatch = /<mdui:DisplayName[^>]*xml:lang="en"[^>]*>([^<]+)<\/mdui:DisplayName>/.exec(
    entityContent
  );

  // 如果没有找到xml:lang="zh"，尝试查找中文名称的其他方式
  const zhName = zhNameMatch?.[1]?.trim() ?? '';
  const enName = enNameMatch?.[1]?.trim() ?? '';

  // 如果中文名称为空，尝试查找没有语言标识的DisplayName
  const finalZhName = (() => {
    if (zhName) {
      return zhName;
    }

    const displayNameMatch = /<mdui:DisplayName[^>]*>([^<]+)<\/mdui:DisplayName>/.exec(
      entityContent
    );
    if (displayNameMatch?.[1]) {
      const displayName = displayNameMatch[1].trim();
      // 如果包含中文字符，认为是中文名称
      if (/[\u4E00-\u9FFF]/.test(displayName)) {
        return displayName;
      }
    }
    return zhName;
  })();

  return { zhName: finalZhName, enName };
};

const parseXmlToSchools = (xmlText: string): Map<string, SchoolInfo> => {
  // 先过滤掉XML注释，避免匹配到注释中的占位符文本
  const cleanXmlText = xmlText.replaceAll(/<!--[\S\s]*?-->/g, '');

  // 递归解析XML内容
  const parseRecursively = (
    text: string,
    index: number,
    accumulator: Map<string, SchoolInfo>
  ): Map<string, SchoolInfo> => {
    const entityStartTag = '<EntityDescriptor';
    const entityEndTag = '</EntityDescriptor>';

    const entityStart = text.indexOf(entityStartTag, index);
    if (entityStart === -1) {
      return accumulator;
    }

    const entityEnd = text.indexOf(entityEndTag, entityStart);
    if (entityEnd === -1) {
      return accumulator;
    }

    const entityContent = text.slice(entityStart, entityEnd + entityEndTag.length);
    const domain = extractDomainFromEntity(entityContent);

    const newAccumulator = domain ? processEntity(accumulator, entityContent, domain) : accumulator;

    return parseRecursively(text, entityEnd + entityEndTag.length, newAccumulator);
  };

  const processEntity = (
    accumulator: Map<string, SchoolInfo>,
    entityContent: string,
    domain: string
  ): Map<string, SchoolInfo> => {
    const { zhName: finalZhName, enName } = extractNamesFromEntity(entityContent);

    if (finalZhName && enName && domain.includes('.edu.cn')) {
      const newMap = new Map(accumulator);
      newMap.set(domain, {
        zh: finalZhName,
        en: enName,
        domain,
      });

      // 调试信息：显示前几个解析结果
      if (newMap.size <= 3) {
        console.log(`Parsed school: ${domain} -> ${finalZhName} (${enName})`);
      }
      return newMap;
    }

    if (domain.includes('.edu.cn')) {
      console.log(`Failed to parse school info for domain: ${domain}`);
      console.log(`  zhName: "${finalZhName}", enName: "${enName}"`);
    }

    return accumulator;
  };

  const result = parseRecursively(cleanXmlText, 0, new Map<string, SchoolInfo>());
  console.log(`Found valid schools: ${result.size}`);

  // 显示一些示例学校信息
  if (result.size > 0) {
    const sampleSchools = Array.from(result.entries()).slice(0, 3);
    console.log('Sample schools:', sampleSchools);
  }

  return result;
};

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
