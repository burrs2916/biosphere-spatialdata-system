import * as THREE from 'three';

export class ZoomAnimator {
  private _camera: THREE.OrthographicCamera;
  private _isAnimating = false;
  private _startState: { centerX: number; centerY: number; halfW: number; halfH: number } | null = null;
  private _targetState: { centerX: number; centerY: number; halfW: number; halfH: number } | null = null;
  private _startTime = 0;
  private _duration = 300;
  private _easing: (t: number) => number = easeInOutCubic;
  private _onComplete?: () => void;
  private _rafId: number | null = null;

  constructor(camera: THREE.OrthographicCamera) {
    this._camera = camera;
  }

  animateTo(
    targetCenterX: number, targetCenterY: number,
    targetHalfW: number, targetHalfH: number,
    duration: number = 300,
    onComplete?: () => void,
  ): void {
    this.cancel();
    this._startState = {
      centerX: this._camera.position.x,
      centerY: this._camera.position.y,
      halfW: this._camera.right,
      halfH: this._camera.top,
    };
    this._targetState = {
      centerX: targetCenterX,
      centerY: targetCenterY,
      halfW: targetHalfW,
      halfH: targetHalfH,
    };
    this._duration = duration;
    this._onComplete = onComplete;
    this._startTime = performance.now();
    this._isAnimating = true;
    this._tick();
  }

  get isAnimating(): boolean {
    return this._isAnimating;
  }

  cancel(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._isAnimating = false;
  }

  private _tick(): void {
    if (!this._isAnimating || !this._startState || !this._targetState) return;
    const elapsed = performance.now() - this._startTime;
    const t = Math.min(1, elapsed / this._duration);
    const easedT = this._easing(t);

    const centerX = this._startState.centerX + (this._targetState.centerX - this._startState.centerX) * easedT;
    const centerY = this._startState.centerY + (this._targetState.centerY - this._startState.centerY) * easedT;
    const halfW = this._startState.halfW + (this._targetState.halfW - this._startState.halfW) * easedT;
    const halfH = this._startState.halfH + (this._targetState.halfH - this._startState.halfH) * easedT;

    this._camera.position.set(centerX, centerY, this._camera.position.z);
    this._camera.left = -halfW;
    this._camera.right = halfW;
    this._camera.top = halfH;
    this._camera.bottom = -halfH;
    this._camera.updateProjectionMatrix();

    if (t < 1) {
      this._rafId = requestAnimationFrame(() => this._tick());
    } else {
      this._isAnimating = false;
      this._onComplete?.();
    }
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
