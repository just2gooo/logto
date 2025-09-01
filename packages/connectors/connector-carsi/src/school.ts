import ky from 'ky';

export type SchoolInfo = {
  zh: string;
  en: string;
  domain: string;
};

type CacheState = {
  lastUpdate: number;
  duration: number;
};

const extractDomainFromEntity = (entityContent: string): string | undefined => {
  const scopeMatch = /<shibmd:Scope[^>]*>([^<]+)<\/shibmd:Scope>/.exec(entityContent);
  const finalScopeMatch = scopeMatch ?? /<Scope[^>]*>([^<]+)<\/Scope>/.exec(entityContent);
  return finalScopeMatch?.[1]?.trim();
};

const extractNamesFromEntity = (entityContent: string): { zhName: string; enName: string } => {
  const zhNameMatch = /<mdui:DisplayName[^>]*xml:lang="zh"[^>]*>([^<]+)<\/mdui:DisplayName>/.exec(
    entityContent
  );
  const enNameMatch = /<mdui:DisplayName[^>]*xml:lang="en"[^>]*>([^<]+)<\/mdui:DisplayName>/.exec(
    entityContent
  );

  const zhName = zhNameMatch?.[1]?.trim() ?? '';
  const enName = enNameMatch?.[1]?.trim() ?? '';

  const displayNameMatch = /<mdui:DisplayName[^>]*>([^<]+)<\/mdui:DisplayName>/.exec(entityContent);
  const displayName = displayNameMatch?.[1]?.trim() ?? '';

  return {
    zhName: /[\u4E00-\u9FFF]/.test(displayName) ? displayName : zhName,
    enName,
  };
};

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

  if (domain) {
    const { zhName, enName } = extractNamesFromEntity(entityContent);
    if (zhName && enName && domain.includes('.edu.cn')) {
      accumulator.set(domain, { zh: zhName, en: enName, domain });
    }
  }

  return parseRecursively(text, entityEnd + entityEndTag.length, accumulator);
};

export const parseXmlToSchools = (xmlText: string): Map<string, SchoolInfo> => {
  return parseRecursively(
    xmlText.replaceAll(/<!--[\S\s]*?-->/g, ''),
    0,
    new Map<string, SchoolInfo>()
  );
};

class SchoolCacheManager {
  private readonly schoolCache = new Map<string, SchoolInfo>();
  private state: CacheState = {
    lastUpdate: 0,
    duration: 24 * 60 * 60 * 1000,
  };

  async getSchoolInfo(domain: string, isPreview = false): Promise<SchoolInfo | undefined> {
    const now = Date.now();
    if (now - this.state.lastUpdate > this.state.duration || this.schoolCache.size === 0) {
      try {
        await this.refreshCache(isPreview);
      } catch (error) {
        console.error('Cache refresh failed:', error);
      }
    }
    return this.schoolCache.get(domain);
  }

  private async refreshCache(isPreview: boolean): Promise<void> {
    const metadataUrl = isPreview
      ? 'https://dspre.carsi.edu.cn/carsifed-metadata-pre.xml'
      : 'https://www.carsi.edu.cn/carsimetadata/carsifed-metadata.xml';

    const response = await ky.get(metadataUrl, { timeout: 30_000 });
    const schools = parseXmlToSchools(await response.text());

    this.schoolCache.clear();
    for (const [key, value] of schools) {
      this.schoolCache.set(key, value);
    }
    this.state = {
      ...this.state,
      lastUpdate: Date.now(),
    };
  }
}

export const schoolCacheManager = new SchoolCacheManager();
