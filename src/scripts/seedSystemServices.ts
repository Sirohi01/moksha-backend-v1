import { connectDB, disconnectDB } from "../config/db";
import { ExternalService, ExternalServiceCategory } from "../models/externalService.model";
import { env } from "../config/env";

const futureDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 999);
  return date;
};

const started = (monthsAgo = 10) => {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date;
};

type DemoService = {
  category: ExternalServiceCategory;
  name: string;
  provider: string;
  accountIdentifier?: string;
  loginUrl?: string;
  secretLabel?: string;
  secretValue?: string;
  expiryDays: number;
  pricingType: "FREE" | "PAID";
  costAmount?: number;
  billingCycle?: "ONE_TIME" | "MONTHLY" | "YEARLY";
  details: Record<string, string>;
};

const demos: DemoService[] = [
  { category: "DOMAIN", name: "Demo Domain", provider: "GoDaddy", accountIdentifier: "domains@example.org", loginUrl: "https://dcc.godaddy.com/", secretLabel: "Registrar Password / Auth Code", secretValue: "demo-domain-secret-not-real", expiryDays: 330, pricingType: "PAID", costAmount: 999, billingCycle: "YEARLY", details: { domainName: "demo-mokshasewa.example", registrar: "GoDaddy", dnsProvider: "Cloudflare", nameservers: "ns1.example.net, ns2.example.net", registrantEmail: "domains@example.org" } },
  { category: "HOSTING", name: "Demo Production Server", provider: "Hostinger", accountIdentifier: "server-admin@example.org", loginUrl: "https://hpanel.hostinger.com/", secretLabel: "SSH Password / API Token", secretValue: "demo-ssh-token-not-real", expiryDays: 25, pricingType: "PAID", costAmount: 1899, billingCycle: "MONTHLY", details: { serverType: "Managed VPS", publicIp: "203.0.113.10", region: "Mumbai, India", operatingSystem: "Ubuntu 24.04 LTS", specification: "4 vCPU · 8 GB RAM · 160 GB NVMe", backupFrequency: "Daily · 14-day retention" } },
  { category: "SSL_CERTIFICATE", name: "Demo SSL Certificate", provider: "Let's Encrypt", expiryDays: 60, pricingType: "FREE", details: { coveredDomains: "demo-mokshasewa.example, www.demo-mokshasewa.example", issuer: "Let's Encrypt", certificateType: "DV · Multi-domain" } },
  { category: "PAYMENT_GATEWAY", name: "Demo Payment Gateway", provider: "Razorpay", accountIdentifier: "finance@example.org", loginUrl: "https://dashboard.razorpay.com/", secretLabel: "API Key / Secret", secretValue: "rzp_test_demo_key_not_real", expiryDays: 365, pricingType: "PAID", costAmount: 0, billingCycle: "MONTHLY", details: { merchantId: "DEMO_MERCHANT_1001", environment: "Test", settlementCycle: "T+2 working days", webhookUrl: "https://demo-mokshasewa.example/api/webhooks/razorpay" } },
  { category: "EMAIL_SMTP", name: "Demo Transactional Email", provider: "Google Workspace", accountIdentifier: "notifications@example.org", loginUrl: "https://admin.google.com/", secretLabel: "SMTP Password", secretValue: "demo-app-password-not-real", expiryDays: 180, pricingType: "PAID", costAmount: 736, billingCycle: "MONTHLY", details: { smtpHost: "smtp.gmail.com", smtpPort: "587", encryption: "STARTTLS", senderEmail: "notifications@example.org", dailyLimit: "2,000 emails" } },
  { category: "SMS_WHATSAPP", name: "Demo WhatsApp Messaging", provider: "AiSensy", accountIdentifier: "support@example.org", loginUrl: "https://dashboard.aisensy.com/", secretLabel: "Access Token / API Key", secretValue: "demo-whatsapp-token-not-real", expiryDays: 12, pricingType: "PAID", costAmount: 1600, billingCycle: "MONTHLY", details: { phoneNumber: "+91 90000 00000", wabaId: "DEMO_WABA_123456", phoneNumberId: "DEMO_PHONE_ID_7890", templateNamespace: "moksha_demo_templates", webhookUrl: "https://demo-mokshasewa.example/api/webhooks/whatsapp", messageLimit: "10,000 conversations/month" } },
  { category: "MEDIA_STORAGE", name: "Demo Media Storage", provider: "Cloudinary", accountIdentifier: "media@example.org", loginUrl: "https://console.cloudinary.com/", secretLabel: "API Secret", secretValue: "demo-cloudinary-secret-not-real", expiryDays: 365, pricingType: "FREE", details: { bucketName: "moksha-demo-media", region: "Asia Pacific", storageLimit: "25 GB", deliveryUrl: "https://res.cloudinary.com/demo-moksha" } },
  { category: "AI_API", name: "Demo AI Content API", provider: "Google Gemini", accountIdentifier: "ai-project@example.org", loginUrl: "https://aistudio.google.com/", secretLabel: "API Key", secretValue: "demo-ai-key-not-real", expiryDays: 90, pricingType: "PAID", costAmount: 1200, billingCycle: "MONTHLY", details: { model: "Gemini 2.5 Flash", projectId: "moksha-demo-ai-project", usageLimit: "₹1,500 monthly budget", apiBaseUrl: "https://generativelanguage.googleapis.com" } },
  { category: "ANALYTICS", name: "Demo Website Analytics", provider: "Google Analytics 4", accountIdentifier: "analytics@example.org", loginUrl: "https://analytics.google.com/", secretLabel: "Service Account Reference", secretValue: "demo-service-account-reference", expiryDays: 365, pricingType: "FREE", details: { propertyId: "123456789", measurementId: "G-DEMO123456", streamUrl: "https://demo-mokshasewa.example" } },
  { category: "DATABASE", name: "Demo Production Database", provider: "MongoDB Atlas", accountIdentifier: "database-admin@example.org", loginUrl: "https://cloud.mongodb.com/", secretLabel: "Database Password", secretValue: "demo-database-password-not-real", expiryDays: 365, pricingType: "FREE", details: { engine: "MongoDB 8.0", clusterHost: "demo-cluster.mongodb.net", databaseName: "moksha_demo", region: "AWS Mumbai (ap-south-1)", backupPolicy: "Daily snapshot · 30-day retention" } },
  { category: "CDN", name: "Demo CDN And DNS", provider: "Cloudflare", accountIdentifier: "webops@example.org", loginUrl: "https://dash.cloudflare.com/", secretLabel: "API Token", secretValue: "demo-cloudflare-token-not-real", expiryDays: 365, pricingType: "FREE", details: { zoneId: "DEMO_ZONE_ABC123", distributionDomain: "cdn.demo-mokshasewa.example", origin: "origin.demo-mokshasewa.example" } },
  { category: "SOFTWARE_LICENSE", name: "Demo Design Licence", provider: "Canva", accountIdentifier: "design@example.org", loginUrl: "https://www.canva.com/settings/billing-and-plans", secretLabel: "Licence Key", secretValue: "DEMO-LICENCE-NOT-REAL", expiryDays: 45, pricingType: "PAID", costAmount: 499, billingCycle: "MONTHLY", details: { product: "Canva Teams", seats: "5", assignedTo: "Design and social media team", version: "Cloud subscription" } },
  { category: "SOCIAL_MEDIA", name: "Demo Meta Business Account", provider: "Meta", accountIdentifier: "social@example.org", loginUrl: "https://business.facebook.com/", secretLabel: "Access Token", secretValue: "demo-meta-token-not-real", expiryDays: 120, pricingType: "FREE", details: { platform: "Facebook and Instagram", accountHandle: "@mokshasewa_demo", adAccountId: "act_DEMO10001", businessManagerId: "DEMO_BM_20002" } },
  { category: "API_SERVICE", name: "Demo PageSpeed API", provider: "Google Cloud", accountIdentifier: "developers@example.org", loginUrl: "https://console.cloud.google.com/apis/", secretLabel: "API Key", secretValue: "demo-pagespeed-key-not-real", expiryDays: 365, pricingType: "FREE", details: { baseUrl: "https://pagespeedonline.googleapis.com/pagespeedonline/v5", projectId: "moksha-demo-web-tools", quota: "25,000 queries/day", apiVersion: "v5" } },
  { category: "OTHER", name: "Demo Support Contract", provider: "Example Technology Partner", accountIdentifier: "operations@example.org", secretLabel: "Password / Secret", secretValue: "demo-support-pin-not-real", expiryDays: 75, pricingType: "PAID", costAmount: 15000, billingCycle: "YEARLY", details: { reference: "DEMO-CONTRACT-2026-01", supportContact: "support@example.org · +91 90000 00001" } },
];

