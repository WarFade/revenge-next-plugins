# VFX support for Android 12 and earlier

Date: 2026-10-05  
Status: Phases 1 and 2 implemented in VFX 0.20.0, with Quick Toggles 0.4.6 integration. User reports the current effects work on the Android 16 test device (2026-10-05). VFX 0.21.0 adds legacy vaporwave, dreamy and VHS; those additions await device testing. Actual older-OS compatibility and performance validation remain pending.

## Added in 0.22.0: experimental capture and pixel rainbows

### 0.22.1 follow-up

- User tested 0.22.0 ripple on Android 16: Completed, 35 frames, 325×721 capture, last capture 11.1 ms, upload/draw 1.0 ms, pipeline 23.1 ms. This confirms the prototype completed on that device, not full lifecycle/performance validation.
- Capture now targets at most 20 fps (50 ms), backing off to as low as 10 fps based on average capture cost. Bitmap longest side is reduced from roughly 720 to 600 pixels (~31% fewer pixels). View traversal costs may not scale with bitmap size.
- OpenGL wave drawing targets 30 fps independently, reusing the latest texture between captures. One upload at a time, no queued capture backlog. This trades sharpness and content freshness while scrolling for less UI-thread capture work.
- Diagnostics separate capture/draw counts, average/peak capture cost, draw time, capture-to-upload-completion pipeline time, and capture interval. Device comparison remains pending.
- The rainbow border was a misunderstanding: replaced with **Rainbow puffs**, filled striped 8-bit clouds blown from each tap. Saved ID `rainbowedges` is retained so previous selections migrate automatically. Rainbow bubbles remains separate. Quick Toggles 0.4.8 updates the label.

### Original 0.22.0 implementation

- **Rainbow edges:** tap-triggered animated pixel border under Screen effect, using Canvas in both tiers. **Rainbow bubbles:** a separate hollow pixel bubble particle style alongside Confetti, rising with gentle sway. Quick Toggles 0.4.7 adds both choices.
- **Experimental legacy ripple:** opt-in `legacyRipple` setting under Compatibility. With legacy mode active, Ripple captures the selected root through software `View.draw(Canvas)` into a reusable bitmap, at most 720 pixels on the longest side, and uploads it to OpenGL ES 2 on a dedicated EGL worker.
- The TextureView sits inside an overlay container whose drawing is excluded during capture to avoid feedback. Only the moving wave band is displayed, leaving live content visible elsewhere. This is an original ripple approximation rather than the modern shader's exact response.
- One window/session and one in-flight bitmap at a time; no capture backlog. A session lasts roughly 0.7–1.8 seconds. New taps during it are ignored. Capture runs on the UI thread, with a target pipeline interval of 33 ms. Repeated capture times above 40 ms or any above 120 ms stop the session.
- Visible SurfaceViews/TextureViews cause the prototype to decline capture. Hardware-only bitmap rendering may fail on software Canvas; such failures are reported and disable the prototype for the session. This capture approach does not establish full fidelity for video, hardware-only rendering, other plugin effects, or dialogs.
- Switching renderer/prototype settings, hiding/detaching/resizing the window, timeout or completion removes the overlay and releases EGL/bitmap resources. Capture, upload/draw, total pipeline time, frame count and bitmap dimensions appear in Compatibility. These are last-frame CPU/pipeline timings, not measured display latency or GPU frame time.
- **Android 16 test:** enable Force legacy rendering and Experimental legacy ripple, select Ripple, then tap on text and scroll. Verify orientation, touch alignment, visible distortion, no feedback, no frozen overlay, and report Compatibility's status/timings. Repeat after opening a dialog and with images. Turn the prototype off to restore the regular legacy choices.
- Native compilation has passed; OpenGL compilation, capture fidelity, performance and actual older-OS support require device validation. Other advanced effects remain deferred until this prototype is proven.

## Added in 0.21.0

