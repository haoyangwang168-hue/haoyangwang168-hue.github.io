import { useEffect, useRef, type RefObject } from 'react'
import { cancelFrame, frame, type MotionValue } from 'framer-motion'
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderer } from 'three'
import { worksPaperBand } from './works-transition'

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// The supplied tutorial uses layered value noise to dissolve upward with scroll.
// Reference: https://v.douyin.com/B_Wg0QnHRds/
// Works reference: https://v.douyin.com/f-zcfyNUZY0/ (FBM alpha threshold driven by scroll).
const FRAGMENT = `
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec2 uSize;
  uniform vec2 uBounds;
  uniform float uViewport;
  uniform float uWide;
  uniform float uPaper;
  uniform float uProgress;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    return noise(p) * 0.5714 + noise(p * 2.0) * 0.2857 + noise(p * 4.0) * 0.1429;
  }
  void main() {
    vec2 uv = floor(vUv * uResolution / 2.0) * 2.0 / uResolution;
    if (uPaper > 0.5) {
      vec2 centered = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
      float screenY = (1.0 - uv.y) * uViewport;
      // Expand the noise contrast for deeper tears and scroll-driven, reversible fragments.
      float breakup = smoothstep(0.24, 0.76, fbm(centered * 18.0 + vec2(0.0, uProgress * 0.65)));
      float field = (screenY - uBounds.x) / uBounds.y + (breakup - 0.5) * 0.96;
      // Noise stays inside the measured empty band, preserving both pages' contrast.
      float alpha = smoothstep(0.49, 0.51, field);
      gl_FragColor = vec4(vec3(246.0, 243.0, 235.0) / 255.0, alpha);
      return;
    }
    vec2 centered = (uv - 0.5) * uSize / uViewport;
    float grain = fbm(centered * 15.0) - 0.5;
    float y = (1.0 - uv.y) * uSize.y;
    float shift = uProgress * min(uViewport * 0.1, 80.0);
    float feather = uViewport * 0.006;
    // Same FBM threshold as the reference, now at both edges of the intro ink.
    float topField = y + grain * uViewport * 0.42;
    float topAlpha = smoothstep(uBounds.x - shift - feather, uBounds.x - shift + feather, topField);
    float bottomField = y + grain * min(uViewport * 0.16, 96.0);
    float bottomAlpha = 1.0 - smoothstep(uBounds.y - feather, uBounds.y + feather, bottomField);
    float sides = max(1.0 - smoothstep(0.08, 0.42, uv.x), smoothstep(0.60, 0.94, uv.x));
    float alpha = topAlpha * bottomAlpha * mix(1.0, sides * 0.86, uWide);
    gl_FragColor = vec4(vec3(10.0, 10.0, 13.0) / 255.0, alpha);
  }
`

type DissolveProps = {
  progress: MotionValue<number>
  enabled: boolean
  onUnavailable: () => void
} & (
  | { mode?: 'intro'; containerRef: RefObject<HTMLElement> }
  | { mode: 'paper'; containerRef: RefObject<HTMLElement> }
)

/** Dissolve the intro ink or reveal the works paper without moving section anchors. */
export default function DissolveTransition({ mode = 'intro', containerRef, progress, enabled, onUnavailable }: DissolveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef?.current
    if (!canvas || !enabled || !container) return
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
    } catch {
      onUnavailable()
      return
    }
    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new PlaneGeometry(2, 2)
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uProgress: { value: 0 }, uResolution: { value: new Vector2(1, 1) },
        uSize: { value: new Vector2(1, 1) }, uBounds: { value: new Vector2(0, 1) },
        uViewport: { value: window.innerHeight }, uWide: { value: 0 },
        uPaper: { value: mode === 'paper' ? 1 : 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    scene.add(new Mesh(geometry, material))
    const outgoing = mode === 'paper' ? document.querySelector<HTMLElement>('[data-works-outgoing]') : null
    const incoming = mode === 'paper' ? container.querySelector<HTMLElement>('[data-works-incoming]') : null
    const heading = mode === 'paper' ? container.querySelector<HTMLElement>('.scroll-work-title') : null
    const paperSurface = mode === 'paper' ? container.querySelector<HTMLElement>('.wk-paper-surface') : null
    // Scroll changes schedule at most one frame; nothing animates while off screen.
    let scheduled = false
    const paint = () => {
      scheduled = false
      const value = progress.get()
      if (mode === 'intro') {
        const box = container.getBoundingClientRect()
        canvas.hidden = box.bottom <= 0 || box.top >= window.innerHeight
      } else {
        const viewport = window.innerHeight
        const box = container.getBoundingClientRect()
        const band = worksPaperBand(value, viewport,
          outgoing?.getBoundingClientRect().bottom ?? box.top - viewport * 0.22,
          Math.min(incoming?.getBoundingClientRect().top ?? Infinity,
            heading?.getBoundingClientRect().top ?? box.top + 80))
        material.uniforms.uBounds.value.set(band.top, band.height)
        // Retire only an empty canvas or a fully opaque frame backed by the works surface.
        // On reversal the canvas bridges any gap before the damped progress leaves 1.
        canvas.hidden = box.bottom <= 0 || (band.top >= viewport && box.top >= viewport)
          || (band.top + band.height <= 0 && paperSurface?.style.opacity === '1' && box.top <= 0 && box.bottom >= viewport)
      }
      if (canvas.hidden) return
      material.uniforms.uProgress.value = value
      renderer.render(scene, camera)
    }
    // Measure after Framer Motion commits both pages' transforms in the same frame.
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      frame.postRender(paint)
    }
    const resize = () => {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
      const width = mode === 'paper' ? window.innerWidth : container!.clientWidth
      const height = mode === 'paper' ? window.innerHeight : container!.clientHeight
      renderer.setSize(width, height, false)
      material.uniforms.uResolution.value.set(canvas.width, canvas.height)
      material.uniforms.uSize.value.set(width, height)
      if (mode === 'intro' && container) {
        const copy = container.querySelector<HTMLElement>('.about')
        const copyTop = copy ? copy.getBoundingClientRect().top - container.getBoundingClientRect().top : height * 0.7
        material.uniforms.uBounds.value.set(copyTop - window.innerHeight * 0.24, height - 64)
      }
      material.uniforms.uViewport.value = window.innerHeight
      material.uniforms.uWide.value = window.innerWidth >= 1100 ? 1 : 0
      schedule()
    }
    const unavailable = (event: Event) => { event.preventDefault(); onUnavailable() }
    const unsubscribe = progress.on('change', schedule)
    canvas.addEventListener('webglcontextlost', unavailable)
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    if (outgoing) observer.observe(outgoing)
    resize()
    return () => {
      unsubscribe()
      cancelFrame(paint)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', schedule)
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', unavailable)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [containerRef, enabled, mode, onUnavailable, progress])

  return enabled ? <canvas ref={canvasRef} className={mode === 'paper' ? 'paper-dissolve' : 'hero-dissolve'} aria-hidden="true" hidden /> : null
}