const websiteUrl = new URL(env.WEBSITE_URL);
const realDetails: Partial<Record<ExternalServiceCategory, Record<string, string>>> = {
  DOMAIN: {
    domainName: websiteUrl.hostname,
    registrar: "GoDaddy",
    dnsProvider: "Cloudflare",
    nameservers: "Add Current Nameservers",
    registrantEmail: "Add Domain Owner Email",
  },
  HOSTING: {
    publicIp: "Add Production Server IP",
    region: "Add Server Region",
    backupFrequency: "Daily Recommended",
  },
  SSL_CERTIFICATE: {
    coveredDomains: `${websiteUrl.hostname}, www.${websiteUrl.hostname}`,
  },
  PAYMENT_GATEWAY: {
    merchantId: "Add Razorpay Merchant ID",
    environment: "Live",
    webhookUrl: `${websiteUrl.origin}/api/webhooks/razorpay`,
  },
  EMAIL_SMTP: {
    senderEmail: `notifications@${websiteUrl.hostname}`,
  },
  SMS_WHATSAPP: {
    phoneNumber: "Add Active WhatsApp Number",
    wabaId: "Add WhatsApp Business Account ID",
    phoneNumberId: "Add WhatsApp Phone Number ID",
    webhookUrl: `${websiteUrl.origin}/api/webhooks/whatsapp`,
  },
  MEDIA_STORAGE: {
    bucketName: "Moksha Sewa Media",
    deliveryUrl: "Add Cloudinary Delivery URL",
  },
  AI_API: {
    projectId: "Add Google Cloud Project ID",
  },
  ANALYTICS: {
    propertyId: env.GA4_PROPERTY_ID ?? "Add GA4 Property ID",
    measurementId: "G-R0HTG1VXM6",
    streamUrl: websiteUrl.origin,
  },
  DATABASE: {
    clusterHost: "Add MongoDB Atlas Cluster Host",
    databaseName: "Moksha Sewa Production",
  },
  CDN: {
    zoneId: "Add Cloudflare Zone ID",
    distributionDomain: websiteUrl.hostname,
    origin: websiteUrl.hostname,
  },
  SOCIAL_MEDIA: {
    accountHandle: "Add Moksha Sewa Account Handle",
    adAccountId: "Add Advertising Account ID",
    businessManagerId: "Add Business Manager ID",
  },
  API_SERVICE: {
    projectId: "Add PageSpeed Google Cloud Project ID",
  },
  OTHER: {
    reference: "Add Contract Reference",
    supportContact: "Add Support Email Or Phone",
  },
};

