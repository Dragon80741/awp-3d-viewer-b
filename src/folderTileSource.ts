import type { TileSource } from '@humkyung/viewer3d'

export async function createFolderTileSource(folderUrl: string): Promise<TileSource> {
  const base = folderUrl.replace(/\/+$/, '')
  const manifestUrl = `${base}/manifest.json`
  const res = await fetch(manifestUrl)
  if (!res.ok) {
    throw new Error(`manifest.json 을 받지 못했습니다 (HTTP ${res.status})`)
  }
  const manifest = (await res.json()) as {
    tiles: { id: string; file?: string; variants?: { file: string; div: number }[] }[]
  }
  const fileOf = new Map<string, string>()
  for (const t of manifest.tiles) {
    fileOf.set(t.id, t.file ?? `tile-${t.id}.glb`)
    for (const v of t.variants ?? []) {
      fileOf.set(`${t.id}?lod=${v.div}`, v.file)
    }
  }
  return {
    manifestUrl,
    treeUrl: `${base}/tree.json`,
    statsUrl: `${base}/stats.txt`,
    tileUrl: (id, lod) => `${base}/${fileOf.get(lod ? `${id}?lod=${lod}` : id) ?? `tile-${id}.glb`}`,
    modelUrl: null,
    fetch: (url, init) => fetch(url, init),
  }
}