- **CRT tuning:** slightly stronger legacy scanlines (alpha 46 → 58) and deeper edge vignette (maximum alpha 184 → 204), with the transparent centre preserved. Other filters retain their existing vignette.
- **Vaporwave:** static pink/violet/cyan gradient washes and scanlines. Does not recolour content based on luminance.
- **Dreamy:** six drifting pastel cloud gradients and 28 seeded rising/twinkling motes. Filter-only animation is capped at 20 fps; no content distortion or true bloom.
- **VHS:** animated tiled grain, rolling tracking glow, textured tracking lines, gentle flicker and bottom-edge tape noise. Filter-only animation is capped near 24 fps; no per-line displacement or RGB separation.
- All use the existing Canvas composition/cleanup path and per-effect capabilities, so Quick Toggles 0.4.6 picks them up without another update. Gradients and the small noise tile are reused across frames and scaled for each window.
- Device follow-up: test the three filters individually, combine with ink/shockwave, change windows/orientation, switch to None/static filters, and toggle legacy off/on. Check animation resumes after backgrounding and no overlay remains after disabling.

## Implemented in 0.20.0

- `Rendering.kt` provides an API-24-safe renderer interface, stable effect IDs, per-effect availability, renderer/quality descriptions, and failure reporting. The minimum SDK remains 24.
- `ModernRenderer.kt` owns modern shader objects, compilation, filters, frost interaction and arcade CRT shading. Common touch/message/arcade code no longer has RuntimeShader or RenderEffect fields or signatures. `Compositor` and `SharedLayers` are reached through modern rendering only.
- `LegacyRenderer.kt` provides one Canvas drawable per window, composing a persistent filter beneath touch bursts. It uses weak view references, removes idle overlays, reuses paths/gradients and a small noise tile, caps simultaneous bursts at seven, and scans for new/changed windows every 500 ms while a filter is selected.
- Available legacy touch effects: **shockwave** (bright expanding ring/glow) and **ink** (colourful organic bloom). Ink reuses the modern 1.8-second envelope and angular wobble; shockwave reuses the 1100 dp/s expansion speed.
- Available legacy filters: **CRT** (scanlines, vignette, corner mask), **old film** (warm tint, grain, scratches, dust and flicker, capped near 24 fps), and **night vision** (green tint, fixed grain, eyepiece vignette). CRT/night vision have no continuous animation loop.
- Settings, test chips and Quick Toggles use native per-effect capability maps. Unsupported saved preferences remain intact. Preview lists and /fx choices omit unavailable message effects; native also enforces eligibility. Slam uses the legacy shockwave, Glitch retains shake, and Swirl is unavailable in legacy mode.
- Rendering requires hardware acceleration on each target window. Initialization/draw failures disable the affected effect for that renderer/session and are logged; open settings periodically refresh capability diagnostics.

### Remaining work

1. Device-test both rendering tiers, switching mid-animation, saved settings after restart, previews/restoration, quick toggles, messages, dialogs, keyboard/rotation, hidden windows and plugin cleanup.
2. Validate actual Android 11, Android 12 and earlier supported versions. The Android 16 override does not prove old-OS class loading or API availability.
3. Profile frame time, allocation and battery use on lower-end hardware; tune overlay appearance using device feedback.
4. Device-test the new 0.21.0 vaporwave, dreamy and VHS variants. Ripple, lens, pixelation, jelly, black hole, monochrome ink that samples background brightness, and precise frost clearing still require a suitable content renderer.
5. Validate the opt-in 0.22.0 OpenGL ripple capture prototype before extending it to other advanced effects.

## Testing legacy rendering on a newer phone

In **VFX → Compatibility**, enable **Force legacy rendering**. This saved native setting (`forceLegacy`, default `false`) selects the same non-shader path used on Android 12 and earlier, including on the Android 16 test device. Turning it off restores automatic selection; it never enables modern rendering below API 33.

- The change applies live and persists across restarts.
- Settings report the real `apiLevel`, effective `rendererTier` (`modern` or `legacy`), and effective shader `supported` flag.
- Switching cancels active effects, clears VFX's compositor layers and frost state, and invalidates temporary filter restoration. Saved styles, filters, and master switches are retained.
- Native checks cover taps, finger effects, delayed distortions, send/receive triggers, message effects, surprise effects, filters, and the arcade celebration's CRT shader. Previews and quick toggles cannot enable shaders in legacy mode.
- Starting in forced legacy mode skips shader validation; switching back validates shaders before restoring the selected filter.

**Current legacy coverage:** shockwave and ink, six filters (CRT, old film, night vision, vaporwave, dreamy and VHS), plus particles, charge rings, shake, and non-shader power/message effects. Overlay approximations do not bend or sample Discord's pixels; night vision does not convert content to monochrome.

### Android 16 manual verification (current effects reported working; detailed lifecycle checks remain pending)

