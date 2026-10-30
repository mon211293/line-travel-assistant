import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { getBoundGroupId } from "./targetGroupStore";

const secretClient = new SecretManagerServiceClient();

// 每次呼叫都直接讀 Secret Manager 的最新版本,不做跨 invocation 的記憶體快取。
// Cloud Functions 的執行環境可能被重複使用(warm instance),若快取在模組層級的變數裡,
// 換了 secret 版本(例如換推播目標的群組 ID)後,沿用舊執行環境的呼叫會讀到快取的舊值。
async function getSecret(name: string): Promise<string> {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) throw new Error("GCP_PROJECT_ID env var is required");

  const [version] = await secretClient.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/latest`,
  });
  const value = version.payload?.data?.toString();
  if (!value) throw new Error(`Secret ${name} has no payload`);

  return value;
}

export interface AppConfig {
  line: {
    channelAccessToken: string;
    channelSecret: string;
    targetGroupId: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  calendarId: string;
  /** 因為觸發來源(GitHub Actions)無法做 Google OIDC 驗證,函式改為公開網址,
   * 靠這組共用密碼(存在 Secret Manager 的 TRAVEL_TRIGGER_SECRET)擋掉未授權的呼叫。 */
  triggerSecret: string;
}

export async function loadConfig(): Promise<AppConfig> {
  const [
    lineChannelAccessToken,
    lineChannelSecret,
    lineTargetGroupId,
    googleClientId,
    googleClientSecret,
    googleRefreshToken,
    calendarId,
    triggerSecret,
  ] = await Promise.all([
    getSecret("TRAVEL_LINE_CHANNEL_ACCESS_TOKEN"),
    getSecret("TRAVEL_LINE_CHANNEL_SECRET"),
    getSecret("TRAVEL_TARGET_GROUP_ID"),
    getSecret("GOOGLE_OAUTH_CLIENT_ID"),
    getSecret("GOOGLE_OAUTH_CLIENT_SECRET"),
    getSecret("GOOGLE_OAUTH_REFRESH_TOKEN"),
    getSecret("TRAVEL_CALENDAR_ID"),
    getSecret("TRAVEL_TRIGGER_SECRET"),
  ]);

  // 在群組裡打「綁定群組」記下的 ID 優先於 Secret 裡的預設值,這樣換群組不用動 Secret。
  const boundGroupId = await getBoundGroupId();

  return {
    line: {
      channelAccessToken: lineChannelAccessToken,
      channelSecret: lineChannelSecret,
      targetGroupId: boundGroupId ?? lineTargetGroupId,
    },
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      refreshToken: googleRefreshToken,
    },
    calendarId,
    triggerSecret,
  };
}
