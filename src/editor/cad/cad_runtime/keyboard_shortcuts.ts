export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
}

export class KeyboardShortcutManager {
  private _bindings: Map<string, KeyBinding> = new Map();
  private _actionHandlers: Map<string, () => void> = new Map();
  private _enabled = true;
  private _handler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this._registerDefaults();
  }

  private _registerDefaults(): void {
    this.register({ key: 'v', ctrl: false, action: 'select', description: '选择模式' });
    this.register({ key: 'h', ctrl: false, action: 'pan', description: '平移模式' });
    this.register({ key: 'l', ctrl: false, action: 'draw_line', description: '画线' });
    this.register({ key: 'c', ctrl: false, action: 'draw_circle', description: '画圆' });
    this.register({ key: 't', ctrl: false, action: 'draw_text', description: '文字' });
    this.register({ key: 'Escape', action: 'cancel', description: '取消/退出' });
    this.register({ key: 'Delete', action: 'delete_selected', description: '删除选中' });
    this.register({ key: 'a', ctrl: true, action: 'select_all', description: '全选' });
    this.register({ key: 'z', ctrl: true, action: 'undo', description: '撤销' });
    this.register({ key: 'z', ctrl: true, shift: true, action: 'redo', description: '重做' });
    this.register({ key: 'f', ctrl: false, action: 'fit_to_view', description: '适应视图' });
    this.register({ key: '=', ctrl: true, action: 'zoom_in', description: '放大' });
    this.register({ key: '-', ctrl: true, action: 'zoom_out', description: '缩小' });
    this.register({ key: 'g', ctrl: false, action: 'toggle_grid', description: '切换网格' });
    this.register({ key: 'e', ctrl: false, action: 'measure_distance', description: '测量距离' });
    this.register({ key: 'r', ctrl: false, action: 'measure_area', description: '测量面积' });
    this.register({ key: 'n', ctrl: false, action: 'measure_angle', description: '测量角度' });
    this.register({ key: 'q', ctrl: false, action: 'measure_coordinate', description: '坐标查询' });
    this.register({ key: 's', ctrl: false, action: 'toggle_snap', description: '切换捕捉' });
    this.register({ key: 'p', ctrl: true, action: 'print', description: '打印' });
    this.register({ key: 'b', ctrl: false, action: 'search', description: '搜索' });
    this.register({ key: 'm', ctrl: false, action: 'minimap', description: '小地图' });
  }

  register(binding: KeyBinding): void {
    const combo = this._makeCombo(binding);
    this._bindings.set(combo, binding);
  }

  unregister(key: string, ctrl?: boolean, shift?: boolean, alt?: boolean): void {
    const combo = this._makeCombo({ key, ctrl, shift, alt, action: '', description: '' });
    this._bindings.delete(combo);
  }

  setActionHandler(action: string, handler: () => void): void {
    this._actionHandlers.set(action, handler);
  }

  removeActionHandler(action: string): void {
    this._actionHandlers.delete(action);
  }

  enable(): void { this._enabled = true; }
  disable(): void { this._enabled = false; }

  attach(element: HTMLElement): void {
    this._handler = (e: KeyboardEvent) => {
      if (!this._enabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const combo = this._makeComboFromEvent(e);
      const binding = this._bindings.get(combo);
      if (binding) {
        e.preventDefault();
        const handler = this._actionHandlers.get(binding.action);
        handler?.();
      }
    };
    element.addEventListener('keydown', this._handler);
  }

  detach(element: HTMLElement): void {
    if (this._handler) {
      element.removeEventListener('keydown', this._handler);
      this._handler = null;
    }
  }

  getAllBindings(): KeyBinding[] {
    return Array.from(this._bindings.values());
  }

  getBindingsByAction(action: string): KeyBinding[] {
    return Array.from(this._bindings.values()).filter(b => b.action === action);
  }

  private _makeCombo(binding: KeyBinding): string {
    const parts: string[] = [];
    if (binding.ctrl) parts.push('ctrl');
    if (binding.shift) parts.push('shift');
    if (binding.alt) parts.push('alt');
    parts.push(binding.key.toLowerCase());
    return parts.join('+');
  }

  private _makeComboFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }
}
