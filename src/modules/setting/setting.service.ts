import { ISetting, Setting } from "../../models/setting.model";

/** There is always exactly one settings document — created lazily on first read. */
export async function getSettings(): Promise<ISetting> {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({ siteName: "Moksha Sewa", helplineNumber: "0000000000" });
  }
  return settings;
}

export async function updateSettings(data: Partial<ISetting>): Promise<ISetting> {
  const settings = await getSettings();
  Object.assign(settings, data);
  await settings.save();
  return settings;
}
