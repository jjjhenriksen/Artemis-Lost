# Save integrity and verification

Session writes validate the nested world, narration, history and a finite nonnegative integer turn before creating storage paths or persisting anything. GET, PUT and DELETE share the slot allowlist (`slot-1`, `slot-2`, `slot-3`). Unknown identifiers return HTTP 400 with `INVALID_SAVE_SLOT`; a known empty slot returns HTTP 200 with `session: null`.

Filesystem reads treat only `ENOENT` as absence. Invalid JSON and invalid session/index structures raise `SAVE_CORRUPT`; other read failures raise `SAVE_IO_ERROR`. Public messages give recovery steps without exposing filesystem paths. The files are retained after read failures.

Filesystem slot and owner-index replacements use a unique sibling temporary file, flush its contents, close it, and rename it over the destination. An interrupted write leaves the previous complete destination. A process killed before cleanup can leave an unused `.tmp` file; readers ignore it. Save, load, delete and listing operations share an owner queue across adapter instances in a server process, preventing stale index updates. The unused legacy global index no longer needs to be initialized.

Filesystem serialization assumes one server process for a given data directory. Use PostgreSQL for multiple server processes. The filesystem slot and index are individually atomic files, not a transaction spanning both files; if interrupted between replacements, the slot remains readable while index metadata may lag. This change does not claim power-loss durability of directory entries or transactional mirror publication.

PostgreSQL saves and deletes execute their session operation and active-slot metadata change in one transaction. A transaction-scoped advisory lock serializes each owner's mutations across connections. A failed metadata statement rolls back the preceding session statement.

## Regression evidence

Baseline commit: `2f82089c6fe7e12d493abc61093bb280dbed18bb`.

- The original 38 tests passed.
- New API validation tests reproduced 16 failures against that baseline: malformed sessions and unknown slots reached injected storage implementations.
- New filesystem and real PostgreSQL tests reproduced 11 failures against the baseline, including lost concurrent timestamps, swallowed read failures, actual `SIGKILL` truncation of slot/index files, and failed rollback after metadata-trigger exceptions.
- With the fixes, 80 tests in 17 files pass when the isolated database suite is enabled. The production build passes.

Coverage includes:

- `tests/sessionStorageAdapter.test.js`: two concurrent saves retain both timestamps; a child process is killed after real partial writes to slot and index files; missing, invalid JSON, invalid shapes, directory read errors and injected permission denial are distinguished.
- `tests/atomicFile.test.js`: partial write, flush and rename failures preserve the previous bytes and clean temporary files; a rejected queued update releases the queue.
- `tests/sessionDatabase.test.js`: a real PostgreSQL trigger throws on active metadata writes. Tests query both tables afterwards and verify rollback of existing-slot replacement, new-slot insertion and active-slot deletion, as well as successful deletion and owner isolation.
- `tests/sessionValidation.test.js`: malformed nested values, narration/history and turn values fail before persistence; full fixtures, every mission seed and actual local turn updates remain valid.
- `tests/sessionApiStorage.test.js`: malformed API saves leave all existing slot, index and mirror bytes unchanged; valid saves round-trip through the real store; error responses preserve corrupt bytes and conceal paths.
- `tests/sessionStore.test.js`: invalid direct calls fail before creating any storage or mirror paths.

## Running the checks

The ordinary suite needs no provider keys and makes no paid model calls:

```sh
npm ci
npm test
npm run build
```

The database suite deliberately ignores the application's `DATABASE_URL`. It runs only when `ARTEMIS_TEST_DATABASE_URL` explicitly names a disposable local test database. It creates a unique schema and temporary data directory and removes them afterwards. Without that variable the four database tests are reported as skipped.

```sh
ARTEMIS_TEST_DATABASE_URL=postgres://artemis_test:isolated-test-only@127.0.0.1:5432/artemis_test npm test
```

`.github/workflows/save-integrity.yml` supplies an ephemeral PostgreSQL 17 service, runs the full suite including actual rollback, and builds the frontend on pull requests and pushes to main. All fixtures use temporary data directories; no personal saves or vault are used.
