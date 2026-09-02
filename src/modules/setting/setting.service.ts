import { ISetting, Setting } from "../../models/setting.model";

const SETTINGS_CACHE_TTL_MS = 60_000;
let cachedSettings: ISetting | null = null;
let cachedAt = 0;
let settingsInFlight: Promise<ISetting> | null = null;

/** There is always exactly one settings document — created lazily on first read. */
export async function getSettings(): Promise<ISetting> {
  if (cachedSettings && Date.now() - cachedAt < SETTINGS_CACHE_TTL_MS) return cachedSettings;
  if (settingsInFlight) return settingsInFlight;

  settingsInFlight = (async () => {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({ siteName: "Moksha Sewa", helplineNumber: "0000000000" });
    }
    cachedSettings = settings;
    cachedAt = Date.now();
    return settings;
  })().finally(() => { settingsInFlight = null; });

  return settingsInFlight;
}

export async function updateSettings(data: Partial<ISetting>): Promise<ISetting> {
  const settings = await getSettings();
  
  for (const key of Object.keys(data) as Array<keyof ISetting>) {
    // @ts-expect-error Typescript doesn't know all the dynamic keys on ISetting
    settings[key] = data[key];
    settings.markModified(key as string);
  }
  
  await settings.save();
  cachedSettings = settings;
  cachedAt = Date.now();
  return settings;
}
