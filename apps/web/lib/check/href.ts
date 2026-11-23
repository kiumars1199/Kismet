// The "Check" link on a bet card: /check?m=<market id>&side=<0|1> (SPEC F1).
export const checkHref = (marketId: string, side: 0 | 1): string => `/check?m=${encodeURIComponent(marketId)}&side=${side}`;
