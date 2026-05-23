import * as THREE from 'three';
import { logger } from '../../../utils/logger';

export class ContextLossHandler {
  private _renderer: THREE.WebGLRenderer;
  private _isContextLost = false;
  private _onRestore?: () => void;
  private _onLoss?: () => void;

  constructor(renderer: THREE.WebGLRenderer, onRestore?: () => void, onLoss?: () => void) {
    this._renderer = renderer;
    this._onRestore = onRestore;
    this._onLoss = onLoss;
    this._bindEvents();
  }

  private _bindEvents(): void {
    const canvas = this._renderer.domElement;
    canvas.addEventListener('webglcontextlost', this._handleContextLost);
    canvas.addEventListener('webglcontextrestored', this._handleContextRestored);
  }

  private _handleContextLost = (e: Event): void => {
    e.preventDefault();
    this._isContextLost = true;
    logger.warn('ContextLossHandler', 'WebGL context lost');
    this._onLoss?.();
  };

  private _handleContextRestored = (): void => {
    this._isContextLost = false;
    logger.info('ContextLossHandler', 'WebGL context restored');
    this._onRestore?.();
  };

  get isContextLost(): boolean {
    return this._isContextLost;
  }

  dispose(): void {
    const canvas = this._renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this._handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this._handleContextRestored);
  }
}
