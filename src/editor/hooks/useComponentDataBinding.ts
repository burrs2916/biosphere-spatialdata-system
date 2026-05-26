import { useEffect, useCallback, useRef } from "react";
import { useComponentDataBridge } from "../context/SceneEditorContext";
import { useEditorStore } from "../../store/editorStore";

export function useComponentDataBinding(componentId: string) {
  const bridge = useComponentDataBridge();
  const updateComponentConfig = useEditorStore((s) => s.updateComponentConfig);
  const latestDataRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    if (!bridge || !componentId) return;

    const unregister = bridge.registerUpdater(componentId, (property: string, value: unknown) => {
      latestDataRef.current[property] = value;

      if (property === "data" || property === "option" || property === "value") {
        updateComponentConfig(componentId, { [property]: value });
      } else if (property === "visible") {
        const store = useEditorStore.getState();
        store.updateComponent(componentId, { visible: value as boolean });
      } else {
        updateComponentConfig(componentId, { [property]: value });
      }
    });

    return unregister;
  }, [bridge, componentId, updateComponentConfig]);

  const pushData = useCallback(
    (property: string, value: unknown) => {
      if (!bridge || !componentId) return;
      bridge.updateComponent(componentId, property, value);
    },
    [bridge, componentId]
  );

  const getData = useCallback(
    (property: string): unknown => {
      if (!bridge || !componentId) return undefined;
      return bridge.getComponentProperty(componentId, property);
    },
    [bridge, componentId]
  );

  return { pushData, getData, latestData: latestDataRef.current };
}
