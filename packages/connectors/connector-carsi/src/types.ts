import { z } from 'zod';

export const carsiConfigGuard = z.object({
  environment: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  scope: z.string().optional(),
  rsaPrivateKey: z.string(),
  // RedirectUri: z.string().optional(),
});

export type CarsiConfig = z.infer<typeof carsiConfigGuard>;

export const accessTokenResponseGuard = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
});

export type AccessTokenResponse = z.infer<typeof accessTokenResponseGuard>;

export const userInfoResponseGuard = z
  .object({
    'carsi-affiliation': z.string(),
    'carsi-persistent-uid': z.string(),
    resource_id: z.string().optional(),
  })
  .transform((data) => ({
    carsiAffiliation: data['carsi-affiliation'],
    carsiPersistentUid: data['carsi-persistent-uid'],
    resourceId: data.resource_id,
  }));

export type UserInfoResponse = z.infer<typeof userInfoResponseGuard>;

export const authorizationCallbackErrorGuard = z.object({
  error: z.string(),
  error_description: z.string(),
});

export const authResponseGuard = z.object({ code: z.string(), redirectUri: z.string() });

export const getUserInfoErrorGuard = z.object({
  code: z.number(),
  description: z.string(),
  result: z.string(),
});
