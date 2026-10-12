// The three story chapters use the first three existing GLB focus anchors.
// Scene.tsx derives node count and camera segments from this single source of truth.
// The remaining animation frames form the journey into the works section.
export const FOCUS_POINTS = ['focus-1', 'focus-2', 'focus-3'] as const

// Node k corresponds to frame k * FRAMES_PER_NODE in CameraAction.
export const FRAMES_PER_NODE = 50
