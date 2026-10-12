<!-- USAGE.md — .tgz 로 받은 @humkyung/viewer3d 0.2.3 을 설치하고 쓰는 방법(외부 전달용). -->
# @humkyung/viewer3d 사용 안내 (0.2.3)

nwx 타일 모델을 **보고 재는** React 3D 뷰어입니다. 이 문서는 `.tgz` 파일로 전달받은 패키지를 설치하고 쓰는 방법을 설명합니다.

- 받은 파일: `humkyung-viewer3d-0.2.3.tgz`
- 필요 환경: React 19, three.js 0.185, ES 모듈 번들러(Vite 권장)

---

## 1. 할 수 있는 것

| 구분 | 기능 |
|---|---|
| 보기 | 궤도 회전·줌·이동, 뷰 프리셋(iso·top·front·right), 전체 맞춤 |
| 적재 | nwx 타일 모델을 보이는 곳부터 받기(LOD·메모리 예산), 단일 GLB |
| 품질 | 조명, 주변광 차폐(AO), 그림자 |
| 측정 | 거리·각도 |
| 선택 | 부재 클릭 선택, 숨기기·격리·반투명·X-ray, 단면(상자·임의 평면) |
| 패널 | 모델 트리(`ModelTreePanel`), 속성 패널(`PropertyPane`) |

툴바는 들어 있지 않습니다. 버튼은 앱에서 직접 만들고 **스토어(컨트롤러)** 로 뷰어를 조작합니다(4장).

---

## 2. 설치

### 2.1 패키지 설치

받은 `.tgz` 를 프로젝트 안(예: `vendor/`)에 두고 설치합니다.

```bash
npm install ./vendor/humkyung-viewer3d-0.2.3.tgz
npm install react@^19 react-dom@^19 three@^0.185.1
```

- `package.json` 에 `"@humkyung/viewer3d": "file:vendor/humkyung-viewer3d-0.2.3.tgz"` 로 기록됩니다. **`.tgz` 파일을 저장소에 함께 커밋해야** 다른 PC·CI 에서도 설치됩니다.
- `react`·`react-dom`·`three` 는 **peer 의존**입니다. 앱에 있는 한 벌을 씁니다.
- 그 밖의 의존(`camera-controls`·`n8ao`·`three-mesh-bvh`·`zustand`)은 공개 npm 에서 자동으로 설치됩니다. 별도 토큰은 필요 없습니다.
- 새 버전을 받으면 새 `.tgz` 로 다시 `npm install` 합니다.

### 2.2 번들러 설정 (Vite)

`three`·`react` 가 두 벌 잡히면 장면이 그려지지 않거나 훅 오류가 납니다. 한 벌로 묶어 주세요.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['three', 'react', 'react-dom', 'zustand'] },
})
```

### 2.3 CSP

glTF 해석 워커가 번들 안에 들어 있고 Blob URL 로 뜹니다. Content-Security-Policy 를 쓰면 `worker-src blob:` 을 허용해 주세요. 막히면 해석이 메인 스레드로 넘어가 큰 모델에서 화면이 멈춥니다.

---

## 3. 빠른 시작

```tsx
import { useMemo } from 'react'
import {
  Viewer3D, ModelTreePanel, PropertyPane,
  createViewerStore, createHttpTileSource,
} from '@humkyung/viewer3d'
import '@humkyung/viewer3d/style.css'

// 뷰어 하나에 스토어 하나. 버튼·트리·속성 패널이 모두 이것으로 뷰어를 조작한다.
const store = createViewerStore()

export function ModelScreen({ modelId }: { modelId: string }) {
  const source = useMemo(
    () => createHttpTileSource({ baseUrl: `/api/models/${modelId}/tiles`, fetch: appFetch }),
    [modelId],
  )
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Viewer3D documentId={modelId} source={source} store={store} onLog={(e) => showToast(e.message)} partPick />
      </div>
      <aside style={{ width: 340, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 3, minHeight: 0 }}><ModelTreePanel store={store} /></div>
        <div style={{ flex: 2, minHeight: 0 }}><PropertyPane store={store} fetch={source.fetch} /></div>
      </aside>
    </div>
  )
}
```

- `appFetch`·`showToast` 는 앱의 함수입니다(인증 fetch, 알림 표시).
- **뷰어와 패널에는 높이가 있어야 합니다.** 부모에 높이가 없으면(0px) 아무것도 보이지 않습니다.
- `style.css` 를 빠뜨려도 캔버스와 클릭 위치는 어긋나지 않지만, 패널·안내 문구의 모양이 사라집니다.

---

## 4. 스토어(컨트롤러)

`createViewerStore()` 가 만든 스토어가 곧 뷰어의 **리모컨이자 상태**입니다. 명령은 `store.getState().명령()` 으로 부르고, 화면에 보일 값은 `useViewerState` 로 구독합니다.

```tsx
import { useViewerState } from '@humkyung/viewer3d'

