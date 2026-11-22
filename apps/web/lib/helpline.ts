// F8: the help line shown in the footer, on /account and on the pause screen. Values and their source live in
// config/site.json (helpline.*): the operator's own page and the date we read it. Never typed in components.
import { site } from "@/lib/site";

export const HELPLINE = site.helpline;
export const helplineLinks = () => ({
  call: `tel:${HELPLINE.number_tel}`,
  text: `sms:${HELPLINE.text_sms}`,
  chat: HELPLINE.chat_url,
});
