# Solo context and player partitions

Solo save requests, narration requests and autonomous action requests carry the
same browser `x-player-id`. This identifier partitions local data; it is not an
authentication credential. Co-op retains its separate authenticated room model.

Dynamic mirrors now live under `vault/dynamic/players/<normalized-player-id>/`,
including session JSON, state, history and the two override files. Normalization
matches the existing save adapter. Requests without an identifier use a separate
`local-player` directory. They never read another browser's mirrors.

Existing singleton files directly under `vault/dynamic/` are preserved and ignored.
Their owner cannot be recovered safely. Load or save an existing owner-scoped slot
to regenerate its new mirrors. Move any legacy overrides manually only after
identifying the correct owner; no automatic migration assumes who wrote them.
