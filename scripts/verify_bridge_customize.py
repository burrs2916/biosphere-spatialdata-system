#!/usr/bin/env python3
"""
验证：对"廊桥喷雾监控"场景的定制逻辑（customize_bridge_scene）在"全新数据库"上运行的结果，
与当前开发库 data/config.db 中已手工定制的 scene_spray_bridge 完全一致。

等价链：fresh_clone(tunnel) -> customize == dev_db.scene_spray_bridge

用法：
    python3 scripts/verify_bridge_customize.py
退出码 0=等价，1=不等价。
"""
import json
import sqlite3
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "config.db")


def transform_clone(value, prefix, region_name):
    """镜像 migration.rs::transform_clone：递归前缀化所有 comp_ id + 替换"巷道"文案。"""
    if isinstance(value, dict):
        return {k: transform_clone(v, prefix, region_name) for k, v in value.items()}
    if isinstance(value, list):
        return [transform_clone(v, prefix, region_name) for v in value]
    if isinstance(value, str):
        out = value.replace("巷道", region_name) if "巷道" in value else value
        rp = f"comp_{prefix}_"
        if out.startswith("comp_") and not out.startswith(rp):
            out = rp + out[len("comp_"):]
        return out
    return value


def apply_bridge_reflow(comp):
    """镜像 migration.rs::apply_bridge_reflow：仅调整 y / height。"""
    cid = comp.get("id")
    spec = {
        "comp_bridge_tunnel_40": (660, 1160),
        "comp_bridge_tunnel_41": (670, 1150),
        "comp_bridge_tunnel_42": (1320, 540),
        "comp_bridge_tunnel_36": (190, 1640),
    }.get(cid)
    if spec is None:
        return
    y, h = spec
    tf = comp.get("transform")
    if isinstance(tf, dict):
        tf["y"] = y
        tf["height"] = h


def set_bridge_control_mode(comp):
    """镜像 migration.rs::set_bridge_control_mode：喷雾控制工具栏 sceneMode -> bridge。"""
    if comp.get("type") != "industrial-spray-control-toolbar":
        return
    cfg = comp.setdefault("config", {})
    cfg["sceneMode"] = "bridge"


# 镜像 migration.rs::inject_bridge_flow_cards 的卡片定义（落点/配置保持一致）
FLOW_CARDS = [
    {
        "id": "comp_bridge_flow_1",
        "type": "industrial-stats-card",
        "name": "廊桥累计用水",
        "transform": {"x": 680, "y": 1695, "width": 580, "height": 165, "rotation": 0, "scale": {"x": 1, "y": 1}},
        "layerId": "layer_default",
        "zIndex": 50,
        "locked": False,
        "visible": True,
        "config": {
            "statType": "water_usage_total",
            "cardName": "廊桥累计用水",
            "iconType": "water",
            "unit": "m³",
            "color": "#4fc3f7",
            "theme": "dark",
            "precision": 2,
        },
    },
    {
        "id": "comp_bridge_flow_2",
        "type": "industrial-stats-card",
        "name": "廊桥瞬时流量",
        "transform": {"x": 1280, "y": 1695, "width": 580, "height": 165, "rotation": 0, "scale": {"x": 1, "y": 1}},
        "layerId": "layer_default",
        "zIndex": 51,
        "locked": False,
        "visible": True,
        "config": {
            "statType": "total_flow",
            "cardName": "廊桥瞬时流量",
            "iconType": "flow",
            "unit": "L/s",
            "color": "#4fc3f7",
            "theme": "dark",
            "precision": 2,
        },
    },
]


def inject_bridge_flow_cards(ec, views, layout):
    """镜像 migration.rs::inject_bridge_flow_cards：幂等注入 2 张水流量监测卡片。"""
    for card in FLOW_CARDS:
        cid = card["id"]
        # editor_components
        if isinstance(ec, list) and not any(c.get("id") == cid for c in ec):
            ec.append(json.loads(json.dumps(card)))  # 深拷贝
        # view_default.components
        if isinstance(views, list):
            for v in views:
                if v.get("id") == "view_default" and isinstance(v.get("components"), list):
                    comps = v["components"]
                    if not any(c.get("id") == cid for c in comps):
                        comps.append(json.loads(json.dumps(card)))
        # layout
        if isinstance(layout, list) and not any(c.get("componentId") == cid for c in layout):
            tf = card["transform"]
            layout.append({
                "componentId": cid,
                "x": tf["x"],
                "y": tf["y"],
                "w": tf["width"],
                "h": tf["height"],
                "zIndex": card["zIndex"],
            })


