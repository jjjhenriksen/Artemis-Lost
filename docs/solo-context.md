# Solo context and player partitions

Solo save requests, narration requests and autonomous action requests carry the
same browser `x-player-id`. This identifier partitions local data; it is not an
authentication credential. Co-op retains its separate authenticated room model.

Dynamic mirrors now live under `vault/dynamic/players/<portable-owner-path>/`,
including session JSON, state, history and the two override files. Normalization
matches the existing save adapter. Requests without an identifier use a separate
`local-player` directory. They never read another browser's mirrors.

Existing singleton files directly under `vault/dynamic/` are preserved and ignored.
Their owner cannot be recovered safely. Load or save an existing owner-scoped slot
to regenerate its new mirrors. Move any legacy overrides manually only after
identifying the correct owner; no automatic migration assumes who wrote them.

Vault prompt context has a default 4,000-byte maximum per section and
16,000-byte total maximum, including headings and truncation notices.
`VAULT_SECTION_MAX_BYTES` accepts 256–65,536 and `VAULT_TOTAL_MAX_BYTES` accepts
2,048–262,144 integer UTF-8 byte counts. Each section receives a fair share
of the total, so long static lore cannot crowd out the latest log. Truncated log
context keeps its newest entries and explicitly tells the model that older
material was omitted. Other sections retain their beginning with a truncation
notice. These limits apply to vault context, independently of world state and
the prompt builder's recent conversation history.

Stored saves and mirrored logs retain their full content. Budgeting happens when
formatting model context; it never rewrites or truncates persisted history.

Both provider transports abort stalled requests and stalled response-body reads.
`LLM_TIMEOUT_MS` defaults to 30,000 ms and accepts integer values from 1 through
120,000. Invalid settings reject a call with `INVALID_PROVIDER_TIMEOUT` before
starting its network request. Solo DM and autonomous endpoints return HTTP 504,
`code: TURN_TIMEOUT` and `retryable: true` for a timeout. Client helpers retain
these fields, so callers can distinguish this failure from a normal response.
No automatic retry invokes a provider a second time. Co-op keeps its additional
30-second authoritative turn deadline and durable command receipts.
