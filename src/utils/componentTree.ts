import type { ComponentCategory, ComponentCategoryNode, ComponentPluginItem } from "../types/component";

export function buildCategoryTree(
  categories: ComponentCategory[],
  plugins: ComponentPluginItem[]
): ComponentCategoryNode[] {
  const nodeMap = new Map<string, ComponentCategoryNode>();

  for (const cat of categories) {
    nodeMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      sortOrder: cat.sortOrder ?? 0,
      parentId: cat.parentId ?? undefined,
      description: cat.description,
      children: [],
      plugins: [],
    });
  }

  for (const plugin of plugins) {
    let catId = plugin.category;
    let node = nodeMap.get(catId);
    if (!node && !catId.startsWith("ccat_")) {
      catId = `ccat_${catId}`;
      node = nodeMap.get(catId);
    }
    if (node) {
      node.plugins.push(plugin);
    } else {
      const fallback = nodeMap.get("ccat_custom");
      if (fallback) fallback.plugins.push(plugin);
    }
  }

  const roots: ComponentCategoryNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: ComponentCategoryNode[]): ComponentCategoryNode[] => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const n of nodes) sortNodes(n.children);
    return nodes;
  };

  return sortNodes(roots);
}

export function collectPluginTypes(node: ComponentCategoryNode): Set<string> {
  const types = new Set<string>();
  const walk = (n: ComponentCategoryNode) => {
    n.plugins.forEach((p) => types.add(p.type));
    n.children.forEach(walk);
  };
  walk(node);
  return types;
}

export function countAllPlugins(node: ComponentCategoryNode): number {
  let count = node.plugins.length;
  for (const child of node.children) {
    count += countAllPlugins(child);
  }
  return count;
}
