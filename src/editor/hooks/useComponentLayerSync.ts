import { useEffect, useRef } from "react";
import { useLayerRegistry, useViewportSyncService } from "../context/SceneEditorContext";
import { useEditorStore, type EditorState } from "../../store/editorStore";
import { ComponentLayerAdapter, type ComponentLayerState } from "../layers/ComponentLayerAdapter";
import { componentRegistry } from "../registry";

const SPATIAL_COMPONENT_PREFIXES = ['map-', 'globe-', 'cad-', '3d-'];

function resolveLayerType(componentType: string): 'spatial' | 'overlay' | 'widget' {
  const definition = componentRegistry.get(componentType);
  if (definition?.layerType) return definition.layerType;
  if (SPATIAL_COMPONENT_PREFIXES.some(prefix => componentType.startsWith(prefix))) return 'spatial';
  return 'overlay';
}

export function useComponentLayerSync() {
  const layerRegistry = useLayerRegistry();
  const viewportSyncService = useViewportSyncService();
  const registeredRef = useRef<Map<string, ComponentLayerAdapter>>(new Map());

  useEffect(() => {
    if (!layerRegistry) return;

    const unsub = useEditorStore.subscribe((state: EditorState, prevState: EditorState) => {
      if (state.components === prevState.components) return;

      const registered = registeredRef.current;
      const components = state.components;
      const currentIds = new Set(components.map((c) => c.id));

      for (const [id] of registered) {
        if (!currentIds.has(id)) {
          if (viewportSyncService) {
            viewportSyncService.unregisterProvider(id);
          }
          layerRegistry.unregister(id);
          registered.delete(id);
        }
      }

      for (const comp of components) {
        const existing = registered.get(comp.id);
        if (existing) {
          existing.updateConfig(comp.config as Record<string, unknown>);
          existing.visible = comp.visible;
          existing.zIndex = comp.zIndex;
        } else {
          const layerState: ComponentLayerState = {
            componentId: comp.id,
            componentType: comp.type,
            config: comp.config as Record<string, unknown>,
            data: comp.config?.data,
          };

          const adapter = new ComponentLayerAdapter(comp.id, comp.name || comp.type, layerState, {
            type: resolveLayerType(comp.type),
            zIndex: comp.zIndex,
            visible: comp.visible,
            locked: comp.locked,
          });

          adapter.setViewportSyncService(viewportSyncService);
          layerRegistry.register(adapter);
          registered.set(comp.id, adapter);
        }
      }
    });

    const components = useEditorStore.getState().components;
    const registered = registeredRef.current;

    for (const comp of components) {
      if (!registered.has(comp.id)) {
        const layerState: ComponentLayerState = {
          componentId: comp.id,
          componentType: comp.type,
          config: comp.config as Record<string, unknown>,
          data: comp.config?.data,
        };

        const adapter = new ComponentLayerAdapter(comp.id, comp.name || comp.type, layerState, {
          type: resolveLayerType(comp.type),
          zIndex: comp.zIndex,
          visible: comp.visible,
          locked: comp.locked,
        });

        adapter.setViewportSyncService(viewportSyncService);
        layerRegistry.register(adapter);
        registered.set(comp.id, adapter);
      }
    }

    return () => {
      unsub();
      for (const [id] of registered) {
        if (viewportSyncService) {
          viewportSyncService.unregisterProvider(id);
        }
        layerRegistry.unregister(id);
      }
      registered.clear();
    };
  }, [layerRegistry, viewportSyncService]);
}
