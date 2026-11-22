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
    ("BTC", "crypto.bitcoin"), ("ETH", "crypto.ethereum"), ("SOL", "crypto.solana"), ("XRP", "crypto.xrp"),
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
    ("PRES", "politics.elections"), ("SENATE", "politics.elections"), ("HOUSE", "politics.elections"), ("GOV", "politics.elections"),
    ("MAYOR", "politics.elections"), ("ELECT", "politics.elections"), ("PRIMARY", "politics.elections"), ("NOMINEE", "politics.elections"),
    ("CONGRESS", "politics.congress"), ("SHUTDOWN", "politics.congress"), ("DEBT", "politics.congress"), ("BILL", "politics.congress"),
    ("SCOTUS", "politics.courts"), ("COURT", "politics.courts"), ("TRUMP", "politics.trump"), ("EXECORDER", "politics.trump"),
    ("TARIFF", "politics.trump"), ("APPROVAL", "politics.trump"), ("CABINET", "politics.trump"), ("DOGE", "politics.us-politics"),
    ("POLITICS", "politics.other"), ("POTUS", "politics.us-politics"), ("VANCE", "politics.us-politics"),
    # world
    ("WAR", "geopolitics"), ("UKRAINE", "geopolitics"), ("RUSSIA", "geopolitics"), ("CHINA", "geopolitics"), ("ISRAEL", "geopolitics"),
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

# Title keywords, used when the series prefix is unknown. Order matters: first hit wins.
KEYWORDS = [
    (r"\bnfl\b|super bowl|touchdown", "sports.nfl"), (r"\bnba\b|basketball", "sports.nba"), (r"\bnhl\b|stanley cup", "sports.nhl"),
    (r"\bmlb\b|world series", "sports.mlb"), (r"premier league", "sports.soccer.premier-league"),
    (r"champions league", "sports.soccer.ucl"), (r"\bsoccer\b|\bfifa\b", "sports.soccer"), (r"\batp\b", "sports.tennis.atp"),
    (r"\bwta\b", "sports.tennis.wta"), (r"\btennis\b", "sports.tennis"), (r"\bufc\b", "sports.ufc"), (r"\bgolf\b|\bpga\b", "sports.golf"),
    (r"formula 1|\bf1\b", "sports.f1"), (r"bitcoin|\bbtc\b", "crypto.bitcoin"), (r"ethereum|\beth\b", "crypto.ethereum"),
    (r"solana", "crypto.solana"), (r"\bxrp\b", "crypto.xrp"), (r"highest temp|high temp", "weather.highest-temperature"),
    (r"lowest temp|low temp", "weather.lowest-temperature"), (r"rain|snow|precipitation", "weather.precipitation"),
    (r"hurricane", "weather.hurricanes"), (r"\bfed\b|interest rate|fomc", "finance.fed"), (r"inflation|\bcpi\b", "finance.inflation"),
    (r"unemployment|payroll|jobs report", "finance.jobs"), (r"gold|silver|crude|oil price", "finance.commodities"),
    (r"s&p|nasdaq|dow jones", "finance.daily-close"), (r"election|senate|governor|president|primary", "politics.elections"),
    (r"supreme court|scotus", "politics.courts"), (r"trump", "politics.trump"), (r"congress|shutdown", "politics.congress"),
    (r"oscar|emmy|grammy|award", "culture.awards"), (r"album|song|billboard|spotify", "culture.music"),
    (r"box office|movie", "culture.movies"), (r"netflix", "culture.top-netflix"), (r"openai|chatgpt", "tech.openai"),
    (r"anthropic|claude", "tech.anthropic"), (r"nvidia", "tech.nvda"), (r"\bai\b|artificial intelligence", "tech.ai"),
    (r"war|ceasefire|russia|ukraine|china|israel|iran", "geopolitics"),
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
        if re.search(pat, t):
            return tid
    return "other"