function Toolbar() {
  const measure = useViewerState(store, (s) => s.measureMode)
  const clipOn = useViewerState(store, (s) => s.clipOn)
  const s = () => store.getState()
  return (
    <>
      <button onClick={() => s().requestFitAll()}>맞춤</button>
      <button onClick={() => s().setMeasureMode(measure === 'dist' ? 'none' : 'dist')}>거리</button>
      <button onClick={() => s().setMeasureMode(measure === 'angle' ? 'none' : 'angle')}>각도</button>
      <button onClick={() => s().setClipOn(!clipOn)}>단면</button>
      <button onClick={() => s().requestPreset('top')}>위</button>
      <button onClick={() => s().requestHide3d('isolate')}>이것만 보기</button>
      <button onClick={() => s().requestHide3d('showAll')}>전체 표시</button>
    </>
  )
}
```

### 자주 쓰는 명령

| 명령 | 하는 일 |
|---|---|
| `requestFitAll()` | 모델 전체가 화면에 차도록 맞춘다 |
| `requestPreset('iso' \| 'top' \| 'front' \| 'right')` | 뷰 방향을 바꾼다 |
| `setMeasureMode('none' \| 'dist' \| 'angle')` | 측정 모드 |
| `setClipOn(boolean)` | 단면 켜기/끄기 |
| `requestHide3d('hide' \| 'isolate' \| 'ghost' \| 'showAll')` | 고른 것 숨기기·격리·반투명, 전체 되돌리기 |
| `requestHide3d({ kind: 'toggle', ids })` | 지정한 조각만 껐다 켜기(선택과 무관) |
| `requestHide3d({ kind: 'ghostOthers', ids, xray: true })` | **X-ray** — 지정한 조각 말고 나머지를 면 없이 옅은 청회색 선으로. 지정한 조각은 모델 색 그대로 늘 보이고, 앞에 있는 부재의 선만 그 위로 지나가 앞뒤가 읽힌다. 켜져 있는 동안은 지정한 조각만 골라지고 가리켜진다. `xray` 를 빼면 나머지를 원래 색 반투명으로 |
| `requestHide3d({ kind: 'ghostOthers', ids, item, xray: true })` | 트리 노드(`item`) 기준 **X-ray**. 그 노드 아래 조각 전부가 지정한 조각이 되고, 뒤에 받는 타일의 그 아래 조각도 이어진다 |
| `requestHide3d('restore')` | X-ray·`ghostOthers` 를 걸기 직전의 가시성으로 되돌리기 |
| `setGhostOpacity(0~1)` | 반투명 정도 |
| `requestPick3d(ids)` | 조각 번호로 고르기 |
| `requestFit3d(ids)` | 그 조각들이 화면에 차도록 맞추기 |
| `setPickLevel(level)` | 클릭 한 번이 고르는 단위(`PICK_LEVELS` 참고) |
| `openFileViewpoint(at)` | 원본 파일에 저장된 뷰포인트 열기 |

### 자주 읽는 값

| 값 | 뜻 |
|---|---|
| `picked3d` | 고른 조각 목록(`{ id, record? }[]`) |
| `measureMode`·`clipOn` | 측정·단면 상태 |
| `hidden3dIds`·`ghost3dCount` | 숨긴 조각, 반투명 수 |
| `tree3d`·`elements3d` | 모델 트리(NWD)·요소 기록(DGN) — 직접 트리를 그릴 때 |
| `fileViewpoints` | 원본 파일의 뷰포인트 목록 |
| `tileWait` | 아직 화면에 없는 타일(받는 중 / 예산 밖) |

한 화면에 뷰어를 둘 띄우려면 스토어도 **둘** 만드세요. 하나를 나눠 쓰면 선택·숨김·명령이 두 뷰어에 같이 걸립니다.

### X-ray (0.2.0)

지정한 부재만 또렷하게 남기고 나머지를 옅은 선으로 그립니다. 간섭 검토처럼 "이 부재들이 주변 어디에 있는가" 를 볼 때 씁니다.

```tsx
function XrayButtons() {
  const picked = useViewerState(store, (s) => s.picked3d)
  const pickedItem = useViewerState(store, (s) => s.picked3dItem)   // 트리에서 고른 노드(없으면 null)
  const s = () => store.getState()
  return (
    <>
      {/* 고른 부재로 X-ray 를 건다 — 트리에서 노드를 골랐으면 item 도 넘겨 그 노드 아래 전부를 남긴다 */}
      <button disabled={!picked.length}
              onClick={() => s().requestHide3d({
                kind: 'ghostOthers', ids: picked.map((p) => p.id), item: pickedItem ?? undefined, xray: true,
              })}>
        X-ray
      </button>
      {/* 걸기 직전의 가시성으로 되돌린다 */}
      <button onClick={() => s().requestHide3d('restore')}>X-ray 끄기</button>
    </>
  )
}
```

| 보이는 것 | 동작 |
|---|---|
| 지정한 부재 | 모델 원래 색 그대로 늘 보입니다. 앞에 있는 부재의 선만 그 위로 지나가 앞뒤가 읽힙니다 |
| 나머지 부재 | 면 없이 옅은 청회색 선. 앞 부재에 가린 뒤쪽 선은 지워져 부재가 모인 곳도 뭉치지 않습니다 |
| 고르기·가리키기 | 켜져 있는 동안은 **지정한 부재만** 골라지고 테두리가 뜹니다 |
| 뒤에 받은 타일 | 새로 온 구역에도 같은 X-ray 가 걸립니다 |

- `ids` 는 조각 번호입니다. `picked3d` 의 `id`, 또는 트리에서 얻은 번호를 넘깁니다.
- **트리에서 노드를 골라 X-ray 를 켤 때는 `item`(`picked3dItem`)을 함께 넘기세요.** 조각 번호만 넘기면 그 순간 받아 둔 조각만 지정되어, 아직 받지 않은 타일에 든 자식 형상은 선으로만 그려집니다. `item` 을 주면 그 노드 아래 조각 전부가 지정되고, 뒤에 받는 타일에 든 자식도 이어집니다.
- 끄는 방법은 둘입니다. `requestHide3d('restore')` 는 **X-ray 를 처음 걸기 직전**으로 되돌립니다(그 사이 다른 부재로 다시 걸어도 마찬가지). `showAll` 은 숨김·반투명까지 모두 켭니다. 숨기기·격리·반투명 같은 다른 가시성 명령을 하면 X-ray 표시는 풀리고, 나머지 부재는 원래 색 반투명으로 남습니다(`restore` 로는 여전히 걸기 직전으로 돌아갑니다).
- `xray` 를 빼면(`{ kind: 'ghostOthers', ids }`) 나머지를 **원래 색 반투명**으로 그리는 예전 동작입니다. 반투명 정도(`setGhostOpacity`)는 이쪽에만 걸리고, X-ray 선의 옅기에는 걸리지 않습니다.
- 확장 컴포넌트에서는 `useViewerRuntime().focusPieces(ids)` 로도 켜고 `focusPieces(null)` 로 끕니다(9장).

---

## 5. 타일 공급자(`source`)

뷰어는 URL 을 직접 만들지 않고, 공급자(`TileSource`)가 알려 주는 자리에서 받습니다.

### 5.1 서버 배치: `createHttpTileSource`

```ts
const source = createHttpTileSource({
  baseUrl: '/api/models/42/tiles',   // 매니페스트 JSON 자리
  modelUrl: '/api/models/42/model',  // (선택) 매니페스트가 없을 때 받을 단일 GLB
  fetch: appFetch,                   // (권장) 앱의 인증 fetch
})
```

이 공급자는 서버가 아래 배치로 응답한다고 봅니다.

| 요청 | 내용 |
|---|---|
| `GET {baseUrl}` | 매니페스트(JSON). 404 이면 타일 모델이 아니라고 보고 `modelUrl` 을 연다 |
| `GET {baseUrl}/tree` | 모델 트리 색인. 없어도(404) 보기는 된다 |
| `GET {baseUrl}/stats` | 원본 변환 기록(텍스트). 속성 패널에서 펼칠 때만 받는다 |
| `GET {baseUrl}/{id}` · `?lod={n}` | 타일 GLB(원본 / 줄인 변형) |

- **인증이 걸린 서버면 반드시 앱의 fetch 를 넘기세요.** 전역 `fetch` 는 토큰 갱신을 타지 않아, 큰 모델을 받는 도중 토큰이 만료되면 나머지 타일이 전부 실패합니다.
- 응답 헤더 `content-length`·`etag` 를 읽습니다. 다른 출처에서 받으면 CORS 에서 이 헤더를 노출해 주세요.

### 5.2 정적 폴더 등 다른 배치: 직접 짜기

nwx `--tiles` 가 낸 폴더(`manifest.json`·`tree.json`·`stats.txt`·`tile-*.glb`)를 정적 파일로 여는 예입니다.

```ts
import type { TileSource } from '@humkyung/viewer3d'

