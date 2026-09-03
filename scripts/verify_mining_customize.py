#!/usr/bin/env python3
"""
验证：对"综采喷雾监控"场景的定制逻辑（customize_mining_scene）在"全新数据库"上运行的结果，
与 data/config.db 中 scene_spray_mining 的定制状态一致，并满足关键不变量。

等价链：fresh_clone(tunnel) -> customize == data/config.db.scene_spray_mining

用法：
    python3 scripts/verify_mining_customize.py            # 仅校验（默认）
    python3 scripts/verify_mining_customize.py apply       # 先把定制效果写入 dev_db（幂等）
    python3 scripts/verify_mining_customize.py check       # 仅校验
退出码 0=等价/满足不变量，1=失败。
"""
import json
import sqlite3
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "config.db")

REMOVE = [
    "comp_mining_tunnel_13", "comp_mining_tunnel_14", "comp_mining_tunnel_15",
    "comp_mining_tunnel_25", "comp_mining_tunnel_26", "comp_mining_tunnel_27",
    "comp_mining_tunnel_28",
]


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


def apply_mining_reflow(comp):
    """镜像 migration.rs::apply_mining_reflow：仅调整 y / height。"""
    cid = comp.get("id")
    spec = {
        "comp_mining_tunnel_40": (660, 1200),
        "comp_mining_tunnel_41": (670, 1190),
        "comp_mining_tunnel_42": (1320, 540),
    }.get(cid)
    if spec is None:
        return
    y, h = spec
    tf = comp.get("transform")
    if isinstance(tf, dict):
        tf["y"] = y
        tf["height"] = h


def set_mining_control_mode(comp):
    """镜像 migration.rs::set_mining_control_mode：喷雾控制工具栏 sceneMode -> mining。"""
    if comp.get("type") != "industrial-spray-control-toolbar":
        return
    cfg = comp.setdefault("config", {})
    cfg["sceneMode"] = "mining"


def customize_mining_scene(ec, views, layout):
    """镜像 migration.rs::customize_mining_scene，返回 (new_ec, new_views, new_layout)。"""
    # 1) editor_components
    if isinstance(ec, list):
        ec = [c for c in ec if c.get("id") not in REMOVE]
        for c in ec:
            apply_mining_reflow(c)
            set_mining_control_mode(c)

    # 2) views
    if isinstance(views, list):
        for v in views:
            comps = v.get("components")
            if isinstance(comps, list):
                comps = [c for c in comps if c.get("id") not in REMOVE]
                for c in comps:
                    apply_mining_reflow(c)
                    set_mining_control_mode(c)
                v["components"] = comps
        # 确保 42 在 view_default.components
        vd = next((v for v in views if v.get("id") == "view_default"), None)
        if vd is not None and isinstance(vd.get("components"), list):
            comps = vd["components"]
            has42 = any(c.get("id") == "comp_mining_tunnel_42" for c in comps)
            if not has42 and isinstance(ec, list):
                c42 = next((c for c in ec if c.get("id") == "comp_mining_tunnel_42"), None)
                if c42 is not None:
                    c42 = json.loads(json.dumps(c42))  # 深拷贝
                    apply_mining_reflow(c42)
                    tf = c42.setdefault("transform", {})
                    if tf.get("x") is None:
                        tf["x"] = 2890
                    if tf.get("width") is None:
                        tf["width"] = 910
                    comps.append(c42)
                    vd["components"] = comps

    # 3) layout
    if isinstance(layout, list):
        layout = [c for c in layout if c.get("componentId") not in REMOVE]
        for c in layout:
            cid = c.get("componentId")
            if cid == "comp_mining_tunnel_40":
                c["y"] = 660
                c["h"] = 1200
            elif cid == "comp_mining_tunnel_41":
                c["y"] = 670
                c["h"] = 1190

    return ec, views, layout


