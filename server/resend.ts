/**
 * MeetFlow Resend Email Service (Server-side ONLY)
 *
 * Secure integration with Resend API for sending password reset OTP emails.
 *
 * Security requirements:
 * - RESEND_API_KEY is read strictly from server environment variables.
 * - Key is NEVER sent to frontend, client logs, or browser.
 * - OTP is NEVER logged or exposed.
 * - Plaintext passwords or internal DB details are NEVER included.
 * - In case of failure, generic user-safe error message is returned.
 */

export interface SendOtpResult {
  success: boolean;
  error?: string;
}

export async function sendPasswordResetOtpEmail(
  personalEmail: string,
  otp: string
): Promise<SendOtpResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    console.error('Resend service notice: RESEND_API_KEY is not configured on server.');
    return {
      success: false,
      error: "We couldn't send the verification email right now. Please try again.",
    };
  }

  try {
    // Verified sender domain for Resend - support custom sender or default to onboarding@resend.dev
    const fromAddress =
      process.env.RESEND_FROM_EMAIL || 'MeetFlow <onboarding@resend.dev>';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MeetFlow Password Reset OTP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0914; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0914; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #131126; border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid rgba(139, 92, 246, 0.15);">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Meet<span style="color: #8b5cf6;">Flow</span>
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 13px; font-weight: 600; color: #a78bfa; text-transform: uppercase; letter-spacing: 1.2px;">
                Password Reset Verification
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #e2e8f0;">
                Hello,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                We received a request to reset your MeetFlow account password. Please use the verification code below to complete the process:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0; background-color: #0c0a1b; border: 1px dashed rgba(139, 92, 246, 0.45); border-radius: 12px;">
                <tr>
                  <td style="padding: 24px 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 10px;">
                      Your 6-digit verification code is:
                    </div>
                    <div style="font-family: 'Courier New', Courier, monospace, monospace; font-size: 38px; font-weight: 700; letter-spacing: 8px; color: #ffffff; padding: 4px 0;">
                      ${otp}
                    </div>
                    <div style="margin-top: 12px; font-size: 12px; color: #a78bfa;">
                      This code will expire in <strong style="color: #ffffff;">10 minutes</strong>.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="padding: 16px; background-color: rgba(139, 92, 246, 0.08); border-radius: 10px; border-left: 3px solid #8b5cf6; margin-top: 24px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                  <strong style="color: #cbd5e1;">Security Notice:</strong> If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px 36px; text-align: center; border-top: 1px solid rgba(139, 92, 246, 0.12); background-color: #0f0d1f;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                This is an automated security notification from MeetFlow. Please do not reply directly to this email.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #475569;">
                &copy; MeetFlow Inc. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const textContent = [
      'MeetFlow',
      'Password Reset Verification',
      '',
      'Your password reset verification code is:',
      otp,
      '',
      'This code will expire in 10 minutes.',
      '',
      'If you did not request a password reset, you can safely ignore this email.',
      '',
      'This is an automated security notification from MeetFlow.',
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [personalEmail.trim().toLowerCase()],
        subject: 'MeetFlow Password Reset OTP',
        html: htmlContent,
        text: textContent,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      // Log technical error ONLY on the secure server side (no OTP, no key)
      console.error('Resend delivery failure HTTP status:', res.status, errorText);
      return {
        success: false,
        error: "We couldn't send the verification email right now. Please try again.",
      };
    }

    const data = await res.json().catch(() => ({}));
    console.log('Resend password reset email dispatched successfully. Email ID:', data?.id);
    return { success: true };
  } catch (err: any) {
    // Log technical error ONLY on the secure server side (no OTP, no key)
    console.error('Resend dispatch exception:', err?.message || 'Network error');
    return {
      success: false,
      error: "We couldn't send the verification email right now. Please try again.",
    };
  }
}
