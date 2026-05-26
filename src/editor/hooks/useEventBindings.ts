import { useEffect, useRef } from "react";
import { useEventBindingEngine } from "../context/SceneEditorContext";
import { useEditorStore } from "../../store/editorStore";

export function useEventBindings() {
  const eventBindingEngine = useEventBindingEngine();
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!eventBindingEngine) return;

    const unsub = useEditorStore.subscribe((state) => {
      const currentBindings = state.eventBindings ?? [];
      const currentIds = new Set(currentBindings.map(b => b.id));

      for (const id of prevIdsRef.current) {
        if (!currentIds.has(id)) {
          eventBindingEngine.unregisterBinding(id);
        }
      }

      for (const binding of currentBindings) {
        if (!prevIdsRef.current.has(binding.id)) {
          eventBindingEngine.registerBinding(binding);
        }
      }

      prevIdsRef.current = currentIds;
    });

    const state = useEditorStore.getState();
    if (state.eventBindings.length > 0) {
      eventBindingEngine.setupFromBindings(state.eventBindings);
      prevIdsRef.current = new Set(state.eventBindings.map(b => b.id));
    }

    return () => {
      eventBindingEngine.clear();
      prevIdsRef.current.clear();
      unsub();
    };
  }, [eventBindingEngine]);
}