1. Choose CRT and shockwave, then enable the override. Modern rendering should clear and the legacy versions should take over; status should show the real API level and **Legacy renderer**. Repeat with an unsupported saved filter/effect and verify it stays saved but does not render.
2. Try particles, charge-on-hold, typing effects, send/receive previews, message effects, and an arcade high-score preview. Non-shader visuals should play without screen distortion or CRT shading.
3. Try selecting a filter/distortion and enabling its quick toggle while legacy is active. It must not render a shader.
4. Restart with the override on. Confirm it remains enabled and a supported saved filter appears using Canvas, while unsupported filters stay inactive.
5. Turn the override off. Confirm **Modern renderer**, the saved filter returns if enabled, and the selected touch effect plays again. Also test this after a cold start in legacy mode.
6. Toggle during a temporary surprise filter, finger effect, or delayed message effect; check for stale filters, leftover overlays, and lost touch input.

This override exercises rendering selection on the newer OS. Actual older-Android class loading, missing APIs, and GPU behavior still need validation during the compatibility phases below.

## Goal

Provide useful versions of VFX effects on Android 12 and earlier, reusing existing shader math and effect parameters where practical. Automatically show effects supported by the device and choose the best available renderer.

Use two compatibility tiers: Android 13+ and Android 12 and below. Build the fallback against Android 11 (API 30) capabilities and validate earlier supported versions against the plugin's minimum SDK. Android 11 is the fallback development baseline, not a new minimum installation requirement.

Full visual parity is not required for the initial implementation. Distinguish effects drawn over Discord from effects that sample and distort Discord's pixels.

## Current implementation

The `plugins/screen-effects` implementation retains `supported` as the effective shader-support flag for compatibility, and now reports `effects`, `filters`, `messageCapabilities`, `hardwareAccelerated`, and `rendererTier`. `Filters.kt`, `Ripple.kt`, `Lens.kt`, and `Finger.kt` depend on `RuntimeShader` behind the modern renderer boundary.

Relevant integration points:

- Native capability reporting: `src/main/kotlin/com/bleelblep/screeneffects/ScreenEffects.kt`
- Effect composition: `Compositor.kt` and `SharedLayers.kt`
- Filter implementations: `Filters.kt`
- JS native state: `js/native.ts`
- Picker definitions: `js/ui/options.ts`
- Settings: `js/ui/pages/Effect.tsx`, `Filter.tsx`, `Settings.tsx`, and `Test.tsx`

Paths above are relative to `plugins/screen-effects` unless otherwise noted.

## Rendering tiers

| Android | Proposed renderer | Coverage |
| --- | --- | --- |
| Android 13+, API 33+ | Existing AGSL RuntimeShader pipeline | Full filters and distortions |
| Android 12 and below, API 32 and below within the supported minimum SDK | Shared fallback built for Android 11/API 30: hardware-accelerated Canvas overlays and view transforms | Scanlines, grain, vignettes, rings, particles, shake, and simpler effects |

Android 12 uses the same fallback as Android 11 and earlier. The fallback must not depend on RenderEffect (API 31) or RuntimeShader (API 33); there is no separate Android 12 enhancement tier.

OpenGL ES is a possible later renderer for older devices, contingent on a viable content-capture pipeline.

## Effect feasibility

| Effect | Initial older-Android version | Limitations |
| --- | --- | --- |
| CRT | Scanlines, vignette, rounded-screen mask | Actual curvature requires content sampling |
| Old film | Animated scratches, dust, grain, flicker; faded colors where supported | Exact color response may differ |
| Night vision | Green tint, grain, eyepiece overlay; monochrome treatment only if a compatible content-coloring path is verified | An overlay alone cannot convert the underlying UI to monochrome; nonlinear brightness response is approximate |
| Vaporwave | Color washes and scanlines | Actual luminance-based recoloring requires access to content; exact three-tone mapping needs custom GPU processing |
| Shockwave | Animated bright ring, glow, optional shake | No local screen bending in the overlay version |
| Ink | Expanding shapes and gradients | Refraction and sampling the underlying color require more work |
| Dreamy | Drifting clouds, pastel washes, sparkles | Whirlpools and true bloom require access to content pixels |
| VHS | Noise, tracking bands, flicker | Per-line displacement and RGB separation require custom GPU processing |

Reuse timing, easing, noise functions, colors, touch coordinates, and effect parameters. Implement alternate renderers rather than attempting to execute AGSL on unsupported Android versions.

