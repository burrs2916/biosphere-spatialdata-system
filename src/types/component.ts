export interface ComponentPluginItem {
  id: string;
  type: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  category: string;
  builtIn: boolean;
  enabled: boolean;
  author?: string;
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
