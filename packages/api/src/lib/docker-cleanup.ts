import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * Force-remove a container by ID. Idempotent — silently succeeds if the
 * container is already gone.
 */
export async function forceRemoveContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  try {
    await container.stop({ t: 5 });
  } catch {
    // May already be stopped or gone
  }
  try {
    await container.remove({ force: true, v: true });
    console.log(`[docker-cleanup] Removed container ${containerId.slice(0, 12)}`);
  } catch (err: any) {
    if (err.statusCode !== 404) {
      console.error(`[docker-cleanup] Failed to remove ${containerId.slice(0, 12)}:`, err.message);
    }
    // 404 = already gone — that's fine (idempotent)
  }
}

/**
 * Remove stopped (exited) orgo-managed containers older than the given age.
 * Returns the list of short container IDs that were pruned.
 */
export async function pruneStoppedContainers(olderThanMs: number): Promise<string[]> {
  const containers = await docker.listContainers({
    all: true,
    filters: {
      status: ['exited', 'dead'],
      label: ['orgo.managed=true'],
    },
  });

  const cutoff = Date.now() - olderThanMs;
  const removed: string[] = [];

  for (const info of containers) {
    if (info.Created * 1000 < cutoff) {
      try {
        await docker.getContainer(info.Id).remove({ force: true, v: true });
        removed.push(info.Id.slice(0, 12));
      } catch (err: any) {
        if (err.statusCode !== 404) {
          console.error(`[docker-cleanup] Failed to prune ${info.Id.slice(0, 12)}:`, err.message);
        }
      }
    }
  }

  if (removed.length > 0) {
    console.log(`[docker-cleanup] Pruned ${removed.length} stopped container(s)`);
  }

  return removed;
}

/**
 * Prune dangling images. Idempotent.
 */
export async function pruneImages(): Promise<void> {
  try {
    const result = await docker.pruneImages({ filters: { dangling: { true: true } } });
    const reclaimed = result.SpaceReclaimed || 0;
    if (reclaimed > 0) {
      console.log(`[docker-cleanup] Pruned images, reclaimed ${Math.round(reclaimed / 1024 / 1024)}MB`);
    }
  } catch (err: any) {
    console.error('[docker-cleanup] Failed to prune images:', err.message);
  }
}

/**
 * Prune unused networks. Idempotent.
 */
export async function pruneNetworks(): Promise<void> {
  try {
    const result = await docker.pruneNetworks();
    const count = result.NetworksDeleted?.length || 0;
    if (count > 0) {
      console.log(`[docker-cleanup] Pruned ${count} network(s)`);
    }
  } catch (err: any) {
    console.error('[docker-cleanup] Failed to prune networks:', err.message);
  }
}

/**
 * Get container IDs present in Docker but not in the provided known set.
 * Only considers orgo-managed containers.
 */
export async function getOrphanedContainers(knownContainerIds: Set<string>): Promise<string[]> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['orgo.managed=true'] },
    });

    return containers
      .filter((c) => !knownContainerIds.has(c.Id))
      .map((c) => c.Id);
  } catch (err: any) {
    console.error('[docker-cleanup] Failed to list containers:', err.message);
    return [];
  }
}

/**
 * Collect live CPU and memory stats for all running orgo-managed containers.
 * Used by the resource monitor worker.
 */
export async function getContainerStats(): Promise<
  Array<{ id: string; name: string; cpu: number; memory: number }>
> {
  const containers = await docker.listContainers({
    filters: { label: ['orgo.managed=true'] },
  });

  const stats: Array<{ id: string; name: string; cpu: number; memory: number }> = [];

  for (const info of containers) {
    try {
      const container = docker.getContainer(info.Id);
      const s = await container.stats({ stream: false });

      const cpuDelta =
        s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        s.cpu_stats.system_cpu_usage - s.precpu_stats.system_cpu_usage;
      const numCpus = s.cpu_stats.online_cpus || 1;
      const cpuPercent =
        systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

      stats.push({
        id: info.Id.slice(0, 12),
        name: info.Names[0]?.replace(/^\//, '') || '',
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: s.memory_stats.usage || 0,
      });
    } catch {
      // Container may have stopped between list and stats call
    }
  }

  return stats;
}
