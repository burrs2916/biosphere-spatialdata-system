// 自定义图标渲染：将 "custom-{id}" 转换为 <img>，统一缓存 iconFileUrls
import React, { useEffect, useState } from "react";
import { iconsApi } from "../../services/tauri";

let cachedUrls: Record<string, string> | null = null;
let pendingPromise: Promise<Record<string, string>> | null = null;
const subscribers = new Set<(urls: Record<string, string>) => void>();

async function loadIconUrls(): Promise<Record<string, string>> {
  if (cachedUrls) return cachedUrls;
  if (pendingPromise) return pendingPromise;
  pendingPromise = iconsApi.getIconFileUrls().then((urls) => {
    cachedUrls = urls;
    pendingPromise = null;
    subscribers.forEach((cb) => cb(urls));
    return urls;
  }).catch((err) => {
    pendingPromise = null;
    throw err;
  });
  return pendingPromise;
}

/** 强制刷新缓存（自定义图标变更时调用） */
export function invalidateCustomIconCache() {
  cachedUrls = null;
  pendingPromise = null;
}

/** 判断 icon 字符串是否是自定义图标格式 */
export function isCustomIcon(icon: string | null | undefined): boolean {
  return !!icon && icon.startsWith("custom-");
}

/** 同步从缓存读取 URL（如果未缓存返回 null） */
export function getCustomIconUrlSync(icon: string): string | null {
  if (!cachedUrls) return null;
  const id = icon.replace(/^custom-/, "");
  return cachedUrls[id] || null;
}

interface CustomIconImgProps {
  icon: string; // "custom-{id}"
  size?: number;
  fallback?: React.ReactElement;
}

/** 自定义图标渲染组件：自动加载 iconFileUrls 缓存 */
export function CustomIconImg({ icon, size = 16, fallback }: CustomIconImgProps) {
  const [url, setUrl] = useState<string | null>(() => getCustomIconUrlSync(icon));

  useEffect(() => {
    let mounted = true;
    if (!url) {
      loadIconUrls().then((urls) => {
        if (!mounted) return;
        const id = icon.replace(/^custom-/, "");
        setUrl(urls[id] || null);
      }).catch(() => {});
    }
    const cb = (urls: Record<string, string>) => {
      const id = icon.replace(/^custom-/, "");
      setUrl(urls[id] || null);
    };
    subscribers.add(cb);
    return () => {
      mounted = false;
      subscribers.delete(cb);
    };
  }, [icon, url]);

  if (!url) return fallback || null;
  return (
    <img
      src={url}
      alt=""
      style={{ maxWidth: size, maxHeight: size, objectFit: "contain", display: "block" }}
    />
  );
}