const cleanPreviewValue = (value: string) => value
  .replace(/demo-mokshasewa\.example/gi, websiteUrl.hostname)
  .replace(/demo[-_ ]?/gi, "")
  .replace(/\s{2,}/g, " ")
  .trim();

async function seed() {
  await connectDB();
  let created = 0;
  let updated = 0;
  for (const demo of demos) {
    const demoKey = `system-service-${demo.category.toLowerCase()}`;
    let item = await ExternalService.findOne({ "details.demoKey": demoKey });
    const payload = {
      ...demo,
      name: demo.name.replace(/^Demo\s+/, ""),
      accountIdentifier: undefined,
      secretValue: undefined,
      startDate: started(),
      expiryDate: futureDate(demo.expiryDays),
      autoRenews: demo.pricingType === "PAID",
      remindersEnabled: true,
      currency: "INR",
      receipts: [],
      popupReminderDays: 30,
      emailReminderDays: 15,
      notes: `Operational details for ${demo.name.replace(/^Demo\s+/, "").toLowerCase()}. Complete any field marked “Add” with the value from the provider dashboard.`,
      details: {
        ...Object.fromEntries(Object.entries(demo.details).map(([key, value]) => [key, cleanPreviewValue(value)])),
        ...(realDetails[demo.category] ?? {}),
        demoKey,
      },
    };
    const { expiryDays: _expiryDays, ...document } = payload;
    if (item) {
      item.set(document);
      item.accountIdentifier = undefined;
      item.secretValue = undefined;
      await item.save();
      updated += 1;
    } else {
      item = new ExternalService(document);
      await item.save();
      created += 1;
    }
  }
  console.log(`System service demos ready: ${created} created, ${updated} updated, ${demos.length} total.`);
  await disconnectDB();
}

seed().catch(async (error) => {
  console.error("System service demo seed failed:", error instanceof Error ? error.message : error);
  await disconnectDB();
  process.exitCode = 1;
});
