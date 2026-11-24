import { fitClamp } from "./fitclamp119r3.ts";
const LEDE = "Sign up for the verdict on: ";
const t = "Will the highest temperature in Los Angeles be between 66-67°F on November 18?";
for (const b of [76, 84, 88, 91, 92, 96]) { const out = fitClamp(t, (x) => (LEDE + x).length <= b); console.log(b, (LEDE+out).length, JSON.stringify(out)); }
