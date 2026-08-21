import nodemailer from "nodemailer";

export class AuthEmailError extends Error {
  constructor(public readonly code: "CONFIGURATION_ERROR" | "SUPABASE_UNAVAILABLE", message: string) {
    super(message);
    this.name = "AuthEmailError";
  }
}

function emailConfiguration() {
  const host = process.env.SMTP_HOST;
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const parsedPort = Number(process.env.SMTP_PORT ?? "465");

  if (!host || !username || !password || !from || !Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new AuthEmailError("CONFIGURATION_ERROR", "验证邮件服务尚未配置。请联系管理员。");
  }

  return { host, username, password, from, port: parsedPort };
}

function emailTransport() {
  const config = emailConfiguration();
  return {
    config,
    transport: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.username, pass: config.password },
    }),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function verifySignupEmailDelivery() {
  try {
    await emailTransport().transport.verify();
  } catch (error) {
    if (error instanceof AuthEmailError) throw error;
    throw new AuthEmailError("SUPABASE_UNAVAILABLE", "验证邮件服务暂时不可用，请稍后重试。");
  }
}

function signupConfirmationHtml(url: string) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>确认你的书外之遇账号</title>
    <style>
      @keyframes bookmarkPulse {
        0%, 100% { transform: translateY(0) rotate(-2deg); opacity: .78; }
        50% { transform: translateY(-4px) rotate(2deg); opacity: 1; }
      }
      .bookmark-pulse { animation: bookmarkPulse 4s ease-in-out infinite; transform-origin: center; }
      @media (prefers-reduced-motion: reduce) {
        .bookmark-pulse { animation: none; }
      }
      @media only screen and (max-width: 620px) {
        .page-pad { padding: 18px 10px !important; }
        .content-pad { padding: 30px 24px !important; }
        .headline { font-size: 34px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#d8d0bf; color:#19342f; font-family:Georgia, 'Times New Roman', 'Noto Serif SC', serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">确认邮箱，保存你与书相遇的阅读线索。</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#d8d0bf;">
      <tr>
        <td class="page-pad" align="center" style="padding:42px 18px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; overflow:hidden; background:#f7f0df; border:1px solid #c8bda7; box-shadow:0 12px 34px rgba(45,54,47,.14);">
            <tr>
              <td style="padding:18px 28px; background:#173f3a; color:#f7f0df; border-bottom:5px solid #c65f43;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="font-size:15px; letter-spacing:2px; font-weight:bold;">书外之遇</td>
                    <td align="right" style="font-family:Arial, sans-serif; font-size:10px; letter-spacing:1.5px; color:#c9d4be;">READING TRACE / 01</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="content-pad" style="padding:46px 54px 42px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="width:42px; vertical-align:top;">
                      <div class="bookmark-pulse" style="width:24px; height:52px; background:#c65f43; border-radius:2px 2px 5px 5px; box-shadow:5px 5px 0 #e3c37d; position:relative;"></div>
                    </td>
                    <td style="padding-left:18px; vertical-align:top;">
                      <p style="margin:0 0 14px; font-family:Arial, sans-serif; color:#b4543d; font-size:11px; letter-spacing:2.5px; font-weight:bold;">一封来自书页之间的信</p>
                      <h1 class="headline" style="margin:0; color:#173f3a; font-size:42px; line-height:1.12; font-weight:normal; letter-spacing:0;">确认你的邮箱</h1>
                    </td>
                  </tr>
                </table>
                <p style="margin:34px 0 0; color:#42514a; font-size:17px; line-height:1.8;">欢迎来到书外之遇。确认邮箱后，你就可以把偶然读到的片段、想再回看的线索，留在自己的书架里。</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 30px;">
                  <tr>
                    <td style="background:#c65f43; border-radius:3px; box-shadow:4px 4px 0 #173f3a;">
                      <a href="${url}" style="display:inline-block; padding:15px 25px; color:#fffaf0; font-family:Arial, sans-serif; font-size:14px; font-weight:bold; letter-spacing:1px; text-decoration:none;">确认邮箱&nbsp;&nbsp;→</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #d6cbb7; border-bottom:1px solid #d6cbb7;">
                  <tr>
                    <td style="padding:18px 0 8px; font-family:Arial, sans-serif; color:#7b7467; font-size:11px; letter-spacing:1px;">如果按钮无法打开，请复制这条线索</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 18px; word-break:break-all; font-family:Arial, sans-serif; color:#285d55; font-size:12px; line-height:1.6;"><a href="${url}" style="color:#285d55; text-decoration:underline;">${url}</a></td>
                  </tr>
                </table>
                <p style="margin:28px 0 0; color:#7b7467; font-family:Arial, sans-serif; font-size:12px; line-height:1.7;">如果不是你注册的，可以忽略此邮件。你的邮箱不会被订阅任何内容。</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px; background:#e9dfcc; color:#6e756c; font-family:Arial, sans-serif; font-size:11px; line-height:1.5;">
                书外之遇 · 把阅读变成一条可以回望的路
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendSignupConfirmationEmail(email: string, confirmationUrl: string) {
  try {
    const { config, transport } = emailTransport();
    const url = escapeHtml(confirmationUrl);
    await transport.sendMail({
      from: config.from,
      to: email,
      subject: "书外之遇｜确认你的邮箱",
      text: `确认你的书外之遇账号\n\n欢迎来到书外之遇。确认邮箱后，你就可以保存阅读线索。\n\n请打开以下链接：\n${confirmationUrl}\n\n如果不是你注册的，可以忽略此邮件。`,
      html: signupConfirmationHtml(url),
    });
  } catch (error) {
    if (error instanceof AuthEmailError) throw error;
    throw new AuthEmailError("SUPABASE_UNAVAILABLE", "验证邮件暂时无法发送，请稍后重试。");
  }
}
