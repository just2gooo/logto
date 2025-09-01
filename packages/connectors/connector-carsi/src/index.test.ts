import nock from 'nock';

import { testXmlParsing, parseCarsiMetadata } from './cache.js';

describe('parseCarsiMetadata', () => {
  afterEach(() => {
    nock.cleanAll();
    vi.clearAllMocks();
  });
  it('should parse CARSI metadata XML correctly in production', async () => {
    const schools = await parseCarsiMetadata(false);

    expect(schools.size).greaterThan(100);
  });

  it('should parse CARSI metadata XML correctly', async () => {
    // Mock the CARSI metadata XML response
    const mockXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<EntitiesDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
  <EntityDescriptor entityID="https://idp.pku.edu.cn/idp/shibboleth">
    <Extensions>
      <shibmd:Scope regexp="false">pku.edu.cn</shibmd:Scope>
      <mdui:UIInfo>
        <mdui:DisplayName xml:lang="zh">北京大学(Peking University)</mdui:DisplayName>
        <mdui:DisplayName xml:lang="en">Peking University</mdui:DisplayName>
      </mdui:UIInfo>
    </Extensions>
  </EntityDescriptor>
  <EntityDescriptor entityID="https://idp.tsinghua.edu.cn/idp/shibboleth">
    <Extensions>
      <shibmd:Scope regexp="false">tsinghua.edu.cn</shibmd:Scope>
      <mdui:UIInfo>
        <mdui:DisplayName xml:lang="zh">清华大学(Tsinghua University)</mdui:DisplayName>
        <mdui:DisplayName xml:lang="en">Tsinghua University</mdui:DisplayName>
      </mdui:UIInfo>
    </Extensions>
  </EntityDescriptor>
</EntitiesDescriptor>`;

    nock('https://www.carsi.edu.cn')
      .get('/carsimetadata/carsifed-metadata.xml')
      .reply(200, mockXmlResponse);

    const schools = await parseCarsiMetadata(false);

    expect(schools.size).toBe(2);
    expect(schools.get('pku.edu.cn')).toEqual({
      zh: '北京大学(Peking University)',
      en: 'Peking University',
      domain: 'pku.edu.cn',
    });
    expect(schools.get('tsinghua.edu.cn')).toEqual({
      zh: '清华大学(Tsinghua University)',
      en: 'Tsinghua University',
      domain: 'tsinghua.edu.cn',
    });
  });

  it('should handle preview environment metadata', async () => {
    const mockPreviewXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<EntitiesDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
  <EntityDescriptor entityID="https://test-idp.example.edu.cn/idp/shibboleth">
    <Extensions>
      <shibmd:Scope regexp="false">example.edu.cn</shibmd:Scope>
      <mdui:UIInfo>
        <mdui:DisplayName xml:lang="zh">测试大学(Test University)</mdui:DisplayName>
        <mdui:DisplayName xml:lang="en">Test University</mdui:DisplayName>
      </mdui:UIInfo>
    </Extensions>
  </EntityDescriptor>
</EntitiesDescriptor>`;

    nock('https://dspre.carsi.edu.cn')
      .get('/carsifed-metadata-pre.xml')
      .reply(200, mockPreviewXmlResponse);

    const schools = await parseCarsiMetadata(true);

    expect(schools.size).toBe(1);
    expect(schools.get('example.edu.cn')).toEqual({
      zh: '测试大学(Test University)',
      en: 'Test University',
      domain: 'example.edu.cn',
    });
  });

  it('should handle XML parsing errors gracefully', async () => {
    nock('https://www.carsi.edu.cn')
      .get('/carsimetadata/carsifed-metadata.xml')
      .reply(500, 'Internal Server Error');

    const schools = await parseCarsiMetadata(false);
    expect(schools.size).toBe(0);
  });

  it('should handle malformed XML gracefully', async () => {
    const malformedXml = '<malformed>xml<without>proper>closing>tags';

    nock('https://www.carsi.edu.cn')
      .get('/carsimetadata/carsifed-metadata.xml')
      .reply(200, malformedXml);

    const schools = await parseCarsiMetadata(false);
    expect(schools.size).toBe(0);
  });

  it('should filter out non-educational domains', async () => {
    const mockXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<EntitiesDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
  <EntityDescriptor entityID="https://idp.pku.edu.cn/idp/shibboleth">
    <Extensions>
      <shibmd:Scope regexp="false">pku.edu.cn</shibmd:Scope>
      <mdui:UIInfo>
        <mdui:DisplayName xml:lang="zh">北京大学(Peking University)</mdui:DisplayName>
        <mdui:DisplayName xml:lang="en">Peking University</mdui:DisplayName>
      </mdui:UIInfo>
    </Extensions>
  </EntityDescriptor>
  <EntityDescriptor entityID="https://idp.example.com/idp/shibboleth">
    <Extensions>
      <shibmd:Scope regexp="false">example.com</shibmd:Scope>
      <mdui:UIInfo>
        <mdui:DisplayName xml:lang="zh">示例网站</mdui:DisplayName>
        <mdui:DisplayName xml:lang="en">Example Site</mdui:DisplayName>
      </mdui:UIInfo>
    </Extensions>
  </EntityDescriptor>
</EntitiesDescriptor>`;

    nock('https://www.carsi.edu.cn')
      .get('/carsimetadata/carsifed-metadata.xml')
      .reply(200, mockXmlResponse);

    const schools = await parseCarsiMetadata(false);

    // 应该只包含.edu.cn域名
    expect(schools.size).toBe(1);
    expect(schools.has('pku.edu.cn')).toBe(true);
    expect(schools.has('example.com')).toBe(false);
  });

  it('should filter out XML comments before parsing', async () => {
    const mockXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<EntitiesDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
  <EntityDescriptor entityID="https://carsi-idp.bipt.edu.cn/idp/shibboleth">
    <Extensions>
      <shibmd:Scope regexp="false">bipt.edu.cn</shibmd:Scope>
      <!--
          Fill in the details for your IdP here
          <mdui:UIInfo>
              <mdui:DisplayName xml:lang="en">A Name for the IdP at carsi-idp.bipt.edu.cn</mdui:DisplayName>
              <mdui:Description xml:lang="en">Enter a description of your IdP at carsi-idp.bipt.edu.cn</mdui:Description>
          </mdui:UIInfo>
      -->
      <mdui:UIInfo>
        <mdui:DisplayName xml:lang="zh">北京石油化工学院(Beijing Institute of Petrochemical Technology)</mdui:DisplayName>
        <mdui:DisplayName xml:lang="en">Beijing Institute of Petrochemical Technology</mdui:DisplayName>
      </mdui:UIInfo>
    </Extensions>
  </EntityDescriptor>
  <EntityDescriptor entityID="https://idp.test.edu.cn/idp/shibboleth">
    <Extensions>
      <shibmd:Scope regexp="false">test.edu.cn</shibmd:Scope>
      <mdui:UIInfo>
        <mdui:DisplayName xml:lang="zh">测试大学</mdui:DisplayName>
        <mdui:DisplayName xml:lang="en">Test University</mdui:DisplayName>
      </mdui:UIInfo>
    </Extensions>
  </EntityDescriptor>
</EntitiesDescriptor>`;

    nock('https://www.carsi.edu.cn')
      .get('/carsimetadata/carsifed-metadata.xml')
      .reply(200, mockXmlResponse);

    const schools = await parseCarsiMetadata(false);

    // 应该正确解析两个学校，注释中的占位符文本不会影响解析
    expect(schools.size).toBe(2);
    expect(schools.has('bipt.edu.cn')).toBe(true);
    expect(schools.has('test.edu.cn')).toBe(true);

    // 验证北京石油化工学院的信息
    const biptSchool = schools.get('bipt.edu.cn');
    expect(biptSchool).toEqual({
      zh: '北京石油化工学院(Beijing Institute of Petrochemical Technology)',
      en: 'Beijing Institute of Petrochemical Technology',
      domain: 'bipt.edu.cn',
    });

    // 验证测试大学的信息
    const testSchool = schools.get('test.edu.cn');
    expect(testSchool).toEqual({
      zh: '测试大学',
      en: 'Test University',
      domain: 'test.edu.cn',
    });
  });
});

describe('testXmlParsing', () => {
  it('should test XML parsing functionality', async () => {
    const mockXmlResponse = `
      <?xml version="1.0" encoding="UTF-8"?>
      <md:EntitiesDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
        <md:EntityDescriptor entityID="https://idp.test.edu.cn/idp/shibboleth">
          <md:Extensions>
            <shibmd:Scope regexp="false">test.edu.cn</shibmd:Scope>
            <mdui:UIInfo>
              <mdui:DisplayName xml:lang="zh">测试大学</mdui:DisplayName>
              <mdui:DisplayName xml:lang="en">Test University</mdui:DisplayName>
            </mdui:UIInfo>
          </md:Extensions>
        </md:EntityDescriptor>
      </md:EntitiesDescriptor>
    `;

    nock('https://www.carsi.edu.cn')
      .get('/carsimetadata/carsifed-metadata.xml')
      .reply(200, mockXmlResponse);

    // 这个测试主要是验证函数不会抛出错误
    await expect(testXmlParsing(false)).resolves.not.toThrow();
  });
});
