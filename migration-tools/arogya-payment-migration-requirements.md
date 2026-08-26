# Arogya Payment Migration Requirements

This document extracts the exact payment integration state and vulnerabilities from `backend-arogya` to serve as a specification for the Phase 11 Payment Persistence build.

## 1. Untrustworthy `DelegateRegistration` Fields

The `DelegateRegistration` model (`backend-arogya/models/delegate/DelegateRegistration.js`) contains payment-adjacent fields that are currently populated entirely by client-supplied data without server-side validation.

*   **`price` (String, line 13):** Sent directly from the client and saved.
*   **`transactionId` (String, line 17):** Sent directly from the client.
*   **`isVerified` (Boolean, default: false, line 91):** The controller explicitly forces this to `true` upon any successful OTP verification (e.g., `backend-arogya/controllers/delegate/delegateController.js` line 100 in `verifyGroupRegistration`, and line 211 in `verifyRegistration`), regardless of whether a payment actually occurred or was verified.

**Vulnerability:** The registration endpoints (`verifyRegistration` and `verifyGroupRegistration`) accept the entire `req.body` as `delegateData` and spread it into the new document (`...delegateData`). A malicious client can simply pass `price: "0"`, `transactionId: "fake_id"`, and `isVerified: true` during the OTP verification step, completely bypassing payment verification.

## 2. Razorpay Integration Surface

The current Razorpay integration is bare-bones and lacks several critical pieces for a robust payment system.

**Location:** `backend-arogya/controllers/paymentController.js`

*   **Routes & Controllers:**
    *   `POST /api/payment/create-order` -> `createOrder` (line 16)
    *   `POST /api/payment/verify` -> `verifyPayment` (line 54)
*   **Credentials:** Both the key and secret are **hardcoded** directly in the file, not read from environment variables.
    *   Key ID (`rzp_test_RTd9y3ngRanKxq`): Hardcoded at line 7 and line 41.
    *   Key Secret (`bxH0R4Mbz5x3lC7XMWPezN4m`): Hardcoded at line 8 and line 61.
*   **Missing Infrastructure:**
    *   **No Webhook:** There is no webhook endpoint to handle asynchronous payment success/failure events (e.g., `payment.captured`, `payment.failed`). The system relies entirely on the client reporting success to `/api/payment/verify`.
    *   **No Persistence Models:** There are no `Order` or `Payment` collections. `paymentController.js` creates a Razorpay order but does not save the order ID to the database. `verifyPayment` verifies the signature but does not record the payment state anywhere.
    *   **No Refunds:** There is no refund logic or route.

## 3. The Coupon Discount Trust Gap

The current system trusts the client to compute the final price after discounts.

**Vulnerability Location:** `backend-arogya/controllers/paymentController.js` (line 18)

```javascript
// line 18
const { amount, currency } = req.body;

// line 24
const options = {
    amount: amount, // amount in the smallest currency unit
    currency: currency || "INR",
    receipt: `receipt_order_${Math.floor(Math.random() * 10000)}`,
};
const order = await razorpay.orders.create(options);
```

**The Gap:** The `createOrder` endpoint takes `amount` directly from `req.body` and creates a Razorpay order for that exact amount. The server never queries the `Coupon` model, never checks the base price of the `planName`, and never calculates the discounted total itself. A client can pass `{ amount: 100 }` (₹1.00) for a ₹10,000 ticket and the server will blindly authorize it.

## 4. OTP Bypass Strings

For testing and demonstration, several literal strings can bypass OTP verification across different endpoints.

**Location:** `backend-arogya/controllers/delegate/delegateController.js`

*   **Registration Verification (`verifyGroupRegistration` - line 84, and `verifyRegistration` - line 198):**
    ```javascript
    if (otp === 'VERIFIED_WEBSITE' || otp === 'VERIFIED_DIRECT' || otp === 'WEBSITE_SUBMIT') validOtp = true;
    ```
*   **Login Verification (`verifyLoginDelegate` - line 453):**
    ```javascript
    if (otp === '123456' || otp === 'VERIFIED_LOGIN') isValid = true; // master bypass for testing/demo
    ```