def customize_bridge_scene(ec, views, layout):
    """镜像 migration.rs::customize_bridge_scene，返回 (new_ec, new_views, new_layout)。"""
    remove = [
        "comp_bridge_tunnel_13", "comp_bridge_tunnel_14", "comp_bridge_tunnel_15",
        "comp_bridge_tunnel_25", "comp_bridge_tunnel_26", "comp_bridge_tunnel_27",
        "comp_bridge_tunnel_28",
    ]

    # 1) editor_components
    if isinstance(ec, list):
        ec = [c for c in ec if c.get("id") not in remove]
        for c in ec:
            apply_bridge_reflow(c)
            set_bridge_control_mode(c)

    # 2) views
    if isinstance(views, list):
        for v in views:
            comps = v.get("components")
            if isinstance(comps, list):
                comps = [c for c in comps if c.get("id") not in remove]
                for c in comps:
                    apply_bridge_reflow(c)
                    set_bridge_control_mode(c)
                v["components"] = comps
        # 确保 42 在 view_default.components
        vd = next((v for v in views if v.get("id") == "view_default"), None)
        if vd is not None and isinstance(vd.get("components"), list):
            comps = vd["components"]
            has42 = any(c.get("id") == "comp_bridge_tunnel_42" for c in comps)
            if not has42 and isinstance(ec, list):
                c42 = next((c for c in ec if c.get("id") == "comp_bridge_tunnel_42"), None)
                if c42 is not None:
                    c42 = json.loads(json.dumps(c42))  # 深拷贝
                    tf = c42.setdefault("transform", {})
                    tf["x"] = 2890
                    tf["y"] = 1320
                    tf["width"] = 910
                    tf["height"] = 540
                    comps.append(c42)
                    vd["components"] = comps

    # 3) layout
    if isinstance(layout, list):
        layout = [c for c in layout if c.get("componentId") not in remove]
        for c in layout:
            cid = c.get("componentId")
            if cid == "comp_bridge_tunnel_40":
                c["y"] = 660
                c["h"] = 1160
            elif cid == "comp_bridge_tunnel_41":
                c["y"] = 670
                c["h"] = 1150

    # 4) 注入廊桥专属水流量监测卡片（镜像 migration.rs::inject_bridge_flow_cards）
    inject_bridge_flow_cards(ec, views, layout)

    return ec, views, layout


def strip_runtime_state(views):
    """移除编辑器运行时态（viewport 缩放/平移），仅比较场景内容等价性。
    migration 的 customize_bridge_scene 不修改 viewport，且 fresh 克隆会沿用隧道缩放，
    而人工查看/编辑过的库缩放不同——这属于编辑器 UI 状态，不影响场景内容等价。"""
    if not isinstance(views, list):
        return views
    out = []
    for v in views:
        if isinstance(v, dict):
            v = dict(v)
            v.pop("viewport", None)
        out.append(v)
    return out


def main():
    conn = sqlite3.connect(DB)
    c = conn.cursor()

    ec_t, views_t, layout_t = c.execute(
        "SELECT editor_components, views, layout FROM scenes WHERE id='scene_spray_tunnel'"
    ).fetchone()
    ec_t, views_t, layout_t = json.loads(ec_t), json.loads(views_t), json.loads(layout_t)

    # 全新库：从 tunnel 克隆出 bridge（transform_clone）
    cloned_ec = transform_clone(ec_t, "bridge", "廊桥")
    cloned_views = transform_clone(views_t, "bridge", "廊桥")
    cloned_layout = transform_clone(layout_t, "bridge", "廊桥")

    # 应用定制
    new_ec, new_views, new_layout = customize_bridge_scene(
        cloned_ec, cloned_views, cloned_layout
    )

    # 开发库当前 bridge
    ec_b, views_b, layout_b = c.execute(
        "SELECT editor_components, views, layout FROM scenes WHERE id='scene_spray_bridge'"
    ).fetchone()
    ec_b, views_b, layout_b = json.loads(ec_b), json.loads(views_b), json.loads(layout_b)

    # 仅比较场景内容：去掉编辑器运行时态 viewport
    new_views = strip_runtime_state(new_views)
    views_b = strip_runtime_state(views_b)

    conn.close()

    ok = True
    for name, a, b in [
        ("editor_components", new_ec, ec_b),
        ("views", new_views, views_b),
        ("layout", new_layout, layout_b),
    ]:
        if a == b:
            print(f"[OK]   {name}: 等价（{len(a) if isinstance(a, list) else '?' } 项）")
        else:
            ok = False
            print(f"[FAIL] {name}: 不等价")
            # 找出差异
            if isinstance(a, list) and isinstance(b, list):
                ids_a = [x.get("id") or x.get("componentId") for x in a]
                ids_b = [x.get("id") or x.get("componentId") for x in b]
                if ids_a != ids_b:
                    print(f"        id 列表差异:\n          clone+customize: {ids_a}\n          dev_db         : {ids_b}")
                else:
                    for xa, xb in zip(a, b):
                        if xa != xb:
                            ia = xa.get("id") or xa.get("componentId")
                            print(f"        组件 {ia} 不同:\n          clone+customize: {json.dumps(xa, ensure_ascii=False)}\n          dev_db         : {json.dumps(xb, ensure_ascii=False)}")

    if ok:
        print("\n等价验证通过：fresh_clone(tunnel) -> customize == data/config.db.scene_spray_bridge")
        return 0
    print("\n等价验证失败")
    return 1


if __name__ == "__main__":
    sys.exit(main())
