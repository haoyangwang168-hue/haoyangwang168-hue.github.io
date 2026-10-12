import * as THREE from 'three'

/** Style private material copies while retaining the portrait's original color maps. */
export function stylePortraitMaterial(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return
  if (/Haoyang-(Complete-Mesh|Nose-Continuous)-Portrait/.test(material.name) || material.name === 'Haoyang_Colored_Resin') {
    material.roughness = 0.84
    material.metalness = 0
    material.envMapIntensity = 0.65
    if (material instanceof THREE.MeshPhysicalMaterial) material.specularIntensity = 0.18
  } else if (/original-photographic-iris/.test(material.name)) {
    material.roughness = 0.19
    if (material instanceof THREE.MeshPhysicalMaterial) material.specularIntensity = 0.85
  } else if (/warm-natural-sclera/.test(material.name)) {
    material.roughness = 0.38
  }
}

/** Match both parts of the head to one BRDF without mutating cached GLB materials. */
export function clonePortraitMaterial(source: THREE.Material): THREE.Material {
  let copy: THREE.Material
  if (source.name === 'Haoyang_Colored_Resin' && source instanceof THREE.MeshStandardMaterial && !(source instanceof THREE.MeshPhysicalMaterial)) {
    const physical = new THREE.MeshPhysicalMaterial()
    // Copy only standard properties; keep the physical defaults finite and complete.
    THREE.MeshStandardMaterial.prototype.copy.call(physical, source)
    physical.defines.PHYSICAL = ''
    copy = physical
  } else {
    copy = source.clone()
  }
  stylePortraitMaterial(copy)
  return copy
}
