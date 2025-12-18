# Cache & Update Controls

Guidance on caching, clearing, and update checks.

## Cache Behavior
- Local cache stores entries, contracts, defaults, and metadata for fast loads.
- Status badge reflects cache state; loads and saves are optimistic where possible.

## Controls
- Clear Cache button appears when `show_clear_cache` is enabled; clears local storage to force fresh fetch.
- Remember Last Page (`remember_last_page`): reopens the last viewed page after refresh.
- Update check: About page shows build date and warns when a newer build exists.

## Tips
- Use clear cache if UI seems stale or after sheet-side edits.
- Reload after flag changes to ensure UI reflects enabled features.

