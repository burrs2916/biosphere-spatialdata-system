export interface ComponentPluginItem {
  id: string;
  type: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  iconOverride?: string;
  category: string;
  builtIn: boolean;
  enabled: boolean;
  author?: string;
  source?: "registry" | "db" | "merged";
}

export interface ComponentCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  parentId?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ComponentCategoryNode {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  parentId?: string;
  description?: string;
  children: ComponentCategoryNode[];
  plugins: ComponentPluginItem[];
}

export const DEFAULT_COMPONENT_CATEGORY_ID = "ccat_custom";

/** 内置分组 ID 集合，不可删除 */
export const BUILTIN_CATEGORY_IDS = new Set([
  "ccat_basic",
  "ccat_chart",
  "ccat_map",
  "ccat_media",
  "ccat_decoration",
  "ccat_decoration_title",
  "ccat_datav",
  "ccat_device",
]);

export const DEFAULT_COMPONENT_CATEGORY: ComponentCategory = {
  id: DEFAULT_COMPONENT_CATEGORY_ID,
  name: "自定义",
  icon: "extension",
  color: "#90CAF9",
  sortOrder: 99,
  description: "自定义组件分类",
  createdAt: 0,
  updatedAt: 0,
};
