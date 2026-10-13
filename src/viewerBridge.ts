import type { TreeIndex } from '@humkyung/viewer3d'
import { pathOf } from '@humkyung/viewer3d'

/**
 * AWP Platform <-> 3D Viewer Bridge Protocol
 */

export type AwpSelectTagsMessage = {
  type: 'AWP_SELECT_TAGS'
  tags: string[]
  cwp?: string | null
  iwp?: string | null
  focusCamera?: boolean // default: true
  isolate?: boolean // default: false
}

export type AwpSetWorkpackageInfoMessage = {
  type: 'AWP_SET_WORKPACKAGE_INFO'
  payload: {
    cwp?: string | null
    iwp?: string | null
    line?: string | null
  }
}

export type AwpSelectItemsMessage = {
  type: 'AWP_SELECT_ITEMS'
  item_ids?: Array<string | number>
  itemIds?: Array<string | number>
  items?: Array<string | number>
  focusCamera?: boolean
  isolate?: boolean
}

export type AwpClearSelectionMessage = {
  type: 'AWP_CLEAR_SELECTION'
}

export type AwpInboundMessage =
  | AwpSelectTagsMessage
  | AwpSetWorkpackageInfoMessage
  | AwpSelectItemsMessage
  | AwpClearSelectionMessage

export type ViewerOutboundSelectedEvent = {
  type: 'VIEWER_OBJECT_SELECTED'
  payload: {
    oid: string
    pickId?: number
    tag?: string | null
    objectName?: string | null
    systemPath?: string | null
  }
}

export type ViewerOutboundReadyEvent = {
  type: 'VIEWER_READY'
  payload: {
    engine: string
    dataset: string
  }
}

export type ViewerOutboundEvent =
  | ViewerOutboundSelectedEvent
  | ViewerOutboundReadyEvent

/**
 * Send event from 3D Viewer to Parent Platform (AWP)
 */
export function sendToParentPlatform(event: ViewerOutboundEvent) {
  if (typeof window === 'undefined') return
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(event, '*')
  }
}

/**
 * Collect all piece IDs under a given tree item (recursive)
 */
export function collectPiecesForItem(idx: TreeIndex, item: number): number[] {
  const pieces: number[] = []
  const stack = [item]
  while (stack.length > 0) {
    const curr = stack.pop()!
    const from = idx.ownFrom[curr]
    const to = idx.ownFrom[curr + 1]
    for (let k = from; k < to; k++) {
      pieces.push(idx.ownAt[k])
    }
    const cFrom = idx.childFrom[curr]
    const cTo = idx.childFrom[curr + 1]
    for (let c = cFrom; c < cTo; c++) {
      stack.push(idx.childAt[c])
    }
  }
  return pieces
}

/**
 * Search items in TreeIndex matching any of the given tags
 */
export function findItemsAndPiecesByTags(
  idx: TreeIndex,
  tags: string[],
): { items: number[]; pieces: number[] } {
  const cleanTags = tags
    .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
    .filter(Boolean)

  if (cleanTags.length === 0) return { items: [], pieces: [] }

  const matchedItems: number[] = []
  const names = idx.tree.name

  for (let i = 0; i < names.length; i++) {
    const n = names[i]
    if (!n) continue
    const lowerName = n.toLowerCase()
    for (const tag of cleanTags) {
      if (lowerName === tag || lowerName.includes(tag)) {
        matchedItems.push(i)
        break
      }
    }
  }

  const allPieces: number[] = []
  for (const item of matchedItems) {
    allPieces.push(...collectPiecesForItem(idx, item))
  }

  return {
    items: matchedItems,
    pieces: Array.from(new Set(allPieces)),
  }
}

/**
 * Type guard for AWP Inbound Messages
 */
export function isAwpInboundMessage(data: unknown): data is AwpInboundMessage {
  if (!data || typeof data !== 'object') return false
  const candidate = data as { type?: unknown }
  return (
    candidate.type === 'AWP_SELECT_TAGS' ||
    candidate.type === 'AWP_SET_WORKPACKAGE_INFO' ||
    candidate.type === 'AWP_SELECT_ITEMS' ||
    candidate.type === 'AWP_CLEAR_SELECTION' ||
    candidate.type === 'CAPTURE_3D_SNAPSHOT' ||
    candidate.type === 'CAPTURE_3D_VIEW'
  )
}
