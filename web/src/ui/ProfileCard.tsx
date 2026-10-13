import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { advanceProfileAxis, profileCardAim, profileCardPose, type ProfileAxis } from './profile-card-motion'
import { usePrefersReducedMotion } from './useParallax'
import './profile-card.css'

interface ProfileCardProps {
  children: ReactNode
  className?: string
  enabled?: boolean
  tiltStrength?: number
  parallax?: number
  holo?: number
  glare?: number
}

/** React Bits ProfileCard motion and foil, adapted to the existing project card content. */
export default function ProfileCard({ children, className = '', enabled = true, tiltStrength = 10, parallax = 6, holo = 0.6, glare = 0.28 }: ProfileCardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let x: ProfileAxis = { position: 0, velocity: 0 }
    let y: ProfileAxis = { position: 0, velocity: 0 }
    let targetX = 0
    let targetY = 0
    let light = 0
    let targetLight = 0
    let frameId: number | null = null
    let lastTime = 0
    let touchId: number | null = null
    let scrollingUntil = 0

    const write = (): void => {
      const pose = profileCardPose(x.position, y.position, light, tiltStrength, parallax)
      const style = root.style
      style.setProperty('--pc-pointer-x', `${pose.pointerX.toFixed(2)}%`)
      style.setProperty('--pc-pointer-y', `${pose.pointerY.toFixed(2)}%`)
      style.setProperty('--pc-band-x', `${pose.bandX.toFixed(2)}%`)
      style.setProperty('--pc-band-y', `${pose.bandY.toFixed(2)}%`)
      style.setProperty('--pc-rotate-x', `${pose.rotateX.toFixed(3)}deg`)
      style.setProperty('--pc-rotate-y', `${pose.rotateY.toFixed(3)}deg`)
      style.setProperty('--pc-shift-x', `${pose.shiftX.toFixed(2)}px`)
      style.setProperty('--pc-shift-y', `${pose.shiftY.toFixed(2)}px`)
      style.setProperty('--pc-active', pose.active.toFixed(4))
      style.setProperty('--pc-tilt', pose.tilt.toFixed(4))
    }
    write()
    if (!enabled || reduced) return

    const frame = (now: number): void => {
      frameId = null
      const delta = Math.max(0, Math.min(0.05, (now - lastTime) / 1000))
      lastTime = now
      x = advanceProfileAxis(x, targetX, delta)
      y = advanceProfileAxis(y, targetY, delta)
      const tau = targetLight > light ? 0.18 : 0.45
      light += (targetLight - light) * (1 - Math.exp(-delta / tau))
      const moving = Math.abs(targetX - x.position) > 0.0005 || Math.abs(targetY - y.position) > 0.0005 || Math.abs(x.velocity) > 0.0005 || Math.abs(y.velocity) > 0.0005 || Math.abs(targetLight - light) > 0.002
      if (moving) {
        frameId = requestAnimationFrame(frame)
      } else {
        x = { position: targetX, velocity: 0 }
        y = { position: targetY, velocity: 0 }
        light = targetLight
      }
      write()
    }
    const wake = (): void => {
      if (frameId !== null) return
      lastTime = performance.now()
      frameId = requestAnimationFrame(frame)
    }
    const release = (): void => {
      if (targetX === 0 && targetY === 0 && targetLight === 0) return
      targetX = 0
      targetY = 0
      targetLight = 0
      wake()
    }
    const aimAt = (event: PointerEvent): void => {
      if (performance.now() < scrollingUntil || root.closest('[inert]')) return
      const aim = profileCardAim(event.clientX, event.clientY, root.getBoundingClientRect())
      targetX = aim.x
      targetY = aim.y
      targetLight = 1
      wake()
    }
    const onEnter = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse') aimAt(event)
    }
    const onMove = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse') aimAt(event)
    }
    const onLeave = (): void => { release() }
    const onDown = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return
      touchId = event.pointerId
      aimAt(event)
    }
    const onUp = (event: PointerEvent): void => {
      if (event.pointerId !== touchId) return
      touchId = null
      release()
    }

    const onScroll = (): void => {
      scrollingUntil = performance.now() + 120
      if (frameId === null && x.position === 0 && y.position === 0 && light === 0) return
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = null
      x = { position: 0, velocity: 0 }
      y = { position: 0, velocity: 0 }
      targetX = 0
      targetY = 0
      light = 0
      targetLight = 0
      write()
    }

    root.addEventListener('pointerenter', onEnter, { passive: true })
    root.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', onLeave, { passive: true })
    root.addEventListener('pointerdown', onDown, { passive: true })
    root.addEventListener('pointerup', onUp, { passive: true })
    root.addEventListener('pointercancel', onUp, { passive: true })
    // Reset the inner tilt as native scrolling moves or flips the outer card.
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('blur', release)
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onUp)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('blur', release)
      x = { position: 0, velocity: 0 }
      y = { position: 0, velocity: 0 }
      light = 0
      write()
    }
  }, [enabled, reduced, tiltStrength, parallax])

  const style = {
    '--pc-holo': Number.isFinite(holo) ? Math.max(0, Math.min(1, holo)) : 0.6,
    '--pc-glare': Number.isFinite(glare) ? Math.max(0, Math.min(1, glare)) : 0.28,
  } as CSSProperties
  return <div ref={rootRef} className={`profile-card ${className}`.trim()} style={style}>
    <div className="profile-card__body">
      {children}
      <span className="profile-card__holo" aria-hidden="true" />
      <span className="profile-card__glare" aria-hidden="true" />
      <span className="profile-card__shade" aria-hidden="true" />
      <span className="profile-card__rim" aria-hidden="true" />
    </div>
  </div>
}
