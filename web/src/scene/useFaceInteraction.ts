import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { facePull, faceRegion, recoverFace } from './face-motion'
import { clonePortraitMaterial } from './portrait-style'
import { smoothPortraitNormals } from './portrait-normals'

/** Deform facial surfaces on the GPU; never mutate the shared GLB geometry. */
export function useFaceInteraction(model: THREE.Object3D) {
  const get = useThree(state => state.get)
  const input = useRef({ id: -1, x: 0, y: 0, dx: 0, dy: 0, hold: false })
  const sockets = useMemo(() => ['left-eye', 'right-eye'].map(name => {
    const object = model.getObjectByName(name)
    return { base: object?.position.clone() ?? new THREE.Vector3() }
  }), [model])
  const uniforms = useMemo(() => ({
    faceAnchor: { value: new THREE.Vector3(0.18, -0.14, 0.48) },
    facePull: { value: new THREE.Vector3() },
    faceEyeLeft: { value: sockets[0].base },
    faceEyeRight: { value: sockets[1].base },
  }), [sockets])

  useEffect(() => {
    const surfaces: THREE.Mesh[] = []
    const originals: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]; copies: THREE.Material[] }[] = []
    const geometries: { mesh: THREE.Mesh; source: THREE.BufferGeometry; copy: THREE.BufferGeometry }[] = []
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const interactive = /Haoyang_Full3D|sticker/i.test(object.name)
      if (!interactive && !/^(iris-[LR]|left-eye|right-eye)$/.test(object.name)) return
      if (interactive) surfaces.push(object)
      const material = object.material
      if ((Array.isArray(material) ? material : [material]).some(value => /Haoyang-(Complete-Mesh|Nose-Continuous)-Portrait/.test(value.name))) {
        const source = object.geometry
        const copy = smoothPortraitNormals(source, sockets.map(socket => socket.base))
        object.geometry = copy
        geometries.push({ mesh: object, source, copy })
      }
      const copies = (Array.isArray(material) ? material : [material]).map(source => {
        const copy = clonePortraitMaterial(source)
        copy.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
          if (!interactive) return
          Object.assign(shader.uniforms, uniforms)
          shader.vertexShader = 'uniform vec3 faceAnchor; uniform vec3 facePull; uniform vec3 faceEyeLeft; uniform vec3 faceEyeRight;\n' + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            float frontMask = smoothstep(0.25, 0.38, position.z);
            float faceMask = frontMask * (1.0 - smoothstep(0.035, 0.08, position.y)) * smoothstep(-0.26, -0.20, position.y);
            vec3 offset = (position - faceAnchor) / vec3(0.24, 0.22, 0.3);
            float cheekMask = smoothstep(0.15, 0.22, abs(position.x));
            float pinch = exp(-dot(offset, offset) * 1.2) * faceMask * cheekMask;
            transformed += facePull * pinch;
            // Keep the complete eye opening fixed; scanned eyelids cannot safely stretch.
            vec3 socket = position.x < (faceEyeLeft.x + faceEyeRight.x) * 0.5 ? faceEyeLeft : faceEyeRight;
            float socketRadius = length((position.xy - socket.xy) / vec2(0.15, 0.10));
            float protection = (1.0 - smoothstep(1.25, 2.0, socketRadius)) * smoothstep(0.20, 0.25, position.z);
            transformed = mix(transformed, position, protection);
          `)
        }
        copy.customProgramCacheKey = () => `haoyang-cheek-pinch-detail-v2-${interactive}-${copy.name}`
        return copy
      })
      object.material = Array.isArray(material) ? copies : copies[0]
      originals.push({ mesh: object, material, copies })
    })
    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const active = (): boolean => {
      const element = document.querySelector('#about')
      const hero = element?.getBoundingClientRect()
      return !!hero && !element?.closest('[inert]') && hero.top > -window.innerHeight * 0.15 && !document.querySelector('.wk-detail')
    }
    const pick = (x: number, y: number): THREE.Vector3 | null => {
      if (!active()) return null
      pointer.set(x / window.innerWidth * 2 - 1, 1 - y / window.innerHeight * 2)
      model.updateWorldMatrix(true, true)
      ray.setFromCamera(pointer, get().camera)
      for (const hit of ray.intersectObjects(surfaces, false)) {
        const local = hit.object.worldToLocal(hit.point.clone())
        if (faceRegion(local.x, local.y, local.z)) return local
      }
      return null
    }
    const blocked = (target: EventTarget | null): boolean => target instanceof Element && !!target.closest('button,a,input,dialog')
    const down = (event: PointerEvent): void => {
      if (event.button !== 0 || input.current.hold || blocked(event.target)) return
      const point = pick(event.clientX, event.clientY)
      if (!point) return
      uniforms.faceAnchor.value.copy(point)
      Object.assign(input.current, { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, hold: true })
      event.preventDefault()
    }
    const move = (event: PointerEvent): void => {
      const state = input.current
      if (!state.hold || state.id !== event.pointerId) return
      state.dx = facePull(event.clientX - state.x, window.innerWidth)
      state.dy = facePull(state.y - event.clientY, window.innerHeight)
      event.preventDefault()
    }
    const release = (): void => { input.current.hold = false; input.current.id = -1; input.current.dx = 0; input.current.dy = 0 }
    const up = (event: PointerEvent): void => { if (event.pointerId === input.current.id) release() }
    const cancel = (event: KeyboardEvent): void => { if (event.key === 'Escape') release() }
    // Idle cheeks need no hero layout measurement while cards and the footer scroll.
    const scroll = (): void => { if (input.current.hold && !active()) release() }
    window.addEventListener('pointerdown', down, { passive: false })
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', release)
    window.addEventListener('keydown', cancel)
    window.addEventListener('scroll', scroll, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', release)
      window.removeEventListener('keydown', cancel)
      window.removeEventListener('scroll', scroll)
      originals.forEach(({ mesh, material, copies }) => { mesh.material = material; copies.forEach(copy => copy.dispose()) })
      geometries.forEach(({ mesh, source, copy }) => { mesh.geometry = source; copy.dispose() })
    }
  }, [model, get, uniforms, sockets])

  useFrame((_, seconds) => {
    seconds = Math.min(seconds, 0.05)
    const state = input.current
    const pull = uniforms.facePull.value
    pull.x = recoverFace(pull.x, state.hold ? state.dx : 0, seconds, state.hold)
    pull.y = recoverFace(pull.y, state.hold ? state.dy : 0, seconds, state.hold)
  })
}
