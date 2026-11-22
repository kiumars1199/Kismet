"""Kalshi series -> topic id (F3). The ids are the ones in apps/web/lib/taxonomy.ts ("sports.nfl", "crypto.bitcoin",
"weather.highest-temperature"); the web side filters on them with no matcher of its own.

topic_of(series, title) returns the most specific id it can:
  1. longest series-prefix match in SERIES (Kalshi tickers are "KX<NAME>[-<suffix>]", the name is stable per product);
  2. else a keyword in the title (KEYWORDS, first hit wins);
  3. else "<category>.other" when a category keyword hits, else "other" (the taxonomy's own catch-all category).
"""
import re

# (prefix without the "KX", topic id). Longest prefix wins, so "NCAAFGAME" beats "NCAA".
SERIES = [
    # sports
    ("NFL", "sports.nfl"), ("NCAAF", "sports.cfb"), ("CFB", "sports.cfb"), ("NBA", "sports.nba"), ("WNBA", "sports.other"),
    ("NCAAMB", "sports.ncaab"), ("NCAAB", "sports.ncaab"), ("MARMAD", "sports.ncaab"), ("NHL", "sports.nhl"), ("MLB", "sports.mlb"),
    ("EPL", "sports.soccer.premier-league"), ("PREMIERLEAGUE", "sports.soccer.premier-league"),
    ("LALIGA2", "sports.soccer.la-liga-2"), ("LALIGA", "sports.soccer.la-liga"), ("BUNDESLIGA2", "sports.soccer.bundesliga-2"),
    ("BUNDESLIGA", "sports.soccer.bundesliga"), ("LIGUE1", "sports.soccer.ligue-1"), ("UCL", "sports.soccer.ucl"),
    ("UEL", "sports.soccer"), ("SERIEA", "sports.soccer"), ("MLS", "sports.soccer"), ("EREDIVISIE", "sports.soccer.ere"),
    ("EFLCHAMP", "sports.soccer.efl-championship"), ("UEFANL", "sports.soccer.uefa-nations-league"),
    ("CONCACAF", "sports.soccer.concacaf-nations-league"), ("FIFA", "sports.soccer"), ("WORLDCUP", "sports.soccer"),
    ("SOCCER", "sports.soccer"), ("ATP", "sports.tennis.atp"), ("WTA", "sports.tennis.wta"), ("TENNIS", "sports.tennis"),
    ("USOPEN", "sports.tennis"), ("WIMBLEDON", "sports.tennis"), ("FRENCHOPEN", "sports.tennis"), ("AUSOPEN", "sports.tennis"),
    ("CS2", "sports.esports.counter-strike-2"), ("DOTA", "sports.esports.dota-2"), ("LOL", "sports.esports.league-of-legends"),
    ("VALORANT", "sports.esports.valorant"), ("ESPORTS", "sports.esports"), ("UFC", "sports.ufc"), ("MMA", "sports.ufc"),
    ("BOXING", "sports.boxing"), ("PGA", "sports.golf"), ("GOLF", "sports.golf"), ("MASTERS", "sports.golf"), ("LPGA", "sports.golf"),
    ("F1", "sports.f1"), ("NASCAR", "sports.other"), ("CRICKET", "sports.cricket"), ("IPL", "sports.cricket"),
    ("SUPERBOWL", "sports.nfl"), ("HEISMAN", "sports.cfb"), ("NBAFINALS", "sports.nba"), ("NBAMVP", "sports.nba"),
    ("WORLDSERIES", "sports.mlb"), ("STANLEY", "sports.nhl"), ("OLYMPIC", "sports.other"), ("RUGBY", "sports.other"),
    # crypto
    ("BTC", "crypto.bitcoin"), ("ETH", "crypto.ethereum"), ("SOLD", "crypto.solana"), ("SOLANA", "crypto.solana"), ("SOLUSD", "crypto.solana"), ("XRP", "crypto.xrp"),
    ("DOGE", "crypto.other"), ("CRYPTO", "crypto.other"), ("BNB", "crypto.other"),
    # weather
    ("HIGHT", "weather.highest-temperature"), ("HIGH", "weather.highest-temperature"), ("LOWT", "weather.lowest-temperature"),
    ("LOW", "weather.lowest-temperature"), ("RAIN", "weather.precipitation"), ("SNOW", "weather.precipitation"),
    ("PRECIP", "weather.precipitation"), ("HURCAT", "weather.hurricanes"), ("HURR", "weather.hurricanes"),
    ("TEMP", "weather.other"), ("WEATHER", "weather.other"), ("TORNADO", "weather.other"), ("NYCTEMP", "weather.other"),
    # finance
    ("FEDDECISION", "finance.fed"), ("FED", "finance.fed"), ("FOMC", "finance.fed"), ("RATECUT", "finance.fed"),
    ("CPI", "finance.inflation"), ("INFL", "finance.inflation"), ("PCE", "finance.inflation"),
    ("PAYROLL", "finance.jobs"), ("JOBS", "finance.jobs"), ("UNRATE", "finance.jobs"), ("JOBLESS", "finance.jobs"),
    ("INXU", "finance.finance-updown"), ("NASDAQ100U", "finance.finance-updown"), ("INX", "finance.daily-close"),
    ("NASDAQ", "finance.daily-close"), ("DJI", "finance.daily-close"), ("SPX", "finance.daily-close"),
    ("GOLD", "finance.commodities"), ("SILVER", "finance.commodities"), ("WTI", "finance.commodities"), ("OIL", "finance.commodities"),
    ("NATGAS", "finance.commodities"), ("COPPER", "finance.commodities"), ("EARNINGS", "finance.earnings-calls"),
    ("GDP", "finance.other"), ("RECESSION", "finance.other"), ("TREASURY", "finance.other"), ("MORTGAGE", "finance.other"),
    ("GAS", "finance.commodities"), ("AAA", "finance.commodities"), ("USDJPY", "finance.other"), ("EURUSD", "finance.other"), ("TNOTE", "finance.other"),
    # politics
    ("PRES", "politics.elections"), ("SENATE", "politics.elections"), ("HOUSE", "politics.elections"), ("GOVPARTY", "politics.elections"), ("GOVRACE", "politics.elections"), ("GOVERNOR", "politics.elections"), ("GOVSHUT", "politics.congress"),
    ("MAYOR", "politics.elections"), ("ELECT", "politics.elections"), ("PRIMARY", "politics.elections"), ("NOMINEE", "politics.elections"),
    ("CONGRESS", "politics.congress"), ("SHUTDOWN", "politics.congress"), ("DEBT", "politics.congress"), ("BILL", "politics.congress"),
    ("SCOTUS", "politics.courts"), ("COURT", "politics.courts"), ("TRUMP", "politics.trump"), ("EXECORDER", "politics.trump"),
    ("TARIFF", "politics.trump"), ("APPROVAL", "politics.trump"), ("CABINET", "politics.trump"), 
    ("POLITICS", "politics.other"), ("POTUS", "politics.us-politics"), ("VANCE", "politics.us-politics"),
    # world
    ("UKRAINE", "geopolitics"), ("RUSSIA", "geopolitics"), ("CHINA", "geopolitics"), ("ISRAEL", "geopolitics"),
    ("GAZA", "geopolitics"), ("IRAN", "geopolitics"), ("TAIWAN", "geopolitics"), ("NATO", "geopolitics"), 
    # culture
    ("OSCAR", "culture.awards"), ("EMMY", "culture.awards"), ("GRAMMY", "culture.awards"), ("GOLDENGLOBE", "culture.awards"),
    ("TONY", "culture.awards"), ("AWARD", "culture.awards"), ("SPOTIFY", "culture.music"), ("BILLBOARD", "culture.music"),
    ("ALBUM", "culture.music"), ("SONG", "culture.music"), ("TOPSONG", "culture.music"), ("BOXOFFICE", "culture.movies"),
    ("MOVIE", "culture.movies"), ("FILM", "culture.movies"), ("NETFLIX", "culture.top-netflix"),
    ("TWEET", "culture.tweets-markets"), ("ELONTWEET", "culture.tweets-markets"), ("TRUMPTWEET", "culture.tweets-markets"),
    ("CELEB", "culture.celebrities"), ("TAYLOR", "culture.celebrities"), ("MUSK", "culture.celebrities"), ("ELON", "culture.celebrities"),
    
    # tech
    ("OPENAI", "tech.openai"), ("ANTHROPIC", "tech.anthropic"), ("GOOGLE", "tech.google"), ("GEMINI", "tech.google"),
    ("NVDA", "tech.nvda"), ("NVIDIA", "tech.nvda"), ("LLM", "tech.ai"), ("CHATGPT", "tech.ai"),
    ("APPLE", "tech.big-tech"), ("TESLA", "tech.big-tech"), ("META", "tech.big-tech"), ("MSFT", "tech.big-tech"), ("AMZN", "tech.big-tech"),
    ("ELONMARS", "tech.other"), ("SPACEX", "tech.other"), ("TECH", "tech.other"), ("MARS", "tech.other"), ("NASA", "tech.other"), ("STARSHIP", "tech.other"),
    # mentions
    ("MENTION", "mentions"),
]

