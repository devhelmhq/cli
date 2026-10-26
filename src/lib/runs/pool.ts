/** Run `fn` over `items` with at most `limit` in flight (validation runs, deploy tests). */
export async function runPool<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  const workers = Array.from({length: Math.max(1, Math.min(limit, queue.length))}, async () => {
    while (queue.length > 0) {
      const next = queue.shift()
      if (next !== undefined) await fn(next)
    }
  })
  await Promise.all(workers)
}
