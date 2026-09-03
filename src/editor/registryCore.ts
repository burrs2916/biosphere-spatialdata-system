import type { ComponentDefinition, RendererLoader } from "../types/editor";

class ComponentRegistryImpl {
  private definitions = new Map<string, ComponentDefinition>();
  private iconOverrides = new Map<string, string>();

  register(definition: ComponentDefinition): void {
    if (this.definitions.has(definition.type)) {
      console.warn(`[ComponentRegistry] Component type "${definition.type}" is already registered, overwriting.`);
    }
    this.definitions.set(definition.type, definition);
  }

  unregister(type: string): boolean {
    this.iconOverrides.delete(type);
    return this.definitions.delete(type);
  }

  get(type: string): ComponentDefinition | undefined {
    return this.definitions.get(type);
  }

  getEffectiveIcon(type: string): string | undefined {
    const def = this.definitions.get(type);
    if (!def) return undefined;
    return this.iconOverrides.get(type) ?? def.icon;
  }

  setIconOverride(type: string, icon: string | null | undefined): void {
    if (icon == null || icon === "") {
      this.iconOverrides.delete(type);
    } else {
      this.iconOverrides.set(type, icon);
    }
  }

  getIconOverride(type: string): string | undefined {
    return this.iconOverrides.get(type);
  }

  getAll(): ComponentDefinition[] {
    return Array.from(this.definitions.values());
  }

  getByCategory(category: string): ComponentDefinition[] {
    return this.getAll().filter((d) => d.category === category);
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    this.definitions.forEach((d) => categories.add(d.category));
    return Array.from(categories);
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  async loadRenderer(type: string): Promise<React.ComponentType<any> | null> {
    const def = this.definitions.get(type);
    if (!def) return null;
    if (def.renderer.cached) return def.renderer.cached;
    try {
      const mod = await def.renderer.loader();
      def.renderer.cached = mod.default;
      return mod.default;
    } catch (err) {
      console.error(`[ComponentRegistry] Failed to load renderer for "${type}":`, err);
      return null;
    }
  }

  getEnabled(): ComponentDefinition[] {
    return this.getAll().filter((d) => d.enabled !== false);
  }
}

export const componentRegistry = new ComponentRegistryImpl();

export const lazy = (loader: RendererLoader): ComponentDefinition["renderer"] => ({
  loader,
});