def inject_shearer_curve(ec, views, layout):
    """镜像 migration.rs::inject_shearer_curve：往综采场景注入 comp_mining_tunnel_43。

    落点居中等宽（x680, y1695, w2160, h170），与廊桥水流量卡同高但更宽（综采用单条曲线不用双卡）。
    幂等：已含 43 则跳过。
    """
    cid = "comp_mining_tunnel_43"
    comp = {
        "id": cid,
        "type": "industrial-shearer-curve",
        "name": "煤机位置曲线",
        "transform": {"x": 680, "y": 1695, "width": 2160, "height": 170, "rotation": 0, "scale": {"x": 1, "y": 1}},
        "layerId": "layer_default",
        "zIndex": 50,
        "locked": False,
        "visible": True,
        "config": {
            "title": "煤机位置曲线",
            "smooth": True,
            "showArea": True,
            "showDataZoom": True,
            "yAxisName": "位置(号)",
            "selectedDeviceIds": [],
            "valuePrecision": 0,
            "historyEnabled": True,
            "historyRange": "6h",
            "historyAgg": "auto",
            "historyAutoRefresh": True,
            "yAxisMin": None,
            "yAxisMax": None,
        },
    }
    # editor_components
    if isinstance(ec, list) and not any(c.get("id") == cid for c in ec):
        ec.append(comp)
    # view_default.components
    if isinstance(views, list):
        for v in views:
            if v.get("id") == "view_default" and isinstance(v.get("components"), list):
                comps = v["components"]
                if not any(c.get("id") == cid for c in comps):
                    comps.append(comp)
    # layout（稀疏，渲染不使用但保持结构一致）
    if isinstance(layout, list) and not any(c.get("componentId") == cid for c in layout):
        layout.append({
            "componentId": cid,
            "x": 680, "y": 1695, "w": 2160, "h": 170, "zIndex": 50,
        })
    return ec, views, layout


def strip_runtime_state(views):
    """移除编辑器运行时态（viewport 缩放/平移），仅比较场景内容等价性。"""
    if not isinstance(views, list):
        return views
    out = []
    for v in views:
        if isinstance(v, dict):
            v = dict(v)
            v.pop("viewport", None)
        out.append(v)
    return out


def build_expected():
    """从 tunnel 全新克隆并施加综采定制，得到期望场景内容。"""
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    ec_t, views_t, layout_t = c.execute(
        "SELECT editor_components, views, layout FROM scenes WHERE id='scene_spray_tunnel'"
    ).fetchone()
    conn.close()
    ec_t, views_t, layout_t = json.loads(ec_t), json.loads(views_t), json.loads(layout_t)
    cloned_ec = transform_clone(ec_t, "mining", "综采")
    cloned_views = transform_clone(views_t, "mining", "综采")
    cloned_layout = transform_clone(layout_t, "mining", "综采")
    customized = customize_mining_scene(cloned_ec, cloned_views, cloned_layout)
    return inject_shearer_curve(*customized)


def apply_to_dev_db():
    """把综采定制效果写入 data/config.db（幂等：与 migration 等价，重复执行无副作用）。"""
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    ec, views, layout = build_expected()
    c.execute(
        "UPDATE scenes SET editor_components=?, views=?, layout=?, updated_at=strftime('%s','now') WHERE id='scene_spray_mining'",
        (json.dumps(ec, ensure_ascii=False), json.dumps(views, ensure_ascii=False), json.dumps(layout, ensure_ascii=False)),
    )
    conn.commit()
    conn.close()
    print("[apply] 已将综采定制写入 data/config.db.scene_spray_mining")


