/**
 * Cali Viva — registro de recursos GPU para liberar memoria de forma determinista.
 * Duck-typing: funciona con objetos Three.js (geometrías, materiales, texturas, Object3D)
 * y con dobles de prueba en Node.
 */

function materialTextures(material) {
  const out = [];
  for (const value of Object.values(material)) {
    if (value && value.isTexture && typeof value.dispose === 'function') out.push(value);
  }
  if (material.uniforms) {
    for (const u of Object.values(material.uniforms)) {
      if (u && u.value && u.value.isTexture && typeof u.value.dispose === 'function') out.push(u.value);
    }
  }
  return out;
}

export class ResourceTracker {
  #resources = new Set();
  #disposed = false;

  /** Registra un recurso (o un árbol Object3D completo) y lo devuelve. */
  track(resource) {
    if (!resource) return resource;
    if (this.#disposed) throw new Error('ResourceTracker already disposed');
    if (Array.isArray(resource)) {
      resource.forEach((r) => this.track(r));
      return resource;
    }
    if (typeof resource.traverse === 'function') {
      resource.traverse((node) => {
        if (node.geometry) this.track(node.geometry);
        if (node.material) this.track(node.material);
      });
      return resource;
    }
    if (typeof resource.dispose === 'function') {
      this.#resources.add(resource);
      if (resource.isMaterial || resource.uniforms) materialTextures(resource).forEach((t) => this.#resources.add(t));
    }
    return resource;
  }

  get size() {
    return this.#resources.size;
  }

  /** Libera todo una sola vez. Devuelve cuántos recursos se liberaron. */
  dispose() {
    let count = 0;
    for (const r of this.#resources) {
      try {
        r.dispose();
        count += 1;
      } catch (error) {
        console.warn('[cali-viva] dispose failed', error);
      }
    }
    this.#resources.clear();
    this.#disposed = true;
    return count;
  }
}