# Title keywords, used when the series prefix is unknown. Whole words only (an optional plural "s"): "rain" must not
# match Ukraine, "gold" must not match Golden State, "war" must not match Warriors. First hit wins, so order matters.
def _kw(*terms):
    return re.compile(r"\b(?:" + "|".join(re.escape(t) for t in terms) + r")s?\b")


KEYWORDS = [
    (_kw("nfl", "super bowl", "touchdown"), "sports.nfl"), (_kw("nba", "basketball"), "sports.nba"),
    (_kw("nhl", "stanley cup"), "sports.nhl"), (_kw("mlb", "world series"), "sports.mlb"),
    (_kw("premier league"), "sports.soccer.premier-league"), (_kw("champions league"), "sports.soccer.ucl"),
    (_kw("soccer", "fifa"), "sports.soccer"), (_kw("atp"), "sports.tennis.atp"), (_kw("wta"), "sports.tennis.wta"),
    (_kw("tennis"), "sports.tennis"), (_kw("ufc"), "sports.ufc"), (_kw("golf", "pga"), "sports.golf"),
    (_kw("formula 1", "f1"), "sports.f1"), (_kw("bitcoin", "btc"), "crypto.bitcoin"), (_kw("ethereum", "eth"), "crypto.ethereum"),
    (_kw("solana"), "crypto.solana"), (_kw("xrp"), "crypto.xrp"), (_kw("highest temp", "high temp", "highest temperature"), "weather.highest-temperature"),
    (_kw("lowest temp", "low temp", "lowest temperature"), "weather.lowest-temperature"),
    (_kw("rain", "snow", "precipitation"), "weather.precipitation"), (_kw("hurricane"), "weather.hurricanes"),
    (_kw("fed", "interest rate", "fomc"), "finance.fed"), (_kw("inflation", "cpi"), "finance.inflation"),
    (_kw("unemployment", "payroll", "jobs report"), "finance.jobs"), (_kw("gold", "silver", "crude", "oil price"), "finance.commodities"),
    (_kw("s&p", "nasdaq", "dow jones"), "finance.daily-close"),
    (_kw("election", "senate", "governor", "president", "primary"), "politics.elections"),
    (_kw("supreme court", "scotus"), "politics.courts"), (_kw("trump"), "politics.trump"), (_kw("congress", "shutdown"), "politics.congress"),
    (_kw("oscar", "emmy", "grammy", "award"), "culture.awards"), (_kw("album", "song", "billboard", "spotify"), "culture.music"),
    (_kw("box office", "movie"), "culture.movies"), (_kw("netflix"), "culture.top-netflix"), (_kw("openai", "chatgpt"), "tech.openai"),
    (_kw("anthropic", "claude"), "tech.anthropic"), (_kw("nvidia"), "tech.nvda"), (_kw("ai", "artificial intelligence"), "tech.ai"),
    (_kw("war", "ceasefire", "russia", "ukraine", "china", "israel", "iran"), "geopolitics"),
]

_BY_LEN = sorted(SERIES, key=lambda x: -len(x[0]))


def topic_of(series, title=""):
    s = (series or "").upper()
    s = s[2:] if s.startswith("KX") else s
    # "MVE" combo series carry no topic of their own.
    for prefix, tid in _BY_LEN:
        if s.startswith(prefix):
            return tid
    t = (title or "").lower()
    for pat, tid in KEYWORDS:
        if pat.search(t):
            return tid
    return "other"
