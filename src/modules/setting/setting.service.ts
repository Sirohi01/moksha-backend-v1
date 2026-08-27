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
  
  for (const key of Object.keys(data) as Array<keyof ISetting>) {
    // @ts-expect-error Typescript doesn't know all the dynamic keys on ISetting
    settings[key] = data[key];
    settings.markModified(key as string);
  }
  
  await settings.save();
  return settings;
}