export async function createFolderTileSource(folderUrl: string): Promise<TileSource> {
  const base = folderUrl.replace(/\/+$/, '')
  const manifestUrl = `${base}/manifest.json`
  const res = await fetch(manifestUrl)
  if (!res.ok) throw new Error(`manifest.json 을 받지 못했습니다 (HTTP ${res.status})`)
  const manifest = (await res.json()) as {
    tiles: { id: string; file?: string; variants?: { file: string; div: number }[] }[]
  }
  // 줄인 변형의 파일 이름은 매니페스트에만 있다 — `tile-{id}.glb` 로 짐작하면 LOD 가 조용히 꺼진다.
  const fileOf = new Map<string, string>()
  for (const t of manifest.tiles) {
    fileOf.set(t.id, t.file ?? `tile-${t.id}.glb`)
    for (const v of t.variants ?? []) fileOf.set(`${t.id}?lod=${v.div}`, v.file)
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
```

모델 데이터(타일 폴더)는 패키지에 들어 있지 않습니다. 변환된 모델은 별도로 전달받습니다.

---

## 6. `Viewer3D` 속성

| prop | 기본값 | 설명 |
|---|---|---|
| `documentId` | (필수) | 연 모델의 식별자. 바뀌면 모델을 새로 연다 |
| `source` | (필수) | 타일 공급자(5장). 모델을 열 때 한 번 읽는다 |
| `store` | 뷰어마다 새로 | 스토어(4장). 툴바·패널을 쓰려면 넘긴다 |
| `onLog` | 콘솔 | 알림 `(event, documentId) => void`. `event` 는 `{ level, scope, message, detail? }` — **넘기세요.** 안 넘기면 적재 실패를 사용자가 모른다 |
| `translate` | 브라우저 언어(ko/en) | 문구 함수(8장) |
| `partPick` | `false` | 부재를 클릭으로 고를 수 있게 한다 |
| `initialFocusBox` | 모델 전체 | 처음 카메라를 앉힐 상자 `[[minX,minY,minZ],[maxX,maxY,maxZ]]`(원본 좌표) |
| `globalKeys` | `true` | 창 전체의 키(Esc 등)를 받을지. 뷰어가 둘이면 한쪽만 `true` |
| `insets` | `{ left: 0, right: 0 }` | 뷰어 위에 겹쳐 띄운 패널이 가리는 좌·우 폭(px). 맞춤이 그 안쪽을 기준으로 한다 |
| `ao` · `shadow` | `false` | 주변광 차폐 · 그림자 |
| `fitSeq` | `0` | 이 뷰어 하나만 맞추고 싶을 때 올리는 번호(스토어를 여러 뷰어가 나눠 쓸 때) |
| `triangleBudget` | 기기에서 측정 | 한 번에 올릴 삼각형 상한 |
| `children` | — | 확장 컴포넌트(9장) |

---

## 7. 트리·속성 패널

```tsx
<ModelTreePanel store={store} />
<PropertyPane store={store} fetch={source.fetch} />
```

두 패널 모두 **뷰어와 같은 스토어**를 받습니다. 화면 어디에 둘지는 앱이 정하고, 높이는 부모가 줍니다.

### `ModelTreePanel`

- NWD 는 원본 계층을 그대로, DGN 은 레벨 → 종류 → 요소로 보인다.
- 줄을 한 번 누르면 고르고, 두 번 누르면 그리로 맞춘다. 3D 에서 고르면 트리가 그 줄까지 펼쳐 스크롤한다.
- 줄에 마우스를 올리면 눈(숨기기)·격리 버튼이 나온다. 아래 줄에는 고른 것 숨기기·격리·반투명·전체 표시가 있다.
- 검색(이름·종류·레벨·속성), 원본 파일의 뷰포인트 목록.
- 흐린 줄은 지금 화면에 없는 구역이다(멀어서 내렸거나 아직 안 받음). 카메라를 그쪽으로 옮기면 불러온다.

### `PropertyPane`

- 고른 부재의 경로, 요소 필드(DGN), 분류별 속성 탭(NWD), 원본 변환 기록.
- `fetch`: 원본 변환 기록을 받을 함수. 인증 서버면 공급자의 것(`source.fetch`)을 넘긴다.
- `nameWidth` · `onNameWidthChange`: 이름 열 폭(기본 96px, 56~320px). 사용자가 끌어 바꾼 값을 저장해 두려면 받아서 다시 넘긴다.

---

## 8. 문구·모양

### 문구

기본은 브라우저 언어에 따라 한국어/영어입니다. 언어를 앱이 정하거나 일부 문구를 바꾸려면:

```ts
import { createTranslate } from '@humkyung/viewer3d'

const translate = createTranslate('en', { 'viewer3d.tree.search': 'Search the model' })
// <Viewer3D translate={translate} … />  <ModelTreePanel translate={translate} … />  <PropertyPane translate={translate} … />
```

바꿀 수 있는 키는 타입 `ViewerMessageKey` 에서 볼 수 있습니다. 언어를 바꿀 때는 **새 함수**를 넘겨야 다시 그려집니다.

### 모양(CSS 변수)

색은 CSS 변수로 바꿉니다. 뷰어·패널의 조상 어디에서든 정하면 됩니다.

```css
.my-app {
  /* 뷰어 위 안내·도구 */
  --v3d-panel-bg: rgb(0 0 0 / 0.55);
  --v3d-text: #f3f4f6;
  --v3d-accent: #0284c7;
  /* 트리·속성 패널 */
  --v3d-side-bg: #ffffff;
  --v3d-side-text: #111827;
  --v3d-side-dim: #6b7280;
  --v3d-side-border: #e5e7eb;
  --v3d-side-hover: #f3f4f6;
  --v3d-side-on: #fde68a;
}
```

패키지의 클래스는 모두 `v3d-` 로 시작합니다. 앱의 CSS(예: Tailwind)와 부딪히지 않습니다.

---

## 9. 확장(고급)

뷰어에 없는 기능(마크업, 협업 커서 등)은 `Viewer3D` 의 **자식 컴포넌트**로 붙입니다. 자식은 `useViewerRuntime()` 으로 카메라·장면·캔버스에 접근하고, 아래 훅으로 뷰어 이벤트를 받습니다.

| 훅 | 받는 것 |
|---|---|
| `useViewerFrame` | 매 프레임 |
| `useViewerAfterRender` | 그린 직후 |
| `useViewerPointer` · `useViewerClick` | 포인터·클릭(먹으면 뒤 처리 중단) |
| `useViewerOverlay` | 오버레이에 그릴 항목 |
| `useViewerInteract` · `useViewerDrive` | 사용자 조작 알림 · 컨트롤 갱신 앞 |

```tsx
<Viewer3D documentId={id} source={source} store={store}>
  <MyMarkupExtension />
</Viewer3D>
```

확장은 런타임으로 X-ray 를 걸 수도 있습니다. `focusPieces(ids)` 는 `requestHide3d({ kind: 'ghostOthers', ids, xray: true })` 와 같고, `focusPieces(ids, item)` 은 노드 기준(`item` 포함)으로 겁니다. `focusPieces(null)` 은 `requestHide3d('restore')` 와 같습니다.

```tsx
const { focusPieces } = useViewerRuntime()
focusPieces([12, 13])   // 12·13 번 조각만 또렷이, 나머지는 회색
focusPieces([], 42)     // 트리 노드 42 아래 전부를 또렷이(뒤에 받는 타일 포함)
focusPieces(null)       // 걸기 직전으로
```

타입과 주석은 패키지의 `.d.ts` 에 있습니다.

---

## 10. 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 화면이 비어 있다 | 뷰어 부모에 높이가 있는가 · `onLog` 에 적재 실패가 왔는가 · 매니페스트 URL 이 JSON 을 돌려주는가(개발 서버는 없는 파일에 HTML 을 200 으로 주기도 한다) |
| `Invalid hook call` · 장면이 안 그려짐 | `react`·`three` 가 두 벌이다 → 2.2 의 `dedupe` |
| 큰 모델에서 화면이 멈춤 | CSP 가 `worker-src blob:` 을 막아 워커 대신 메인 스레드에서 해석 중 → 2.3 |
| 일부 구역이 비어 있다 | 기기 메모리 예산 밖이다. 카메라를 그쪽으로 옮기면 불러온다(뷰어 아래 안내에 개수가 뜬다) |
| 받는 도중 타일이 실패 | 인증 서버에 전역 fetch 를 넘겼다 → 공급자에 앱의 fetch 를 넘긴다 |
| 다른 출처에서 받을 때 실패 | CORS 허용, `content-length`·`etag` 노출 |
| 트리가 비어 있다 | 모델에 트리 색인(`tree`)이 없거나 아직 받는 중이다 |
