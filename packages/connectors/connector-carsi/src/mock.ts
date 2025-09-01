export const mockedConfig = {
  clientId: '<client-id>',
  clientSecret: '<client-secret>',
  redirectUri: 'http://localhost:3000/callback',
  environment: 'production',
  rsaPrivateKey: '<rsa-private-key>',
};

export const mockedAccessTokenResponse = {
  access_token: 'access_token',
  expires_in: 3600,
  refresh_token: 'refresh_token',
  scope: '1',
  openId: 'openId',
  union_id: 'union_id',
};

export const mockedUserInfoResponse = {
  result: 'ok',
  code: 0,
  description: 'no error',
  data: {
    'carsi-affiliation': 'faculty@test.edu.cn',
    'carsi-persistent-uid': 'test_user_id',
    resource_id: 'test_resource_id',
  },
};