def check_invariants(ec, views, layout):
    """断言综采定制的关键不变量，返回 (ok, messages)。"""
    msgs = []
    ok = True

    ids_ec = [x.get("id") for x in ec] if isinstance(ec, list) else []
    # 1) 7 张统计卡已从 editor_components 移除
    for r in REMOVE:
        if r in ids_ec:
            ok = False
            msgs.append(f"[FAIL] editor_components 仍含统计卡 {r}")
    # 2) toolbar(21) sceneMode == mining
    tb = next((c for c in ec if c.get("id") == "comp_mining_tunnel_21"), None)
    if tb is None:
        ok = False
        msgs.append("[FAIL] 缺少 comp_mining_tunnel_21 工具栏")
    else:
        sm = (tb.get("config") or {}).get("sceneMode")
        if sm != "mining":
            ok = False
            msgs.append(f"[FAIL] 工具栏 sceneMode={sm}，应为 mining")
    # 3) 42 在 view_default.components
    vd = next((v for v in views if v.get("id") == "view_default"), None)
    comps_vd = (vd or {}).get("components", []) if isinstance(vd, dict) else []
    if not any(c.get("id") == "comp_mining_tunnel_42" for c in comps_vd):
        ok = False
        msgs.append("[FAIL] view_default.components 缺少 comp_mining_tunnel_42")
    # 4) reflow 值：41/42 在 editor_components；40 仅存在于 views/layout（隧道怪癖，bridge 同构）
    by_id = {c.get("id"): c for c in ec} if isinstance(ec, list) else {}
    for cid, (y, h) in [
        ("comp_mining_tunnel_41", (670, 1190)),
        ("comp_mining_tunnel_42", (1320, 540)),
    ]:
        comp = by_id.get(cid)
        if comp is None:
            ok = False
            msgs.append(f"[FAIL] 缺少 {cid}")
            continue
        tf = comp.get("transform", {})
        if (tf.get("y"), tf.get("height")) != (y, h):
            ok = False
            msgs.append(f"[FAIL] {cid} transform {(tf.get('y'), tf.get('height'))} != {(y, h)}")
    # 40 在 view_default.components 中（隧道克隆体 40 只在 views 不在 editor_components）
    vd_comps = (vd or {}).get("components", []) if isinstance(vd, dict) else []
    c40 = next((c for c in vd_comps if c.get("id") == "comp_mining_tunnel_40"), None)
    if c40 is None:
        ok = False
        msgs.append("[FAIL] view_default.components 缺少 comp_mining_tunnel_40")
    else:
        tf = (c40 or {}).get("transform", {})
        if (tf.get("y"), tf.get("height")) != (660, 1200):
            ok = False
            msgs.append(f"[FAIL] 40 transform {(tf.get('y'), tf.get('height'))} != (660,1200)")
    # 5) layout 中 40/41 的 y/h
    for it in layout if isinstance(layout, list) else []:
        cid = it.get("componentId")
        if cid == "comp_mining_tunnel_40" and (it.get("y"), it.get("h")) != (660, 1200):
            ok = False
            msgs.append(f"[FAIL] layout 40 {(it.get('y'), it.get('h'))} != (660,1200)")
        if cid == "comp_mining_tunnel_41" and (it.get("y"), it.get("h")) != (670, 1190):
            ok = False
            msgs.append(f"[FAIL] layout 41 {(it.get('y'), it.get('h'))} != (670,1190)")
    # 6) views 中也不应含 7 张统计卡
    for v in views if isinstance(views, list) else []:
        for cc in v.get("components", []) if isinstance(v, dict) else []:
            if cc.get("id") in REMOVE:
                ok = False
                msgs.append(f"[FAIL] view {v.get('id')} 仍含统计卡 {cc.get('id')}")
    # 7) 煤机位置曲线组件 comp_mining_tunnel_43 已注入（editor_components + view_default.components）
    if "comp_mining_tunnel_43" not in ids_ec:
        ok = False
        msgs.append("[FAIL] editor_components 缺少 comp_mining_tunnel_43 煤机位置曲线")
    c43 = by_id.get("comp_mining_tunnel_43")
    if c43 is not None and c43.get("type") != "industrial-shearer-curve":
        ok = False
        msgs.append(f"[FAIL] 43 type={c43.get('type')}，应为 industrial-shearer-curve")
    if not any(c.get("id") == "comp_mining_tunnel_43" for c in comps_vd):
        ok = False
        msgs.append("[FAIL] view_default.components 缺少 comp_mining_tunnel_43")
    if ok:
        msgs.append("[OK]   关键不变量全部满足")
    return ok, msgs


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    if mode == "apply":
        apply_to_dev_db()
        # apply 后顺带做校验
    elif mode != "check":
        print(f"未知模式: {mode}（支持 apply / check）")
        return 2

    conn = sqlite3.connect(DB)
    c = conn.cursor()

    new_ec, new_views, new_layout = build_expected()

    ec_m, views_m, layout_m = c.execute(
        "SELECT editor_components, views, layout FROM scenes WHERE id='scene_spray_mining'"
    ).fetchone()
    ec_m, views_m, layout_m = json.loads(ec_m), json.loads(views_m), json.loads(layout_m)
    conn.close()

    new_views = strip_runtime_state(new_views)
    views_m = strip_runtime_state(views_m)

    ok = True
    for name, a, b in [
        ("editor_components", new_ec, ec_m),
        ("views", new_views, views_m),
        ("layout", new_layout, layout_m),
    ]:
        if a == b:
            print(f"[OK]   {name}: 等价（{len(a) if isinstance(a, list) else '?'} 项）")
        else:
            ok = False
            print(f"[FAIL] {name}: 不等价")
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

    inv_ok, inv_msgs = check_invariants(ec_m, views_m, layout_m)
    for m in inv_msgs:
        print(m)
    ok = ok and inv_ok

    if ok:
        print("\n等价 + 不变量验证通过：fresh_clone(tunnel) -> customize == data/config.db.scene_spray_mining")
        return 0
    print("\n验证失败")
    return 1


if __name__ == "__main__":
    sys.exit(main())
