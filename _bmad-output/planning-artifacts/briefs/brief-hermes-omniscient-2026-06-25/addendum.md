# Addendum — Hermes Omniscient Brief

Technical depth parked for PRD / architecture refresh. Not in the 1–2 page brief.

## Voice topology (split-surface)

```
┌─────────────────────────────────────────────────────────────┐
│  Deployed Vercel /nexus                                      │
│  awareness · trends · digest view · async ask (dispatch)    │
│  NO realtime voice v1                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Local Nexus (localhost:5173)                                │
│  JARVIS voice pane · push-to-talk · streaming TTS            │
│       │                                                      │
│       ▼ SvelteKit server routes (same machine / WSL network)  │
│  WSL Hermes gateway (:9119) + Brain recall + memory          │
│       │                                                      │
│       ▼ tts.provider: elevenlabs                             │
│  Audio stream → browser                                      │
└─────────────────────────────────────────────────────────────┘
```

## ElevenLabs — what it fixes vs what it doesn't

| Layer | v1 approach |
|-------|-------------|
| TTS quality | `tts.provider: elevenlabs` in `~/.hermes/config.yaml` |
| Streaming out | Hermes voice mode or ElevenLabs multi-stream WebSocket from response text |
| STT in | Browser mic → local API → faster-whisper / Hermes voice skill on WSL |
| Brain / recall | Hermes + Brain index — **not** ElevenLabs ConvAI agent |
| Duplex | Deferred — Hermes #35750 or ConvAI bridge research |

## Open research (post-v1)

1. ElevenLabs ConvAI WebSocket as UX layer bridged to Hermes MCP tools
2. Tailscale funnel for deployed `/nexus` voice
3. Recall injection token budget per voice turn (shorter than text?)
