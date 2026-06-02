#!/usr/bin/env python3
"""
Epic 44 trend ingest — watchlist, collectors, SignalIngestBatch push (Stories 44-2-1–44-3-3).

Usage:
  python3 scripts/trend-ingest.py --dry-run --sources news
  python3 scripts/trend-ingest.py --source reddit
  python3 scripts/trend-ingest.py --sources google_trends
  python3 scripts/trend-ingest.py --dry-run [--sources a,b | --source name]

Cron one-liners (one collector per run):
  --sources news | --sources reddit | --sources google_trends
  --source <name> is equivalent to --sources <name> (singular alias).

Collectors: Epic 44 Epic 3+.
Structured run log: ~/.hermes/logs/trend-ingest.log (override: TREND_INGEST_LOG).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Literal

try:
    import yaml
except ImportError:  # pragma: no cover - exercised via ImportError path in main
    yaml = None  # type: ignore[assignment,misc]

try:
    from pytrends.request import TrendReq as _TrendReq
except ImportError:  # pragma: no cover - exercised when google_trends requested without pytrends
    _TrendReq = None  # type: ignore[assignment,misc]

try:
    import praw as _praw
except ImportError:  # pragma: no cover - exercised when reddit requested without praw
    _praw = None  # type: ignore[assignment,misc]

SourceName = Literal["google_trends", "reddit", "news"]
SOURCE_NAMES: tuple[SourceName, ...] = ("google_trends", "reddit", "news")

DEFAULT_WATCHLIST_REL = ".hermes/trend-watchlist.yaml"
DEFAULT_INGEST_ENV_REL = ".hermes/trend-ingest.env"

KEYWORD_MAX_LEN = 200
REGION_MAX_LEN = 32
REGION_RE = re.compile(r"^[a-z0-9_-]+$")
TOPIC_SLUG_MAX_LEN = 80

INGEST_MUTATION_PATH = "trends:ingestSignalBatch"
CONVEX_PUSH_TIMEOUT_SEC = 30
SECRET_PATTERNS_REL = Path("config") / "secret-patterns.json"
GOOGLE_TRENDS_WINDOW_HOURS = 168
REDDIT_NEWS_WINDOW_HOURS = 24
NORM_CACHE_VERSION = 1
NORM_CACHE_RETENTION_MS = 7 * 24 * 3_600_000
NORM_CACHE_MAX_SAMPLES = 500
TRENDS_SIGNAL_TYPE = "search_volume"
REDDIT_SIGNAL_TYPE = "mention_count"
NEWS_SIGNAL_TYPE = "article_count"
TRENDS_NORM_METHOD = "trends_interest_over_100"
TRENDS_INTEREST_AGGREGATION = "mean_non_partial_window"
REDDIT_NORM_METHOD = "reddit_7d_minmax"
NEWS_NORM_METHOD = "news_7d_minmax"
REDDIT_SEARCH_LIMIT = 100
REDDIT_COLLECTION_METHOD = "reddit_search_day_cap_100"
NEWSAPI_EVERYTHING_URL = "https://newsapi.org/v2/everything"


class TrendsRateLimitError(Exception):
    """429/403 from Google Trends — abort remaining keywords for this run."""


class TrendsEmptyResponseError(Exception):
    """Captcha, empty, or unusable pytrends response — no event for this keyword."""


class CollectorKeywordError(Exception):
    """Per-keyword collector failure — skip event, continue siblings."""


@dataclass(frozen=True)
class WatchlistEntry:
    topic_slug: str
    keyword: str
    region: str
    added_at: int


@dataclass
class SignalIngestBatch:
    ingest_run_id: str
    active_sources: list[SourceName]
    events: list[dict[str, Any]] = field(default_factory=list)
    watchlist: list[dict[str, Any]] = field(default_factory=list)
    signal_sources: list[dict[str, Any]] = field(default_factory=list)

    def to_wire_json(self) -> dict[str, Any]:
        return {
            "ingestRunId": self.ingest_run_id,
            "activeSources": list(self.active_sources),
            "events": list(self.events),
            "watchlist": list(self.watchlist),
            "signalSources": list(self.signal_sources),
        }


def topic_slug(keyword: str) -> str:
    """Architecture C9 — stable slug from watchlist keyword."""
    s = keyword.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    if not s:
        raise ValueError(f"keyword produces empty topicSlug: {keyword!r}")
    return s[:TOPIC_SLUG_MAX_LEN]


def _default_watchlist_path() -> Path:
    override = os.environ.get("TREND_WATCHLIST_PATH", "").strip()
    if override:
        return Path(override).expanduser()
    return Path.home() / ".hermes" / "trend-watchlist.yaml"


def _default_ingest_env_path() -> Path:
    override = os.environ.get("TREND_INGEST_ENV", "").strip()
    if override:
        return Path(override).expanduser()
    return Path.home() / ".hermes" / "trend-ingest.env"


def _default_norm_cache_path() -> Path:
    override = os.environ.get("TREND_NORM_CACHE_PATH", "").strip()
    if override:
        return Path(override).expanduser()
    return Path.home() / ".hermes" / "trend-norm-cache.json"


def _default_ingest_log_path() -> Path:
    override = os.environ.get("TREND_INGEST_LOG", "").strip()
    if override:
        return Path(override).expanduser()
    return Path.home() / ".hermes" / "logs" / "trend-ingest.log"


def _iso_utc_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sanitize_log_error(message: str) -> str:
    """Operator-safe error text — no deploy keys or API key substrings."""
    text = message.strip()
    for needle in (
        "deploy_key",
        "DEPLOY_KEY",
        "api_key",
        "API_KEY",
        "sk-proj-",
        "sk-",
    ):
        if needle in text:
            return "ingest failed (credentials or secrets redacted)"
    return text[:240]


def build_ingest_log_record(
    batch: SignalIngestBatch,
    *,
    dry_run: bool,
    duration_ms: int,
    outcome: str,
    http_status: int | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    safe_http: int | None
    if isinstance(http_status, int):
        safe_http = http_status
    else:
        safe_http = None

    record: dict[str, Any] = {
        "ts": _iso_utc_timestamp(),
        "ingestRunId": batch.ingest_run_id,
        "activeSources": list(batch.active_sources),
        "watchlistKeywords": len(batch.watchlist),
        "eventsEmitted": len(batch.events),
        "dryRun": dry_run,
        "durationMs": duration_ms,
        "httpStatus": safe_http,
        "outcome": outcome,
    }
    if error:
        record["error"] = _sanitize_log_error(error)
    return record


def append_ingest_log(record: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, separators=(",", ":"), ensure_ascii=False) + "\n"
    with path.open("a", encoding="utf-8") as f:
        f.write(line)


def _http_status_from_push_error(err: BaseException) -> int | None:
    match = re.search(r"Convex HTTP (\d{3})", str(err))
    if match:
        return int(match.group(1))
    return None


def load_ingest_env(path: Path) -> dict[str, str]:
    """Parse KEY=VALUE lines; does not export to os.environ."""
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            print(f"warning: skipping malformed env line in {path}", file=sys.stderr)
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key:
            print(f"warning: skipping malformed env line in {path}", file=sys.stderr)
            continue
        out[key] = value.strip().strip("'").strip('"')
    return out


def _normalise_keyword_entry(entry: Any, index: int) -> tuple[str, str]:
    if isinstance(entry, str):
        keyword = entry.strip()
        region = "global"
    elif isinstance(entry, dict):
        if "keyword" not in entry:
            raise ValueError(f"keywords[{index}]: object missing 'keyword'")
        keyword = str(entry["keyword"]).strip()
        region = str(entry.get("region", "global")).strip() or "global"
    else:
        raise ValueError(f"keywords[{index}]: must be string or object with keyword")

    if not keyword:
        raise ValueError(f"keywords[{index}]: empty keyword")
    if len(keyword) > KEYWORD_MAX_LEN:
        raise ValueError(f"keywords[{index}]: keyword exceeds {KEYWORD_MAX_LEN} chars")
    if any(ord(c) < 32 for c in keyword):
        raise ValueError(f"keywords[{index}]: keyword contains control characters")
    region_l = region.lower()
    if len(region_l) > REGION_MAX_LEN:
        raise ValueError(f"keywords[{index}]: region exceeds {REGION_MAX_LEN} chars")
    if not REGION_RE.match(region_l):
        raise ValueError(f"keywords[{index}]: invalid region {region!r}")

    return keyword, region_l


def load_watchlist_snapshot(path: Path, added_at: int) -> list[WatchlistEntry]:
    if yaml is None:
        raise RuntimeError("PyYAML is required: pip install pyyaml")

    if not path.is_file():
        return []

    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []

    doc = yaml.safe_load(raw)
    if doc is None:
        return []
    if not isinstance(doc, dict):
        raise ValueError("watchlist root must be a mapping")

    version = doc.get("version")
    if version != 1:
        raise ValueError(f"unsupported watchlist version: {version!r} (expected 1)")

    keywords = doc.get("keywords")
    if keywords is None:
        raise ValueError("watchlist missing 'keywords' list")
    if not isinstance(keywords, list):
        raise ValueError("watchlist 'keywords' must be a list")

    entries: list[WatchlistEntry] = []
    seen_slugs: set[str] = set()
    for i, item in enumerate(keywords):
        keyword, region = _normalise_keyword_entry(item, i)
        slug = topic_slug(keyword)
        if slug in seen_slugs:
            raise ValueError(f"duplicate topicSlug after normalisation: {slug!r}")
        seen_slugs.add(slug)
        entries.append(
            WatchlistEntry(
                topic_slug=slug,
                keyword=keyword,
                region=region,
                added_at=added_at,
            )
        )
    return entries


def watchlist_to_wire(entries: list[WatchlistEntry]) -> list[dict[str, Any]]:
    return [
        {
            "topicSlug": e.topic_slug,
            "keyword": e.keyword,
            "region": e.region,
            "addedAt": e.added_at,
        }
        for e in entries
    ]


def parse_sources_arg(value: str | None) -> list[SourceName]:
    if not value or not value.strip():
        return []
    names: list[SourceName] = []
    for part in value.split(","):
        name = part.strip()
        if not name:
            continue
        if name not in SOURCE_NAMES:
            allowed = ", ".join(SOURCE_NAMES)
            raise ValueError(f"invalid source {name!r}; allowed: {allowed}")
        if name not in names:
            names.append(name)  # type: ignore[arg-type]
    return names


def repo_root_from_script() -> Path:
    return Path(__file__).resolve().parents[1]


def load_secret_patterns(repo_root: Path) -> list[tuple[str, re.Pattern[str]]]:
    """Load repo baseline secret patterns (config/secret-patterns.json)."""
    path = repo_root / SECRET_PATTERNS_REL
    if not path.is_file():
        raise ValueError(f"secret patterns file not found: {path}")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise ValueError(f"invalid JSON in secret patterns file: {path}") from err
    patterns = raw.get("patterns")
    if not isinstance(patterns, list):
        raise ValueError(f"malformed secret patterns file: {path}")
    compiled: list[tuple[str, re.Pattern[str]]] = []
    for entry in patterns:
        if not isinstance(entry, dict):
            continue
        pattern_id = entry.get("id")
        regex_src = entry.get("regex")
        if not isinstance(pattern_id, str) or not isinstance(regex_src, str):
            continue
        try:
            compiled.append((pattern_id, re.compile(regex_src, re.MULTILINE)))
        except re.error as err:
            raise ValueError(f'invalid regex for pattern "{pattern_id}" in {path}') from err
    if not compiled:
        raise ValueError(f"no valid secret patterns in {path}")
    return compiled


def find_secret_pattern_id(
    content: str, patterns: list[tuple[str, re.Pattern[str]]]
) -> str | None:
    for pattern_id, regex in patterns:
        if regex.search(content):
            return pattern_id
    return None


def scan_batch_for_secret_pattern_id(
    batch: SignalIngestBatch, repo_root: Path
) -> str | None:
    patterns = load_secret_patterns(repo_root)
    serialized = json.dumps(batch.to_wire_json(), separators=(",", ":"))
    return find_secret_pattern_id(serialized, patterns)


def normalize_convex_url(convex_url: str) -> str:
    return convex_url.rstrip("/")


def build_ingest_mutation_request(batch: SignalIngestBatch) -> dict[str, Any]:
    return {
        "path": INGEST_MUTATION_PATH,
        "args": {"batch": batch.to_wire_json()},
        "format": "json",
    }


def require_push_credentials(env: dict[str, str]) -> tuple[str, str]:
    convex_url = env.get("CONVEX_URL", "").strip()
    deploy_key = env.get("CONVEX_DEPLOY_KEY", "").strip()
    if not convex_url or not deploy_key:
        raise ValueError(
            "CONVEX_URL and CONVEX_DEPLOY_KEY are required in trend-ingest.env for push"
        )
    return convex_url, deploy_key


def push_signal_batch(
    batch: SignalIngestBatch,
    *,
    convex_url: str,
    deploy_key: str,
    urlopen: Callable[..., Any] | None = None,
    timeout_sec: int = CONVEX_PUSH_TIMEOUT_SEC,
) -> int:
    """POST batch to Convex HTTP mutation API (dashboard-sync transport mirror).

    Returns HTTP status code (200–299) on success; raises RuntimeError otherwise.
    """
    open_impl = urlopen or urllib.request.urlopen
    url = f"{normalize_convex_url(convex_url)}/api/mutation"
    body = json.dumps(build_ingest_mutation_request(batch)).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Convex {deploy_key}",
        },
    )
    try:
        with open_impl(request, timeout=timeout_sec) as response:
            status = getattr(response, "status", None) or response.getcode()
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"Convex HTTP {err.code}: {err.reason}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"Convex request failed: {err.reason}") from err

    if status < 200 or status >= 300:
        raise RuntimeError(f"Convex HTTP {status}")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as err:
        raise RuntimeError("Convex mutation response was not valid JSON") from err

    if not isinstance(payload, dict):
        raise RuntimeError("Convex mutation response was not an object")

    if payload.get("status") == "error":
        message = payload.get("errorMessage")
        detail = message if isinstance(message, str) else "Convex mutation failed"
        raise RuntimeError(f"Convex HTTP {status}: {detail}")
    if payload.get("status") != "success":
        message = payload.get("errorMessage")
        detail = (
            message
            if isinstance(message, str)
            else "Convex mutation returned unexpected status"
        )
        raise RuntimeError(f"Convex HTTP {status}: {detail}")

    return int(status)


def floor_to_utc_hour_ms(timestamp_ms: int) -> int:
    dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    floored = dt.replace(minute=0, second=0, microsecond=0)
    return int(floored.timestamp() * 1000)


def dedupe_key_for_event(
    *,
    topic_slug: str,
    source: SourceName,
    signal_type: str,
    collected_at_ms: int,
    window_hours: int,
) -> str:
    window_start_ms = collected_at_ms - (window_hours * 3_600_000)
    window_start_hour = floor_to_utc_hour_ms(window_start_ms)
    payload = f"{topic_slug}|{source}|{signal_type}|{window_start_hour}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def norm_cache_storage_key(topic_slug: str, source: SourceName) -> str:
    return f"{topic_slug}|{source}"


def load_norm_cache(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"version": NORM_CACHE_VERSION, "entries": {}}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise ValueError(f"invalid norm cache JSON: {path}") from err
    if not isinstance(raw, dict):
        raise ValueError(f"norm cache root must be an object: {path}")
    if raw.get("version") != NORM_CACHE_VERSION:
        raise ValueError(
            f"unsupported norm cache version: {raw.get('version')!r} (expected {NORM_CACHE_VERSION})"
        )
    entries = raw.get("entries")
    if not isinstance(entries, dict):
        raise ValueError(f"norm cache missing 'entries' object: {path}")
    return {"version": NORM_CACHE_VERSION, "entries": entries}


def save_norm_cache(path: Path, cache: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(cache, indent=2) + "\n"
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)


def _prune_norm_samples(
    samples: list[dict[str, Any]], collected_at_ms: int
) -> list[dict[str, Any]]:
    kept = [
        s
        for s in samples
        if isinstance(s, dict)
        and isinstance(s.get("t"), (int, float))
        and collected_at_ms - int(s["t"]) <= NORM_CACHE_RETENTION_MS
    ]
    return kept[-NORM_CACHE_MAX_SAMPLES:]


def minmax_normalize_7d(
    value: float, history_samples: list[dict[str, Any]]
) -> float:
    if not history_samples:
        return 0.5
    values = [float(s["v"]) for s in history_samples if isinstance(s.get("v"), (int, float))]
    if not values:
        return 0.5
    lo, hi = min(values), max(values)
    if hi <= lo:
        return 0.5
    normalized = (value - lo) / (hi - lo)
    return max(0.0, min(1.0, normalized))


def record_norm_cache_sample(
    cache: dict[str, Any],
    *,
    topic_slug: str,
    source: SourceName,
    value: float,
    collected_at_ms: int,
) -> None:
    key = norm_cache_storage_key(topic_slug, source)
    entries = cache.setdefault("entries", {})
    entry = entries.setdefault(key, {"samples": [], "updatedAt": 0})
    samples = entry.get("samples")
    if not isinstance(samples, list):
        samples = []
    samples.append({"v": value, "t": collected_at_ms})
    entry["samples"] = _prune_norm_samples(samples, collected_at_ms)
    entry["updatedAt"] = collected_at_ms


def _history_samples_for_key(
    cache: dict[str, Any],
    topic_slug: str,
    source: SourceName,
    *,
    collected_at_ms: int,
) -> list[dict[str, Any]]:
    entries = cache.get("entries")
    if not isinstance(entries, dict):
        return []
    entry = entries.get(norm_cache_storage_key(topic_slug, source))
    if not isinstance(entry, dict):
        return []
    samples = entry.get("samples")
    if not isinstance(samples, list):
        return []
    return [
        s
        for s in samples
        if isinstance(s, dict)
        and isinstance(s.get("t"), (int, float))
        and collected_at_ms - int(s["t"]) <= NORM_CACHE_RETENTION_MS
    ]


def build_minmax_signal_event(
    entry: WatchlistEntry,
    *,
    source: SourceName,
    signal_type: str,
    raw_value: float,
    normalized_value: float,
    norm_method: str,
    ingest_run_id: str,
    collected_at_ms: int,
    window_hours: int,
    collection_method: str | None = None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "normalisationMethod": norm_method,
        "rawValue": raw_value,
    }
    if collection_method:
        metadata["collectionMethod"] = collection_method
    return {
        "topicSlug": entry.topic_slug,
        "keyword": entry.keyword,
        "source": source,
        "signalType": signal_type,
        "value": raw_value,
        "normalizedValue": normalized_value,
        "region": entry.region,
        "windowHours": window_hours,
        "collectedAt": collected_at_ms,
        "dedupeKey": dedupe_key_for_event(
            topic_slug=entry.topic_slug,
            source=source,
            signal_type=signal_type,
            collected_at_ms=collected_at_ms,
            window_hours=window_hours,
        ),
        "ingestRunId": ingest_run_id,
        "metadata": metadata,
    }


def build_google_trends_event(
    entry: WatchlistEntry,
    *,
    interest: int,
    ingest_run_id: str,
    collected_at_ms: int,
    window_hours: int = GOOGLE_TRENDS_WINDOW_HOURS,
) -> dict[str, Any]:
    normalized = interest / 100.0
    return {
        "topicSlug": entry.topic_slug,
        "keyword": entry.keyword,
        "source": "google_trends",
        "signalType": TRENDS_SIGNAL_TYPE,
        "value": interest,
        "normalizedValue": normalized,
        "region": entry.region,
        "windowHours": window_hours,
        "collectedAt": collected_at_ms,
        "dedupeKey": dedupe_key_for_event(
            topic_slug=entry.topic_slug,
            source="google_trends",
            signal_type=TRENDS_SIGNAL_TYPE,
            collected_at_ms=collected_at_ms,
            window_hours=window_hours,
        ),
        "ingestRunId": ingest_run_id,
        "metadata": {
            "normalisationMethod": TRENDS_NORM_METHOD,
            "interestAggregation": TRENDS_INTEREST_AGGREGATION,
        },
    }


def _exception_is_trends_rate_limit(err: BaseException) -> bool:
    if isinstance(err, TrendsRateLimitError):
        return True
    if isinstance(err, urllib.error.HTTPError):
        return err.code in (429, 403)
    return "too many requests" in str(err).lower()


def _trends_geo_for_entry(entry: WatchlistEntry) -> str:
    if entry.region == "global":
        return ""
    return entry.region.upper()


def _aggregate_trends_interest(series: Any) -> int:
    """Mean of non-partial hourly values — avoids trailing-hour zeros (Story 55-2)."""
    try:
        values = series.tolist()
    except AttributeError:
        values = list(series)
    if not values:
        raise TrendsEmptyResponseError("no interest values")
    mean_val = sum(values) / len(values)
    interest = int(round(mean_val))
    if interest < 0 or interest > 100:
        raise TrendsEmptyResponseError("interest out of range")
    return interest


def fetch_google_trends_interest(
    entry: WatchlistEntry,
    *,
    trend_client: Any,
) -> int:
    """Live pytrends fetch for one watchlist keyword (0–100 interest)."""
    geo = _trends_geo_for_entry(entry)
    try:
        trend_client.build_payload([entry.keyword], timeframe="now 7-d", geo=geo)
        frame = trend_client.interest_over_time()
    except Exception as err:
        if _exception_is_trends_rate_limit(err):
            raise TrendsRateLimitError(str(err)) from err
        if "captcha" in str(err).lower():
            raise TrendsEmptyResponseError(str(err)) from err
        try:
            from pytrends import exceptions as _pt_exc

            if isinstance(err, _pt_exc.ResponseError) and re.search(r"\b400\b", str(err)):
                raise TrendsEmptyResponseError(f"400 no-data: {err}") from err
        except Exception:
            pass
        raise

    if frame is None or frame.empty:
        raise TrendsEmptyResponseError("empty interest_over_time")

    if "isPartial" in frame.columns:
        partial = frame["isPartial"]
        frame = frame.drop(columns=["isPartial"])
    else:
        partial = None

    if entry.keyword not in frame.columns:
        raise TrendsEmptyResponseError("keyword column missing")

    series = frame[entry.keyword].dropna()
    if partial is not None and hasattr(partial, "loc") and hasattr(series, "index"):
        series = series[partial.loc[series.index] == False]  # noqa: E712
    if series.empty:
        raise TrendsEmptyResponseError("no interest values")

    interest = _aggregate_trends_interest(series)
    return interest


def build_signal_source_patch(
    source: SourceName,
    *,
    status: Literal["ok", "partial", "error"],
    last_run_ms: int,
    error_count: int,
    last_error: str | None,
) -> dict[str, Any]:
    return {
        "name": source,
        "status": status,
        "lastRun": last_run_ms,
        "errorCount": error_count,
        "lastError": last_error,
    }


def build_google_trends_source_patch(
    *,
    status: Literal["ok", "partial", "error"],
    last_run_ms: int,
    error_count: int,
    last_error: str | None,
) -> dict[str, Any]:
    return build_signal_source_patch(
        "google_trends",
        status=status,
        last_run_ms=last_run_ms,
        error_count=error_count,
        last_error=last_error,
    )


def collect_google_trends(
    entries: list[WatchlistEntry],
    *,
    ingest_run_id: str,
    collected_at_ms: int | None = None,
    interest_fetcher: Callable[[WatchlistEntry], int] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Collect search_volume events for each watchlist entry.
    Returns (events, signalSources patch for google_trends).
    """
    if not entries:
        now = collected_at_ms or int(time.time() * 1000)
        return [], build_google_trends_source_patch(
            status="ok",
            last_run_ms=now,
            error_count=0,
            last_error=None,
        )

    if interest_fetcher is not None:
        fetch = interest_fetcher
    else:
        if _TrendReq is None:
            raise RuntimeError("pytrends is required (pip install pytrends)")
        trend_client = _TrendReq(hl="en-US", tz=0)

        def fetch(entry: WatchlistEntry) -> int:
            return fetch_google_trends_interest(entry, trend_client=trend_client)

    run_at = collected_at_ms or int(time.time() * 1000)
    events: list[dict[str, Any]] = []
    error_count = 0
    last_error: str | None = None
    aborted = False

    for entry in entries:
        if aborted:
            break
        try:
            interest = fetch(entry)
        except TrendsRateLimitError as err:
            error_count += 1
            last_error = "Google Trends rate limited (429/403)"
            aborted = True
            break
        except TrendsEmptyResponseError:
            error_count += 1
            continue
        except Exception as err:
            if _exception_is_trends_rate_limit(err):
                error_count += 1
                last_error = "Google Trends rate limited (429/403)"
                aborted = True
                break
            error_count += 1
            continue

        events.append(
            build_google_trends_event(
                entry,
                interest=interest,
                ingest_run_id=ingest_run_id,
                collected_at_ms=run_at,
            )
        )

    if aborted and events:
        status: Literal["ok", "partial", "error"] = "partial"
    elif aborted or (error_count and not events):
        status = "error"
    elif error_count:
        status = "partial"
    else:
        status = "ok"

    patch = build_google_trends_source_patch(
        status=status,
        last_run_ms=run_at,
        error_count=error_count,
        last_error=last_error,
    )
    return events, patch


