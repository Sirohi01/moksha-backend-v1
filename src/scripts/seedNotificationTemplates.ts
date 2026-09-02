import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { NotificationTemplate } from "../models/notificationTemplate.model";
import { NotificationChannel, NotificationCategory } from "../utils/constants";
import { p, pLast, muted, callout, button } from "../lib/emailFragments";

interface TemplateSeed {
  key: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  subject?: string;
  body: string;
}

// Every template's `body` is an HTML *fragment* — emailShell.ts wraps it in the full branded
// document (header/footer, table layout) right before sending. p/pLast/muted/callout/button (from
// lib/emailFragments.ts) keep that fragment's own styling consistent across templates and with
// any other direct sendEmail() caller that wants the same look (e.g. systemServiceReminder.service.ts).

const TEMPLATES: TemplateSeed[] = [
  {
    key: "request.received",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "We've received your request — {{requestNo}}",
    body:
      p("Namaste {{name}},") +
      p(
        "We're deeply sorry for your loss. Your request for assistance has been received, and our team is " +
        "already reviewing it. Please keep this reference number — you can use it to track progress any time:"
      ) +
      callout("{{requestNo}}") +
      pLast("Someone from our team will reach out to you shortly."),
  },
  {
    key: "newsletter.subscribed",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Thank you for reaching out — Moksha Sewa",
    body:
      p("Namaste,") +
      pLast("Thank you for sharing your email with us. Our support team will contact you shortly."),
  },
  {
    key: "enquiry.received",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "We've received your message — Moksha Sewa",
    body:
      p("Namaste {{name}},") +
      p("Thank you for reaching out. We've received your message and our team will get back to you shortly:") +
      callout("&ldquo;{{message}}&rdquo;") +
      pLast("If your matter is urgent, please call our helpline directly."),
  },
  {
    key: "csr.enquiry_received",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "CSR partnership enquiry received — Moksha Sewa",
    body:
      p("Namaste {{name}},") +
      p("Thank you for considering a responsible CSR collaboration with Moksha Sewa. We have received your enquiry for {{organization}}.") +
      callout("Your CSR partnership enquiry is under review") +
      pLast("Our team will review the information and contact you through the details provided."),
  },
  {
    key: "partnership.enquiry_received",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Partnership enquiry received — Moksha Sewa",
    body:
      p("Namaste {{name}},") +
      p("Thank you for reaching out to explore a partnership with Moksha Sewa. We have received your proposal for {{organization}}.") +
      callout("Your partnership enquiry is under review") +
      pLast("Our team will study the proposal and contact you shortly."),
  },
  {
    key: "unclaimed_body.request_received",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Unclaimed Body Sewa request received — Moksha Sewa",
    body:
      p("Namaste {{name}},") +
      p("We have received your Unclaimed Body Sewa request for {{city}}. Our team will review the case information, applicable formalities and available authorisation.") +
      callout("Your Sewa request is under verification") +
      pLast("Submission does not guarantee acceptance. Our team will contact you if further information or documentation is required."),
  },
  {
    key: "user.welcome",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Welcome to Moksha Sewa",
    body: p("Namaste {{name}},") + pLast("Your account has been created successfully."),
  },
  {
    key: "volunteer.registered",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Welcome to the Moksha Sewa Volunteer Team",
    body:
      p("Namaste {{name}},") +
      pLast(
        "Thank you for registering as a Moksha Sewa volunteer in {{city}}. Our team will verify your details " +
        "and reach out when a case near you needs support."
      ),
  },
  {
    key: "volunteer.assigned",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "You've been assigned to a case — {{caseId}}",
    body:
      p("Namaste {{name}},") +
      p("You have been assigned as <strong>{{role}}</strong> on the following case in {{city}}:") +
      callout("Case {{caseId}}") +
      pLast("Please log in to your volunteer dashboard to accept or decline this assignment."),
  },
  {
    key: "family.case_created",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Your case is being set up — {{caseId}}",
    body:
      p("Namaste {{requesterName}},") +
      p("Our team has begun working on your request. Please save this Case ID — use it (with your phone number) to track progress any time:") +
      callout("{{caseId}}") +
      pLast("Your original reference {{requestNo}} will also still work for tracking."),
  },
  {
    key: "family.case_status_update",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Update on your request — {{caseId}}",
    body:
      p("Namaste {{requesterName}},") +
      p("There's an update on your case:") +
      callout("{{caseId}} — {{statusLabel}}") +
      pLast("You can track full progress any time using your Case ID and phone number."),
  },
  {
    key: "staff.invited",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Your Moksha Sewa staff account has been created",
    body:
      p("Namaste {{name}},") +
      p("An account has been created for you on the Moksha Sewa admin panel as <strong>{{roleName}}</strong>.") +
      muted("Email: {{email}}") +
      callout("Temporary password: {{tempPassword}}") +
      pLast("Please log in and change this password as soon as possible."),
  },
  {
    key: "donation.thankyou",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Thank you for your generosity",
    body:
      p("Namaste {{name}},") +
      p("Thank you for your donation to Moksha Sewa:") +
      callout("₹{{amount}}") +
      pLast("Your generosity helps families receive a dignified farewell, free of cost."),
  },
  {
    key: "volunteer.withdrawn",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "You've been unassigned from case {{caseId}}",
    body:
      p("Namaste {{name}},") +
      p("You have been unassigned from the following case:") +
      callout("Case {{caseId}}") +
      muted("Reason: {{reason}}") +
      pLast("Thank you for your willingness to help — new cases in your area will still come your way."),
  },
  {
    key: "expense.decided",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Your expense claim was {{decision}}",
    body:
      p("Namaste {{name}},") +
      p("Your expense claim ({{category}}) has been <strong>{{decision}}</strong>:") +
      callout("₹{{amount}}") +
      pLast("Remark: {{remark}}"),
  },
  {
    key: "staff.status_changed",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Your Moksha Sewa staff account status has changed",
    body:
      p("Namaste {{name}},") +
      p("Your staff account status has been updated to:") +
      callout("{{status}}") +
      pLast("If this wasn't expected, please contact your administrator."),
  },
  {
    key: "auth.password_changed",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Your Moksha Sewa password was changed",
    body:
      p("Namaste {{name}},") +
      pLast(
        "Your account password was just changed, and every other session has been signed out. " +
        "If this wasn't you, contact an administrator immediately."
      ),
  },
  {
    key: "auth.password_reset_requested",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "Reset your Moksha Sewa password",
    body:
      p("Namaste {{name}},") +
      p("We received a request to reset your Moksha Sewa admin password. Click below to choose a new one:") +
      button("{{resetUrl}}", "Reset Password") +
      pLast("This link expires in 30 minutes. If you didn't request this, you can safely ignore this email — your password will not be changed."),
  },
  {
    key: "donation.recurring_payment_failed",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    subject: "We couldn't process your recurring donation",
    body:
      p("Namaste {{name}},") +
      p("We were unable to process your recurring donation after repeated attempts, and it has been paused:") +
      callout("₹{{amount}} / month") +
      pLast("Please log in to update your payment method if you'd like to continue supporting Moksha Sewa."),
  },
];

export async function seedNotificationTemplates(): Promise<void> {
  for (const t of TEMPLATES) {
    await NotificationTemplate.findOneAndUpdate(
      { key: t.key },
      { key: t.key, channel: t.channel, category: t.category, subject: t.subject, body: t.body, isActive: true },
      { upsert: true }
    );
  }
  logger.info(`Seeded ${TEMPLATES.length} notification templates`);
}

if (require.main === module) {
  connectDB()
    .then(seedNotificationTemplates)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed notification templates", { err });
      process.exit(1);
    });
}
