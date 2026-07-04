import Taro from "@tarojs/taro";

export interface LoginSession {
  userId: string;
  sessionToken: string;
  expiresAt: string;
}

export async function requestWechatLoginCode(): Promise<string> {
  const result = await Taro.login();
  if (!result.code) {
    throw new Error("微信登录授权失败");
  }
  return result.code;
}

export async function loginWithServer(apiBaseUrl: string): Promise<LoginSession> {
  const code = await requestWechatLoginCode();
  const response = await Taro.request<LoginSession>({
    url: `${apiBaseUrl}/v1/auth/wechat-login`,
    method: "POST",
    data: { code }
  });

  if (!response.data?.sessionToken || !response.data.userId || !response.data.expiresAt) {
    throw new Error("登录服务返回异常");
  }

  return response.data;
}