def require_reddit_credentials(env: dict[str, str]) -> tuple[str, str, str]:
    client_id = env.get("REDDIT_CLIENT_ID", "").strip()
    client_secret = env.get("REDDIT_CLIENT_SECRET", "").strip()
    user_agent = env.get("REDDIT_USER_AGENT", "").strip()
    if not client_id or not client_secret or not user_agent:
        raise ValueError(
            "REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT "
            "are required in trend-ingest.env for reddit"
        )
    return client_id, client_secret, user_agent


def create_reddit_client(env: dict[str, str]) -> Any:
    """One PRAW client per reddit ingest run (cron hardening — 44-4-1)."""
    if _praw is None:
        raise RuntimeError("praw is required (pip install praw)")
    client_id, client_secret, user_agent = require_reddit_credentials(env)
    return _praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )


def fetch_reddit_mention_count(
    entry: WatchlistEntry,
    *,
    env: dict[str, str] | None = None,
    reddit: Any | None = None,
    window_hours: int = REDDIT_NEWS_WINDOW_HOURS,
) -> float:
    if reddit is None:
        if env is None:
            raise ValueError("fetch_reddit_mention_count requires reddit or env")
        reddit = create_reddit_client(env)
    time_filter = _reddit_time_filter_for_window(window_hours)
    count = 0
    for _ in reddit.subreddit("all").search(
        entry.keyword, time_filter=time_filter, limit=REDDIT_SEARCH_LIMIT
    ):
        count += 1
    return float(count)


