/** Contract every SMS/OTP agency adapter must implement, so swapping providers never touches business logic. */
export interface OtpProvider {
  sendOtp(phone: string, otp: string): Promise<void>;
}
