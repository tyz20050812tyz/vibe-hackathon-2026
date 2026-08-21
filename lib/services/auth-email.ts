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

export async function sendSignupConfirmationEmail(email: string, confirmationUrl: string) {
  try {
    const { config, transport } = emailTransport();
    const url = escapeHtml(confirmationUrl);
    await transport.sendMail({
      from: config.from,
      to: email,
      subject: "确认你的书外之遇账号",
      text: `欢迎来到书外之遇。请打开以下链接确认邮箱：\n${confirmationUrl}\n\n如果不是你注册的，可以忽略此邮件。`,
      html: `<main style="font-family: sans-serif; color: #172d29; line-height: 1.6"><h1>确认你的邮箱</h1><p>欢迎来到书外之遇。确认邮箱后即可保存阅读线索。</p><p><a href="${url}" style="display: inline-block; padding: 10px 16px; background: #254a42; color: #fff8e9; text-decoration: none">确认邮箱</a></p><p style="font-size: 14px">如果按钮无法打开，请复制此链接：<br><a href="${url}">${url}</a></p><p style="font-size: 14px">如果不是你注册的，可以忽略此邮件。</p></main>`,
    });
  } catch (error) {
    if (error instanceof AuthEmailError) throw error;
    throw new AuthEmailError("SUPABASE_UNAVAILABLE", "验证邮件暂时无法发送，请稍后重试。");
  }
}
