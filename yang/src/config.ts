import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  youtubeApiKey: requireEnv("YOUTUBE_API_KEY"),
  regionCode: process.env.REGION_CODE ?? "KR",
  dbPath: process.env.DB_PATH ?? "./trend.db",
};
