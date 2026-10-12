import * as THREE from 'three'

const ease = (from: number, to: number, value: number): number => THREE.MathUtils.smoothstep(value, from, to)

/** Filter small shading bumps on skin; preserve the mesh, UVs and facial features. */
export function smoothPortraitNormals(source: THREE.BufferGeometry, eyes: readonly THREE.Vector3[]): THREE.BufferGeometry {
  const geometry = source.clone()
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const index = geometry.getIndex()
  if (!positions || !normals || !index || positions.count !== normals.count) return geometry

  const neighbours: Set<number>[] = Array.from({ length: positions.count }, () => new Set<number>())
  for (let face = 0; face + 2 < index.count; face += 3) {
    const triangle = [index.getX(face), index.getX(face + 1), index.getX(face + 2)]
    if (triangle.some(vertex => vertex < 0 || vertex >= positions.count || !Number.isInteger(vertex))) continue
    for (const a of triangle) for (const b of triangle) if (a !== b) neighbours[a].add(b)
  }

  const mask = new Float32Array(positions.count)
  let current = new Float32Array(positions.count * 3)
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const x = positions.getX(vertex), y = positions.getY(vertex), z = positions.getZ(vertex)
    const skin = ease(0.25, 0.38, z) * ease(-0.36, -0.27, y) * (1 - ease(0.28, 0.36, y))
    const lips = 1 - ease(0.8, 1.3, Math.hypot(x / 0.17, (y + 0.24) / 0.07))
    const nose = 1 - ease(0.8, 1.3, Math.hypot(x / 0.105, (y + 0.065) / 0.17))
    const sockets = eyes.reduce((protection, eye) => Math.max(protection,
      1 - ease(0.9, 1.5, Math.hypot((x - eye.x) / 0.16, (y - eye.y) / 0.10))), 0)
    mask[vertex] = Number.isFinite(skin) ? skin * (1 - Math.max(lips, nose, sockets)) * 0.7 : 0
    current.set([normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex)], vertex * 3)
  }

  // Run once at load, never per frame. Angle weights keep sharp feature boundaries intact.
  for (let pass = 0; pass < 3; pass++) {
    const next = current.slice()
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const blend = mask[vertex]
      if (blend <= 0) continue
      const offset = vertex * 3
      const nx = current[offset], ny = current[offset + 1], nz = current[offset + 2]
      let x = nx, y = ny, z = nz
      for (const neighbour of neighbours[vertex]) {
        const other = neighbour * 3
        const dot = nx * current[other] + ny * current[other + 1] + nz * current[other + 2]
        const weight = ease(0.7, 1, dot)
        x += current[other] * weight
        y += current[other + 1] * weight
        z += current[other + 2] * weight
      }
      const length = Math.hypot(x, y, z)
      if (!Number.isFinite(length) || length < 1e-8) continue
      x = nx * (1 - blend) + x / length * blend
      y = ny * (1 - blend) + y / length * blend
      z = nz * (1 - blend) + z / length * blend
      const mixedLength = Math.hypot(x, y, z)
      if (mixedLength < 1e-8) continue
      next.set([x / mixedLength, y / mixedLength, z / mixedLength], offset)
    }
    current = next
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(current, 3))
  return geometry
}