### Difficult effects

These require sampling and redrawing the underlying UI:

- Ripple that bends chat content.
- Magnifying lens.
- Pixelation.
- Jelly dragging.
- Black-hole distortion.
- Frost that clears precisely under the finger.

An overlay alone cannot reproduce those transformations.

## OpenGL ES feasibility

Port the shader calculations from AGSL to GLSL, replacing pixel-coordinate child-shader sampling with normalized texture sampling:

```text
AGSL: img.eval(pixelPosition)
GLSL: texture(inputTexture, normalizedCoordinates)
```

Adapt shader types, uniforms, coordinate orientation, alpha handling, and color behavior for the selected GLSL version.

The main challenge is obtaining `inputTexture`. RuntimeShader receives rendered View content from Android; an OpenGL overlay does not. A TextureView provides a rendering surface, not automatic access to content behind it.

The capture-and-display pipeline must:

- Capture the correct Discord window.
- Exclude the effect overlay to prevent visual feedback.
- Handle scrolling, keyboard changes, and separate dialog windows.
- Account for video and other separately rendered surfaces.
- Avoid excessive bitmap allocation, CPU readback, and GPU uploads.
- Preserve touch routing and acceptable latency.

Prototype this separately before committing to full visual parity on older devices.

## Capability reporting and dynamic UI

Replace the all-or-nothing flag with native per-effect capabilities. Example schema:

```ts
{
  apiLevel: 30,
  tier: "fallback",
  hardwareAccelerated: true,
  effects: {
    shockwave: { available: true, renderer: "canvas", quality: "approximate" },
    crt: { available: true, renderer: "canvas", quality: "approximate" },
    lens: { available: false, reason: "No supported content renderer" }
  }
}
```

Determine availability using:

1. Android API level.
2. Hardware acceleration on the target window.
3. Successful renderer initialization.
4. Shader compilation where applicable.
5. Effect-specific requirements.

Use the existing `brokenStyles` mechanism as a starting point for reporting renderer failures.

### UI behavior

- Show available effects automatically.
- Select the best supported renderer under the same effect ID.
- Describe fallback differences accurately: for example, “Scanlines and vignette” rather than promising curvature.
- Hide unavailable choices from the main picker.
- Optionally offer an Unavailable effects section with explanations.
- Preserve saved preferences when a renderer is unavailable.
- Apply capability checks to quick toggles, message triggers, and test buttons as well as settings.
- Enforce availability natively so saved settings or triggers cannot bypass the picker checks.

## Implementation phases

### Phase 1: Capability system

Implemented in 0.20.0; runtime validation remains part of Phase 3.

- Introduce a renderer interface and per-effect availability.
- Separate API 33 shader classes from older-compatible code.
- Audit Compositor and SharedLayers: RenderEffect itself requires API 31.
- Keep RenderEffect-typed fields, method signatures, and initialization inside the modern implementation. The fallback needs its own overlay/transform composition path that loads on API 30 and earlier.
- Filter settings and trigger options using native capabilities.
- Keep cleanup and effect ownership consistent across renderers.

### Phase 2: Lightweight fallback pack

Implemented in 0.20.0; visual tuning awaits device testing.

Start with CRT overlay, old film, night vision approximation, shockwave, and ink overlay. These offer strong visible improvements at moderate complexity.

### Phase 3: Fallback compatibility and performance

Validate the shared fallback on Android 11 first, then Android 12 and earlier supported API levels. Check window changes, keyboard visibility, touch routing, cleanup, and composition with other plugins. Measure frame time, allocations, and battery impact on lower-end hardware. Hide individual effects whose required capabilities fail; do not assume every pre-13 device has identical GPU support.

### Phase 4: Optional OpenGL prototype

Prototype one short-lived ripple using captured content. Measure capture latency, frame rate, memory use, and scrolling behavior before extending it to persistent filters or interactive lenses.

## Difficulty and recommendation

| Work | Estimated complexity |
| --- | --- |
| Capability detection and dynamic UI | Low to medium |
| Useful Canvas fallback collection | Medium |
| Shared fallback compatibility and performance validation | Medium |
| Full screen-distorting parity through OpenGL | High; a new rendering subsystem |

Recommended approach: deliver convincing lightweight versions first, make availability automatic, and reserve pixel-distortion support for devices where a tested capture/rendering pipeline performs well.
