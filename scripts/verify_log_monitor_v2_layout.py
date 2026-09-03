#!/usr/bin/env python3
"""
验证：日志监控视图 V3 布局（6 个组件）= relayout_log_monitor_for_charts 函数
在 Rust 中做的全部事情。运行此脚本可"等价复刻"Rust 逻辑（Python 版），用于：

    1. 干跑检查：对当前 data/config.db 中的 view_log_monitor 计算 V3 期望布局，
       与 DB 实际坐标比对，看是否一致 / 缺什么 / 多什么 / 越界。
    2. 活库等价：跑完 Rust migration 后，应已写入 V3 期望布局，本脚本对三场景各跑一遍
       验证（无 mismatch 即 OK）。

组件集合（V3）：overview-cards / log-filter-panel / operation-log-table /
cmd-donut / result-donut / alarm-trend-stacked（旧 log-stats-cards 与
alarm-trend-chart 已删除）。

输出：6 期望组件 / DB 实际组件 / mismatch 列表 / 越界检查 / 重叠检查 / 填满检查
退出码：0=全部 PASS，1=失败。

用法：
    python3 scripts/verify_log_monitor_v2_layout.py
"""
import json
import sqlite3
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "config.db")

# ═══════════════════════════════════════════════════════════════════
# 期望布局（与 migration.rs::log_layout_v2 (V3) 完全一致，对齐运行态 config.db）
# ═══════════════════════════════════════════════════════════════════
EXPECTED = {
    "industrial-log-overview-cards":      (  50,   20, 1280,  120),
    "industrial-log-filter-panel":        (   8,  149,  900, 2003),
    "industrial-operation-log-table":     ( 909,  279, 2923,  810),
    "industrial-operation-cmd-donut":     ( 909, 1090, 1460,  540),
    "industrial-operation-result-donut":  (2370, 1090, 1462,  540),
    "industrial-alarm-trend-stacked":     ( 909, 1631, 2923,  529),
}
CANVAS_W, CANVAS_H = 3840, 2160

SCENES = [
    "scene_spray_tunnel",
    "scene_spray_bridge",
    "scene_spray_mining",
]


def overlap(a, b):
    """两矩形是否重叠（1px 网格严格判定）。"""
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw <= bx or bx + bw <= ax or ay + ah <= by or by + bh <= ay)


def main():
    if not os.path.exists(DB):
        print(f"❌ DB not found: {DB}")
        return 1
    con = sqlite3.connect(DB)
    cur = con.cursor()
    failed = False

    for sid in SCENES:
        cur.execute("SELECT views FROM scenes WHERE id=?", (sid,))
        row = cur.fetchone()
        if not row:
            print(f"⚠️ scene {sid} missing in DB")
            failed = True
            continue
        views = json.loads(row[0])

        log_view = next((v for v in views if v.get("id") == "view_log_monitor"), None)
        if not log_view:
            print(f"❌ {sid}: view_log_monitor not found")
            failed = True
            continue
        comps = log_view.get("components", [])
        print(f"\n── {sid} ──")
        print(f"  view name           : {log_view.get('name')}")
        print(f"  total components    : {len(comps)}")

        actual = {}
        for c in comps:
            ty = c.get("type", "")
            tf = c.get("transform", {})
            x, y, w, h = tf.get("x", 0), tf.get("y", 0), tf.get("width", 0), tf.get("height", 0)
            actual[ty] = (x, y, w, h)
            print(f"  · {ty:42s} @ ({x:.0f},{y:.0f}) {w:.0f}×{h:.0f}")

        # ① 期望 vs 实际
        expected_types = set(EXPECTED.keys())
        actual_types = set(actual.keys())
        missing = expected_types - actual_types
        extra = actual_types - expected_types
        mismatched = [t for t in expected_types & actual_types if EXPECTED[t] != actual[t]]

        if missing or extra or mismatched:
            failed = True
            print(f"  ❌ mismatches:")
            for t in sorted(missing): print(f"     missing: {t}")
            for t in sorted(extra):   print(f"     extra  : {t}")
            for t in sorted(mismatched):
                print(f"     bad    : {t} expected={EXPECTED[t]} actual={actual[t]}")

        # ② 越界
        for ty, (x, y, w, h) in actual.items():
            if x < 0 or y < 0 or x + w > CANVAS_W or y + h > CANVAS_H:
                failed = True
                print(f"  ❌ {ty} out of canvas: ({x},{y}) {w}×{h}")

        # ③ 重叠
        rects = list(actual.items())
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                t1, r1 = rects[i]
                t2, r2 = rects[j]
                if overlap(r1, r2):
                    failed = True
                    print(f"  ❌ overlap: {t1} ↔ {t2}")

        # ④ 填满校验（外 padding 8px 必守；overview 卡 x=50 居顶，不影响外框）
        all_rects = list(actual.values())
        if all_rects:
            min_x = min(r[0] for r in all_rects)
            min_y = min(r[1] for r in all_rects)
            max_x_w = max(r[0] + r[2] for r in all_rects)
            max_y_h = max(r[1] + r[3] for r in all_rects)
            # V3 外框 union：左=8(filter) 上=20(overview) 右=3832 下=2160
            if (min_x, min_y, max_x_w - min_x, max_y_h - min_y) != (8, 20, 3824, 2140):
                # 仅在组件集合正确时该报错；missing/extra 不算覆盖
                if not (missing or extra):
                    failed = True
                    union = (min_x, min_y, max_x_w - min_x, max_y_h - min_y)
                    print(f"  ❌ union bbox != (8,20,3824,2270): got {union}")
                else:
                    print(f"  (skipped union bbox check: missing/extra present)")

        if not (missing or extra or mismatched):
            print(f"  ✅ V3 layout correct (6/6 types match, no overlap, no overflow)")

    con.close()
    if failed:
        print("\n❌ FAILED")
        return 1
    print("\n✅ ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
