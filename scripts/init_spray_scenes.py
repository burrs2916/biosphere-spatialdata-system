#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从巷道场景(scene_spray_tunnel)初始化 廊桥(scene_spray_bridge) 与 综采(scene_spray_mining) 两个大屏场景。

做法：以巷道为完整模板，深拷贝其 editor_components / views / layout，并做两处变换：
  1) 组件 ID 整体加区域前缀，避免跨场景 ID 重复：
       comp_xxx  ->  comp_bridge_xxx  /  comp_mining_xxx
     (覆盖 comp_tunnel_*、comp_log_*、comp_1785... 等所有组件 ID，及 layout.componentId 引用)
  2) 显示文本中的 "巷道" 替换为区域名（廊桥 / 综采），覆盖主标题、设备列表名、列标签、视频标题。

特性：
  - 运行前自动备份 data/config.db -> data/config.db.bak.<timestamp>
  - 幂等：直接覆盖目标场景的内容字段（editor_components/views/layout/...），
          保留目标场景自身的 id / name / description / category_id / status / created_at。
  - 仅当源场景存在且目标场景存在时才执行。

用法：
  python3 scripts/init_spray_scenes.py [path/to/config.db]
"""
import sqlite3
import json
import sys
import os
import shutil
from datetime import datetime

SOURCE = "scene_spray_tunnel"
# (scene_id, 区域显示名, id前缀)
TARGETS = [
    ("scene_spray_bridge", "廊桥", "bridge"),
    ("scene_spray_mining", "综采", "mining"),
]

# 需要整体拷贝(不做 ID 变换)的内容字段
COPY_FIELDS = [
    "layers", "bindings", "variables", "global_components",
    "viewport_sync_rules", "canvas_config", "editor_layers", "active_view_id",
]


def collect_ids(obj, acc):
    """递归收集所有形如组件 ID 的字符串(comp_ 开头)。"""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "id" and isinstance(v, str) and v.startswith("comp_"):
                acc.add(v)
            collect_ids(v, acc)
    elif isinstance(obj, list):
        for it in obj:
            collect_ids(it, acc)


def transform(obj, id_map, zone):
    """深变换：组件 ID 按 id_map 替换，所有字符串中的旧 ID 与 '巷道' 按 zone 替换。"""
    if isinstance(obj, dict):
        new = {}
        for k, v in obj.items():
            # 组件自身的 id 字段
            if k == "id" and isinstance(v, str) and v in id_map:
                new[k] = id_map[v]
            else:
                new[k] = transform(v, id_map, zone)
        return new
    elif isinstance(obj, list):
        return [transform(it, id_map, zone) for it in obj]
    elif isinstance(obj, str):
        s = obj
        for old, new_id in id_map.items():
            if old in s:
                s = s.replace(old, new_id)
        if "巷道" in s:
            s = s.replace("巷道", zone)
        return s
    return obj


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "data/config.db"
    if not os.path.exists(db_path):
        print(f"[ERR] 找不到数据库: {db_path}")
        sys.exit(1)

    # 备份
    bak = f"{db_path}.bak.{datetime.now().strftime('%Y%m%d%H%M%S')}"
    shutil.copy2(db_path, bak)
    print(f"[OK] 已备份 -> {bak}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 源场景必须存在
    src = cur.execute("SELECT * FROM scenes WHERE id=?", (SOURCE,)).fetchone()
    if src is None:
        print(f"[ERR] 源场景不存在: {SOURCE}")
        sys.exit(1)

    # 收集源场景所有组件 ID，构建 id_map
    all_ids = set()
    collect_ids(json.loads(src["views"]), all_ids)
    collect_ids(json.loads(src["editor_components"]), all_ids)
    collect_ids(json.loads(src["layout"]), all_ids)

    for (tid, zone, prefix) in TARGETS:
        tgt = cur.execute("SELECT id FROM scenes WHERE id=?", (tid,)).fetchone()
        if tgt is None:
            print(f"[SKIP] 目标场景不存在: {tid}")
            continue

        id_map = {cid: cid.replace("comp_", f"comp_{prefix}_", 1) for cid in all_ids}
        # 用 replace 避免多切下划线：comp_tunnel_1 -> comp_bridge_tunnel_1（单下划线）

        views_new = transform(json.loads(src["views"]), id_map, zone)
        ec_new = transform(json.loads(src["editor_components"]), id_map, zone)
        layout_new = transform(json.loads(src["layout"]), id_map, zone)

        values = {
            "editor_components": json.dumps(ec_new, ensure_ascii=False),
            "views": json.dumps(views_new, ensure_ascii=False),
            "layout": json.dumps(layout_new, ensure_ascii=False),
            "updated_at": int(datetime.now().timestamp()),
        }
        for f in COPY_FIELDS:
            values[f] = src[f]

        set_clause = ", ".join(f"{f}=:{f}" for f in values.keys())
        cur.execute(
            f"UPDATE scenes SET {set_clause} WHERE id=:tid",
            {**values, "tid": tid},
        )

        # 统计
        n_views = len(views_new)
        n_comps = sum(len(v.get("components", [])) for v in views_new)
        print(f"[OK] {tid} ({zone}) 初始化完成: {n_views} 视图 / {n_comps} 组件, "
              f"ID 前缀 comp_{prefix}_")

    conn.commit()
    conn.close()
    print("[DONE] 全部完成。")


if __name__ == "__main__":
    main()
