// Transactional email. ponytail: stub that logs (no PII) until Lane O's Resend sender replaces this body.
export async function sendEmail(msg: { to: string; subject: string; text: string }): Promise<void> {
  console.info("[email] (stub, not sent)", msg.subject);
}
