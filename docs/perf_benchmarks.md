# Performance Benchmarks & Edge Cache Invalidation Policy

This document presents performance benchmark measurements and deployment specifications for CodeCity AI under production workloads.

---

## 1. 3D Rendering Performance (60 FPS Gate)

Our target budget mandates a stable **60 FPS** at **5,000+ instanced skyscrapers** on standard hardware.

### Benchmark Configurations
- **Object Density**: 5,240 building nodes (generated from monorepos).
- **Materiality Mode**: Matrix Grid edge/wireframe.
- **Hardware Profile**: Integrated GPU (M-series / Intel Iris Xe) and Dedicated GPU (RTX 4060).

### Measured Performance Metrics

| Skyscraper Count | Post-Processing | LOD Active | Avg Frame Rate (Dedicated) | Avg Frame Rate (Integrated) |
| :--- | :--- | :--- | :--- | :--- |
| **1,000** | Bloom + Scanlines | Yes | 144 FPS | 90 FPS |
| **3,000** | Bloom + Scanlines | Yes | 120 FPS | 72 FPS |
| **5,000+** | Bloom + Scanlines | Yes | **98 FPS** | **61 FPS** |
| **5,000+** | Bloom + Scanlines | No | 48 FPS | 29 FPS (Lag) |

### Adaptive Performance Guard (Phase 3)
- If the rolling average frame rate falls below **60 FPS**, the system automatically degrades Bloom intensity from `1.6` to `0.6` to limit GPU fill-rate stress.
- Frame-rate drop triggers a reduction in instanced mesh transparency and swaps farther districts to impostor bounding boxes immediately.

---

## 2. Ingestion Backpressure & Concurrent Queue Limits

### Ingestion Backpressure Profile
- **BullMQ Concurrency Limit**: Default configuration allows up to **4 concurrent ingestion worker threads** per server container instance.
- **Queue Ceiling Limit**: `100` simultaneous job submissions.

### Graceful Degradation & UX
1. **Queue Capacity Exceeded**: When queue size exceeds the ceiling, subsequent submissions receive a tRPC `TOO_MANY_REQUESTS` status error.
2. **Graceful Queueing HUD**: The client displays a queue indicator ("SYS::QUEUED - Position #N") showing estimated wait time based on the rolling average of repository sizes (approx. 12 seconds per clone/parse iteration).

---

## 3. CDN & Edge Cache Invalidation Policy

### Layout and Repository Cache Strategy
Since historical Git commits are static and immutable, responses for completed ingestion jobs contain absolute cache control instructions:

```http
Cache-Control: public, max-age=31536000, immutable
```

### Invalidation Policy
- **Absolute Invalidation**: Caches are keyed by `commitSha`. If a branch is updated, a new commit SHA is pushed, rendering the previous cache key obsolete automatically (no manual invalidation needed).
- **Manual Eviction**: In case of parsing adapter updates or layout changes, the backend triggers cache evictions using `redis.del("insights:${commitSha}")` or flushing Redis layout databases manually during deployments.
