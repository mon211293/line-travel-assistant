import { createRemoteJWKSet, jwtVerify } from "jose";

// LIFF 頁面用「ID Token」證明是哪個 LINE 使用者在操作,伺服器端要驗證這個 token
// 才能知道真正的 userId(不能直接信任前端傳來的 userId)。
// 在自己的伺服器上用 LINE 公開的 JWKS 直接驗簽章(ES256,LIFF 核發的 ID token 不是 HS256)。
const JWKS = createRemoteJWKSet(new URL("https://api.line.me/oauth2/v2.1/certs"));

export async function verifyLiffIdToken(idToken: string): Promise<string | null> {
  const clientId = process.env.LIFF_CHANNEL_ID;
  if (!clientId) return null;

  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: "https://access.line.me",
      audience: clientId,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