def require_newsapi_key(env: dict[str, str]) -> str:
    api_key = env.get("NEWSAPI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("NEWSAPI_API_KEY is required in trend-ingest.env for news")
    return api_key


def _reddit_time_filter_for_window(window_hours: int) -> str:
    if window_hours <= 24:
        return "day"
    if window_hours <= 168:
        return "week"
    if window_hours <= 720:
        return "month"
    return "year"


def fetch_news_article_count(
    entry: WatchlistEntry,
    *,
    env: dict[str, str],
    window_hours: int = REDDIT_NEWS_WINDOW_HOURS,
    collected_at_ms: int | None = None,
) -> float:
    api_key = require_newsapi_key(env)
    run_at = collected_at_ms if collected_at_ms is not None else int(time.time() * 1000)
    from_dt = datetime.fromtimestamp(
        (run_at - window_hours * 3_600_000) / 1000, tz=timezone.utc
    )
    params = urllib.parse.urlencode(
        {
            "q": entry.keyword,
            "from": from_dt.strftime("%Y-%m-%dT%H:%M:%S"),
            "pageSize": 1,
            "apiKey": api_key,
        }
    )
    url = f"{NEWSAPI_EVERYTHING_URL}?{params}"
    request = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(request, timeout=CONVEX_PUSH_TIMEOUT_SEC) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        raise CollectorKeywordError(f"NewsAPI HTTP {err.code}") from err
    except urllib.error.URLError as err:
        raise CollectorKeywordError(f"NewsAPI request failed: {err.reason}") from err

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as err:
        raise CollectorKeywordError("NewsAPI response was not valid JSON") from err

    if not isinstance(payload, dict) or payload.get("status") != "ok":
        message = payload.get("message") if isinstance(payload, dict) else None
        raise CollectorKeywordError(
            message if isinstance(message, str) else "NewsAPI returned error status"
        )

    total = payload.get("totalResults", 0)
    if not isinstance(total, (int, float)) or total < 0:
        raise CollectorKeywordError("NewsAPI totalResults missing or invalid")
    return float(total)


def collect_minmax_source(
    entries: list[WatchlistEntry],
    *,
    source: SourceName,
    signal_type: str,
    norm_method: str,
    ingest_run_id: str,
    norm_cache: dict[str, Any],
    collected_at_ms: int | None = None,
    count_fetcher: Callable[[WatchlistEntry], float],
    window_hours: int = REDDIT_NEWS_WINDOW_HOURS,
    collection_method: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    run_at = collected_at_ms or int(time.time() * 1000)
    if not entries:
        return [], build_signal_source_patch(
            source,
            status="ok",
            last_run_ms=run_at,
            error_count=0,
            last_error=None,
        )

    events: list[dict[str, Any]] = []
    error_count = 0
    last_error: str | None = None

    for entry in entries:
        try:
            raw_value = count_fetcher(entry)
        except CollectorKeywordError as err:
            error_count += 1
            last_error = str(err)[:240]
            continue
        except Exception as err:
            error_count += 1
            last_error = str(err)[:240]
            continue

        if raw_value < 0:
            error_count += 1
            last_error = "negative raw count"
            continue

        history = _history_samples_for_key(
            norm_cache, entry.topic_slug, source, collected_at_ms=run_at
        )
        normalized = minmax_normalize_7d(raw_value, history)
        record_norm_cache_sample(
            norm_cache,
            topic_slug=entry.topic_slug,
            source=source,
            value=raw_value,
            collected_at_ms=run_at,
        )
        events.append(
            build_minmax_signal_event(
                entry,
                source=source,
                signal_type=signal_type,
                raw_value=raw_value,
                normalized_value=normalized,
                norm_method=norm_method,
                ingest_run_id=ingest_run_id,
                collected_at_ms=run_at,
                window_hours=window_hours,
                collection_method=collection_method,
            )
        )

    if error_count and not events:
        status: Literal["ok", "partial", "error"] = "error"
    elif error_count:
        status = "partial"
    else:
        status = "ok"

    return events, build_signal_source_patch(
        source,
        status=status,
        last_run_ms=run_at,
        error_count=error_count,
        last_error=last_error,
    )


def collect_reddit(
    entries: list[WatchlistEntry],
    *,
    ingest_run_id: str,
    norm_cache: dict[str, Any],
    env: dict[str, str],
    collected_at_ms: int | None = None,
    count_fetcher: Callable[[WatchlistEntry], float] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    run_at = collected_at_ms or int(time.time() * 1000)
    if count_fetcher is None:
        reddit = create_reddit_client(env)
        fetch: Callable[[WatchlistEntry], float] = lambda entry: fetch_reddit_mention_count(
            entry, reddit=reddit, window_hours=REDDIT_NEWS_WINDOW_HOURS
        )
    else:
        fetch = count_fetcher
    return collect_minmax_source(
        entries,
        source="reddit",
        signal_type=REDDIT_SIGNAL_TYPE,
        norm_method=REDDIT_NORM_METHOD,
        ingest_run_id=ingest_run_id,
        norm_cache=norm_cache,
        collected_at_ms=run_at,
        count_fetcher=fetch,
        collection_method=REDDIT_COLLECTION_METHOD,
    )


def collect_news(
    entries: list[WatchlistEntry],
    *,
    ingest_run_id: str,
    norm_cache: dict[str, Any],
    env: dict[str, str],
    collected_at_ms: int | None = None,
    count_fetcher: Callable[[WatchlistEntry], float] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    run_at = collected_at_ms or int(time.time() * 1000)
    fetch = count_fetcher or (
        lambda entry: fetch_news_article_count(
            entry, env=env, collected_at_ms=run_at
        )
    )
    return collect_minmax_source(
        entries,
        source="news",
        signal_type=NEWS_SIGNAL_TYPE,
        norm_method=NEWS_NORM_METHOD,
        ingest_run_id=ingest_run_id,
        norm_cache=norm_cache,
        collected_at_ms=run_at,
        count_fetcher=fetch,
    )


def _source_collector_error_patch(
    source: SourceName,
    *,
    last_run_ms: int,
    message: str,
) -> dict[str, Any]:
    return build_signal_source_patch(
        source,
        status="error",
        last_run_ms=last_run_ms,
        error_count=1,
        last_error=message[:240],
    )


def build_batch(
    *,
    watchlist: list[WatchlistEntry],
    active_sources: list[SourceName],
    ingest_run_id: str | None = None,
) -> SignalIngestBatch:
    run_id = ingest_run_id or str(uuid.uuid4())
    return SignalIngestBatch(
        ingest_run_id=run_id,
        active_sources=active_sources,
        events=[],
        watchlist=watchlist_to_wire(watchlist),
        signal_sources=[],
    )


def run(argv: list[str] | None = None) -> int:
    started = time.monotonic()
    parser = argparse.ArgumentParser(
        description="CNS trend signal ingest",
        epilog=(
            "Examples:\n"
            "  python3 scripts/trend-ingest.py --dry-run --sources news\n"
            "  python3 scripts/trend-ingest.py --source reddit\n"
            "  python3 scripts/trend-ingest.py --sources google_trends"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print SignalIngestBatch JSON to stdout; no HTTP push",
    )
    parser.add_argument(
        "--sources",
        default=None,
        metavar="NAMES",
        help=(
            "Comma-separated active sources for this run: "
            "google_trends, reddit, news (cron: --sources news | reddit | google_trends)"
        ),
    )
    parser.add_argument(
        "--source",
        default=None,
        metavar="NAME",
        help="Single source alias (equivalent to --sources NAME)",
    )
    args = parser.parse_args(argv)

    if args.source is not None and args.sources is not None:
        print(
            "FATAL: use either --source or --sources, not both",
            file=sys.stderr,
        )
        return 1

    if yaml is None:
        print("FATAL: PyYAML is required (pip install pyyaml)", file=sys.stderr)
        return 1

    env_path = _default_ingest_env_path()
    env_vars = load_ingest_env(env_path) if env_path.is_file() else {}
    if not env_path.is_file():
        print(f"warning: ingest env not found at {env_path}", file=sys.stderr)

    snapshot_at = int(time.time() * 1000)
    watchlist_path = _default_watchlist_path()
    log_path = _default_ingest_log_path()

    try:
        snapshot = load_watchlist_snapshot(watchlist_path, snapshot_at)
    except ValueError as err:
        print(f"FATAL: {err}", file=sys.stderr)
        return 1

    if not snapshot:
        print(
            f"warning: watchlist empty or missing at {watchlist_path}; skipping ingest",
            file=sys.stderr,
        )
        return 0

    sources_raw = args.source if args.source is not None else args.sources
    try:
        active_sources = parse_sources_arg(sources_raw)
    except ValueError as err:
        print(f"FATAL: {err}", file=sys.stderr)
        return 1

    batch = build_batch(watchlist=snapshot, active_sources=active_sources)
    exit_code = 0
    log_outcome = "ok"
    log_error: str | None = None
    log_http_status: int | None = None

    def duration_ms() -> int:
        return int((time.monotonic() - started) * 1000)

    def write_run_log() -> None:
        append_ingest_log(
            build_ingest_log_record(
                batch,
                dry_run=args.dry_run,
                duration_ms=duration_ms(),
                outcome=log_outcome,
                http_status=log_http_status,
                error=log_error,
            ),
            log_path,
        )

    try:
        norm_cache: dict[str, Any] | None = None
        norm_cache_path = _default_norm_cache_path()
        if "reddit" in active_sources or "news" in active_sources:
            try:
                norm_cache = load_norm_cache(norm_cache_path)
            except ValueError as err:
                print(f"FATAL: {err}", file=sys.stderr)
                log_outcome = "error"
                log_error = str(err)
                exit_code = 1
                return exit_code

        if "google_trends" in active_sources:
            if _TrendReq is None:
                print(
                    "FATAL: pytrends is required for google_trends (pip install pytrends)",
                    file=sys.stderr,
                )
                log_outcome = "error"
                log_error = "pytrends is required for google_trends (pip install pytrends)"
                exit_code = 1
                return exit_code
            try:
                events, trends_patch = collect_google_trends(
                    snapshot,
                    ingest_run_id=batch.ingest_run_id,
                    collected_at_ms=snapshot_at,
                )
            except RuntimeError as err:
                print(f"FATAL: {err}", file=sys.stderr)
                log_outcome = "error"
                log_error = str(err)
                exit_code = 1
                return exit_code
            batch.events.extend(events)
            batch.signal_sources.append(trends_patch)

        if "reddit" in active_sources:
            if _praw is None:
                reddit_events, reddit_patch = [], _source_collector_error_patch(
                    "reddit",
                    last_run_ms=snapshot_at,
                    message="praw is required for reddit (pip install praw)",
                )
            else:
                try:
                    reddit_events, reddit_patch = collect_reddit(
                        snapshot,
                        ingest_run_id=batch.ingest_run_id,
                        norm_cache=norm_cache
                        or {"version": NORM_CACHE_VERSION, "entries": {}},
                        env=env_vars,
                        collected_at_ms=snapshot_at,
                    )
                except (ValueError, RuntimeError) as err:
                    reddit_events, reddit_patch = [], _source_collector_error_patch(
                        "reddit",
                        last_run_ms=snapshot_at,
                        message=str(err),
                    )
            batch.events.extend(reddit_events)
            batch.signal_sources.append(reddit_patch)

        if "news" in active_sources:
            try:
                news_events, news_patch = collect_news(
                    snapshot,
                    ingest_run_id=batch.ingest_run_id,
                    norm_cache=norm_cache or {"version": NORM_CACHE_VERSION, "entries": {}},
                    env=env_vars,
                    collected_at_ms=snapshot_at,
                )
            except (ValueError, RuntimeError) as err:
                news_events, news_patch = [], _source_collector_error_patch(
                    "news",
                    last_run_ms=snapshot_at,
                    message=str(err),
                )
            batch.events.extend(news_events)
            batch.signal_sources.append(news_patch)

        if args.dry_run:
            log_outcome = "dry_run"
            print(json.dumps(batch.to_wire_json(), indent=2))
            return 0

        if not active_sources:
            print(
                "warning: no --sources/--source specified; pushing watchlist mirror only",
                file=sys.stderr,
            )

        if norm_cache is not None:
            try:
                save_norm_cache(norm_cache_path, norm_cache)
            except OSError as err:
                print(f"FATAL: could not write norm cache: {err}", file=sys.stderr)
                log_outcome = "error"
                log_error = f"could not write norm cache: {err}"
                exit_code = 1
                return exit_code

        repo_root = repo_root_from_script()
        try:
            pattern_id = scan_batch_for_secret_pattern_id(batch, repo_root)
        except ValueError as err:
            print(f"FATAL: {err}", file=sys.stderr)
            log_outcome = "error"
            log_error = str(err)
            exit_code = 1
            return exit_code
        if pattern_id is not None:
            print(f"FATAL: batch matches secret pattern: {pattern_id}", file=sys.stderr)
            log_outcome = "error"
            log_error = f"batch matches secret pattern: {pattern_id}"
            exit_code = 1
            return exit_code

        try:
            convex_url, deploy_key = require_push_credentials(env_vars)
        except ValueError as err:
            print(f"FATAL: {err}", file=sys.stderr)
            log_outcome = "error"
            log_error = str(err)
            exit_code = 1
            return exit_code

        try:
            pushed_status = push_signal_batch(
                batch,
                convex_url=convex_url,
                deploy_key=deploy_key,
            )
            log_http_status = int(pushed_status)
        except RuntimeError as err:
            print(f"FATAL: trend-ingest push failed: {err}", file=sys.stderr)
            log_outcome = "error"
            log_error = str(err)
            log_http_status = _http_status_from_push_error(err)
            exit_code = 1
            return exit_code

        if not active_sources:
            log_outcome = "watchlist_only"
        else:
            log_outcome = "ok"

        print(
            f"trend-ingest: pushed watchlist ({len(batch.watchlist)} topics), "
            f"{len(batch.events)} events",
            file=sys.stderr,
        )
        return 0
    except Exception as err:
        if log_outcome == "ok":
            print(f"FATAL: {err}", file=sys.stderr)
            log_outcome = "error"
            log_error = str(err)
            exit_code = 1
        return exit_code
    finally:
        write_run_log()


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
