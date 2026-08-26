import * as integrationConfig from "../integrationConfig.service";
import { sendArogyaWhatsappOtp } from "../arogyaNotify.service";

describe("Arogya WhatsApp OTP — payload must match the legacy AiSensy template contract", () => {
  afterEach(() => jest.restoreAllMocks());

  it("sends every field the approved AiSensy 'Copy Code' template requires, not just apiKey/destination/templateParams", async () => {
    jest.spyOn(integrationConfig, "resolveOtpConfig").mockReturnValue({
      aisensy: { apiKey: "test-api-key", campaignOtp: "otpAuthentication" },
    });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendArogyaWhatsappOtp("9876543210", "Ravi Kumar", "482913");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://backend.aisensy.com/campaign/t1/api/v2");
    const payload = JSON.parse(options.body);

    expect(payload).toMatchObject({
      apiKey: "test-api-key",
      campaignName: "otpAuthentication",
      destination: "919876543210",
      userName: "Namo Gange Wellness Pvt. Ltd.",
      templateParams: ["482913"],
      source: "new-landing-page form",
      media: {},
      carouselCards: [],
      location: {},
      attributes: {},
      paramsFallbackValue: { FirstName: "Ravi" },
    });
    // The "Copy Code" button parameter is what previously stopped OTPs from arriving even though
    // the API call itself returned 200 OK — the button must repeat the OTP as its own parameter.
    expect(payload.buttons).toEqual([
      { type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: "482913" }] },
    ]);
  });

  it("throws when the AiSensy API call itself fails, so a silently-undelivered OTP surfaces as an error", async () => {
    jest.spyOn(integrationConfig, "resolveOtpConfig").mockReturnValue({
      aisensy: { apiKey: "test-api-key", campaignOtp: "otpAuthentication" },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "bad request" }) }) as unknown as typeof fetch;

    await expect(sendArogyaWhatsappOtp("9876543210", "Ravi", "111111")).rejects.toThrow("Failed to send OTP via WhatsApp");
  });
});
