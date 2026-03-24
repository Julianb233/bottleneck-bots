/**
 * Email service for workspace invitations.
 *
 * Development mode: logs email content to console.
 * Production: abstract interface for Resend/SendGrid/SES — implement the
 * `EmailTransport` interface and set EMAIL_PROVIDER env var.
 */

// ─── Transport Interface ────────────────────────────────────────────────────

export interface EmailTransport {
  send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void>;
}

// ─── Console Transport (Development) ────────────────────────────────────────

class ConsoleTransport implements EmailTransport {
  async send(options: { to: string; subject: string; html: string; text: string }): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('EMAIL (dev mode — not actually sent)');
    console.log('='.repeat(60));
    console.log(`To:      ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('-'.repeat(60));
    console.log(options.text);
    console.log('='.repeat(60) + '\n');
  }
}

// ─── Transport Factory ──────────────────────────────────────────────────────

function createTransport(): EmailTransport {
  const provider = process.env.EMAIL_PROVIDER;

  if (!provider || provider === 'console') {
    return new ConsoleTransport();
  }

  // Future: add Resend, SendGrid, SES transports here
  // if (provider === 'resend') return new ResendTransport();
  // if (provider === 'sendgrid') return new SendGridTransport();

  console.warn(`Unknown email provider "${provider}", falling back to console transport.`);
  return new ConsoleTransport();
}

const transport = createTransport();

// ─── Email Templates ────────────────────────────────────────────────────────

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';

interface InviteEmailParams {
  recipientEmail: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  token: string;
}

/**
 * Send a workspace invite email.
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<void> {
  const { recipientEmail, workspaceName, inviterName, role, token } = params;
  const acceptUrl = `${DASHBOARD_URL}/invites/${token}`;

  const subject = `You've been invited to ${workspaceName} on Bottleneck Bots`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #fafafa; padding: 40px 20px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto;">
    <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 24px; color: #fafafa;">
      Workspace Invitation
    </h1>
    <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; margin-bottom: 16px;">
      <strong style="color: #fafafa;">${inviterName}</strong> has invited you to join
      <strong style="color: #fafafa;">${workspaceName}</strong> as a
      <strong style="color: #fafafa;">${role}</strong>.
    </p>
    <p style="margin: 32px 0;">
      <a href="${acceptUrl}"
         style="display: inline-block; padding: 12px 24px; background-color: #fafafa; color: #09090b; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
        Accept Invitation
      </a>
    </p>
    <p style="font-size: 13px; color: #71717a; margin-top: 32px;">
      This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
    </p>
    <hr style="border: none; border-top: 1px solid #27272a; margin: 32px 0;" />
    <p style="font-size: 12px; color: #52525b;">
      Bottleneck Bots &mdash; Desktop Infrastructure for AI Agents
    </p>
  </div>
</body>
</html>`.trim();

  const text = [
    `Workspace Invitation`,
    ``,
    `${inviterName} has invited you to join "${workspaceName}" as a ${role}.`,
    ``,
    `Accept the invitation: ${acceptUrl}`,
    ``,
    `This invitation expires in 7 days.`,
    `If you did not expect this email, you can safely ignore it.`,
  ].join('\n');

  await transport.send({
    to: recipientEmail,
    subject,
    html,
    text,
  });
}
