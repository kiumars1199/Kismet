// Moves the server clock to 5 minutes after the newest scan (scanned_at 1794895125), so the Free delay (15 min) bites.
const OFFSET = Date.now() - (1794895125 + 300) * 1000; const real = Date.now; const RD = Date;
function D(...a) { if (!new.target) return new RD(real() - OFFSET).toString(); return a.length === 0 ? new RD(real() - OFFSET) : new RD(...a); }
D.prototype = RD.prototype; D.now = () => real() - OFFSET; D.parse = RD.parse; D.UTC = RD.UTC;
Object.setPrototypeOf(D, RD); global.Date = D;
