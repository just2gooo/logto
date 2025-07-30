import { z } from 'zod';

export const ailabConfigGuard = z.object({
  environment: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  // Scope: z.string().optional(),
  // RedirectUri: z.string().optional(),
});

export type AilabConfig = z.infer<typeof ailabConfigGuard>;

export const pubKeyResponseGuard = z.object({
  msgCode: z.string(),
  msg: z.string(),
  traceId: z.string(),
  success: z.boolean(),
  data: z.object({
    pubKey: z.string(),
  }),
});

export const accessTokenResponseGuard = z.object({
  msgCode: z.string(),
  msg: z.string(),
  traceId: z.string(),
  success: z.boolean(),
  data: z.object({
    ssoUid: z.string(),
    jwt: z.string(),
    expiration: z.string(),
  }),
});

export type AccessTokenResponse = z.infer<typeof accessTokenResponseGuard>;

export const userInfoResponseGuard = z.object({
  msgCode: z.string(),
  msg: z.string(),
  traceId: z.string(),
  success: z.boolean(),
  data: z.object({
    ssoUid: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    wechat: z.string().nullable().optional(),
    wechatName: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    nickname: z.string().nullable().optional(),
    githubAccount: z.string().nullable().optional(),
    googleId: z.string().nullable().optional(),
    roleIds: z.array(z.string()).nullable().optional(),
    badge: z.string().nullable().optional(),
    type: z.number().nullable().optional(),
  }),
});

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
