# Spider Overlay

A **cursor following spider** for websites built with React or vanilla JavaScript. The animated spider follows your pointer, pounces on clicks, and blinks when idle. It leaves silk strands that can catch on elements you mark as anchors.

The Canvas 2D overlay leaves links, buttons, and text selection usable. It keeps the native cursor and skips the entrance animation when reduced motion is enabled.

## Install from a URL

Looking for a **Spider URL component**? Install the package directly from the GitHub release URL in a project that supports ESM and CSS imports.

```sh
npm install https://github.com/Vansh2k6/spider-overlay/releases/download/v0.1.0/vansh2k6-spider-overlay-0.1.0.tgz
```

## React 19

Mount `SpiderOverlay` once near the document root, inside a client component. Add `data-web-anchor` to any elements that should catch silk.

```tsx
import { SpiderOverlay } from "@vansh2k6/spider-overlay/react";
import "@vansh2k6/spider-overlay/style.css";

export default function App() {
  return (
    <>
      <h1 data-web-anchor="edge">Spider Overlay</h1>
      <SpiderOverlay />
    </>
  );
}
```

## Vanilla JavaScript

Add a canvas to your page, then mount the overlay from your browser entry point.

```html
<h1 data-web-anchor="edge">Spider Overlay</h1>
<canvas id="spider"></canvas>
```

```js
import { mountSpider } from "@vansh2k6/spider-overlay";
import "@vansh2k6/spider-overlay/style.css";

const canvas = document.querySelector("#spider");
const dispose = mountSpider(canvas);
// Call dispose() before removing the canvas or remounting the overlay.
```

## Controls and web anchors

| Control | Behavior |
| --- | --- |
| Move the pointer | The spider follows and trails silk. |
| Click | The spider pounces toward the pointer. |
| Delete or Backspace | Clears webs. Editable fields keep normal keyboard behavior. |
| `data-web-anchor="edge"` | Catches strands that cross the element boundary. |
| `data-web-anchor="center"` | Catches strands close to the center of the element. |
| `data-spider-root` | Limits the anchor search to the overlay’s nearest marked ancestor. |

Import `requestWebClear()` and `setEffectsHidden(boolean)` from the package root to wire up your own controls. Set `--fx-z-index` to adjust the overlay’s stacking order. React hosts can pass `active={false}` to pause the component, and either API accepts a `navHeight` in pixels for the entrance offset. Keep the canvas outside transformed containers so it stays fixed to the viewport.

## Build from source

```sh
git clone https://github.com/Vansh2k6/spider-overlay.git
cd spider-overlay
npm ci
npm pack
```

Install the generated `vansh2k6-spider-overlay-0.1.0.tgz` in another project with `npm install /path/to/vansh2k6-spider-overlay-0.1.0.tgz`. Builds are checked on Node.js 24. The component runs in modern browsers with Canvas 2D and `createImageBitmap` support.

## License

The component source and original spider artwork are available under the [MIT License](LICENSE). The SVGs are the editable originals for the PNG sprites bundled with the package. Runtime dependencies have their own licenses.
