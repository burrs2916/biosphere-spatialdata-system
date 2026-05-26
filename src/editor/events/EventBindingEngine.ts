import type { SceneEventDispatcher } from "../events/SceneEventDispatcher";
import type { EventBinding } from "../../types/editor";
import type { DataOrchestrator } from "../../datasource/orchestration/DataOrchestrator";

type EventBindingActionHandler = (targetComponentId: string, action: string, params?: Record<string, unknown>) => void;

export class EventBindingEngine {
  private bindings: Map<string, EventBinding> = new Map();
  private eventDispatcher: SceneEventDispatcher | null = null;
  private dataOrchestrator: DataOrchestrator | null = null;
  private actionHandler: EventBindingActionHandler | null = null;
  private unsubs: (() => void)[] = [];
  private handledEvents: Set<string> = new Set();

  setEventDispatcher(dispatcher: SceneEventDispatcher): void {
    this.eventDispatcher = dispatcher;
    this.rebindAll();
  }

  setDataOrchestrator(orchestrator: DataOrchestrator): void {
    this.dataOrchestrator = orchestrator;
  }

  setActionHandler(handler: EventBindingActionHandler): void {
    this.actionHandler = handler;
  }

  registerBinding(binding: EventBinding): void {
    this.bindings.set(binding.id, binding);
    this.subscribeIfNeeded(binding);
  }

  unregisterBinding(bindingId: string): void {
    this.bindings.delete(bindingId);
  }

  setupFromBindings(bindings: EventBinding[]): void {
    this.clear();
    for (const binding of bindings) {
      this.registerBinding(binding);
    }
  }

  clear(): void {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
    this.handledEvents.clear();
    this.bindings.clear();
  }

  private subscribeIfNeeded(binding: EventBinding): void {
    if (!this.eventDispatcher) return;

    const eventKey = `${binding.sourceComponentId}:${binding.sourceEvent}`;
    if (this.handledEvents.has(eventKey)) return;
    this.handledEvents.add(eventKey);

    const unsub = this.eventDispatcher.on(eventKey, (payload: unknown) => {
      this.handleEvent(binding.sourceComponentId, binding.sourceEvent, payload);
    });
    this.unsubs.push(unsub);

    if (binding.sourceComponentId === '*' || !binding.sourceComponentId) {
      const wildcardKey = `*:${binding.sourceEvent}`;
      if (this.handledEvents.has(wildcardKey)) return;
      this.handledEvents.add(wildcardKey);

      const wildcardUnsub = this.eventDispatcher.on(binding.sourceEvent, (payload: unknown) => {
        this.handleEvent('*', binding.sourceEvent, payload);
      });
      this.unsubs.push(wildcardUnsub);
    }
  }

  private handleEvent(sourceComponentId: string, sourceEvent: string, payload: unknown): void {
    for (const [, binding] of this.bindings) {
      const componentMatch = binding.sourceComponentId === sourceComponentId
        || binding.sourceComponentId === '*'
        || !binding.sourceComponentId;
      const eventMatch = binding.sourceEvent === sourceEvent;

      if (!componentMatch || !eventMatch) {
        continue;
      }

      if (binding.condition) {
        try {
          const fn = new Function('payload', `"use strict"; return (${binding.condition});`);
          if (!fn(payload)) continue;
        } catch {
          continue;
        }
      }

      this.executeAction(binding, payload);
    }
  }

  private executeAction(binding: EventBinding, _payload: unknown): void {
    const { targetComponentId, targetAction, params } = binding;

    if (this.actionHandler) {
      this.actionHandler(targetComponentId, targetAction, params);
      return;
    }

    if (!this.dataOrchestrator) return;

    switch (targetAction) {
      case 'highlight':
        this.dataOrchestrator.getBridge().updateComponent(targetComponentId, '__highlight', params?.value ?? true);
        break;
      case 'hide':
        this.dataOrchestrator.getBridge().updateComponent(targetComponentId, 'visible', false);
        break;
      case 'show':
        this.dataOrchestrator.getBridge().updateComponent(targetComponentId, 'visible', true);
        break;
      case 'setData':
        if (params?.property && params?.value !== undefined) {
          this.dataOrchestrator.getBridge().updateComponent(targetComponentId, String(params.property), params.value);
        }
        break;
      case 'navigate':
        if (params?.url && typeof params.url === 'string') {
          window.open(params.url, '_blank', 'noopener,noreferrer');
        }
        break;
      default:
        this.dataOrchestrator.getBridge().updateComponent(targetComponentId, targetAction, params ?? true);
        break;
    }
  }

  private rebindAll(): void {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
    this.handledEvents.clear();

    for (const [, binding] of this.bindings) {
      this.subscribeIfNeeded(binding);
    }
  }

  destroy(): void {
    this.clear();
    this.eventDispatcher = null;
    this.dataOrchestrator = null;
    this.actionHandler = null;
  }
}
