export interface ProfileAxis {
  position: number
  velocity: number
}

interface CardBounds {
  left: number
  top: number
  width: number
  height: number
}

const finite = (value: number): number => Number.isFinite(value) ? value : 0
const unit = (value: number): number => Math.max(-1, Math.min(1, finite(value)))

/** Normalize the pointer against the visible face, independently of its scroll transform. */
export function profileCardAim(clientX: number, clientY: number, bounds: CardBounds): { x: number; y: number } {
  if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
    return { x: 0, y: 0 }
  }
  return {
    x: unit(((clientX - bounds.left) / bounds.width) * 2 - 1),
    y: unit(((clientY - bounds.top) / bounds.height) * 2 - 1),
  }
}

/** Integrate the React Bits spring in small steps for stable motion across refresh rates. */
export function advanceProfileAxis(axis: ProfileAxis, target: number, deltaSeconds: number): ProfileAxis {
  let position = finite(axis.position)
  let velocity = finite(axis.velocity)
  const destination = unit(target)
  const delta = Math.max(0, Math.min(0.05, finite(deltaSeconds)))
  const steps = Math.max(1, Math.ceil(delta * 120))
  const step = delta / steps
  for (let index = 0; index < steps; index++) {
    velocity += (120 * (destination - position) - 20 * velocity) * step
    position += velocity * step
  }
  return { position, velocity }
}

/** Keep tilt, foil position and image parallax bounded while a spring settles. */
export function profileCardPose(x: number, y: number, active: number, strength = 10, parallax = 6) {
  const horizontal = unit(x)
  const vertical = unit(y)
  const light = Math.max(0, Math.min(1, finite(active)))
  const angle = Math.max(0, Math.min(18, finite(strength)))
  const depth = Math.max(0, Math.min(12, finite(parallax)))
  return {
    pointerX: (horizontal + 1) * 50,
    pointerY: (vertical + 1) * 50,
    bandX: 50 + horizontal * 15,
    bandY: 50 + vertical * 15,
    rotateX: vertical * angle,
    rotateY: -horizontal * angle,
    shiftX: horizontal * depth,
    shiftY: vertical * depth,
    active: light,
    tilt: Math.min(1, Math.hypot(horizontal, vertical)) * light,
  }
}
