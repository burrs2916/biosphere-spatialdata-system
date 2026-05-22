import { create } from "zustand";
import { iconsApi } from "../services/tauri";
import type { SystemIcon, IconGroup } from "../services/tauri";

interface IconStore {
  groups: IconGroup[];
  icons: SystemIcon[];
  loading: boolean;
  error: string | null;
  
  fetchAllGroups: () => Promise<void>;
  fetchGroup: (id: string) => Promise<void>;
  saveGroup: (group: IconGroup) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  
  fetchAllIcons: () => Promise<void>;
  fetchIconsByGroup: (groupId: string) => Promise<void>;
  uploadIcon: (
    groupId: string,
    file: File
  ) => Promise<string>;
  saveIcon: (icon: SystemIcon) => Promise<void>;
  deleteIcon: (id: string) => Promise<void>;
}

export const useIconStore = create<IconStore>((set, get) => ({
  groups: [],
  icons: [],
  loading: false,
  error: null,

  fetchAllGroups: async () => {
    set({ loading: true, error: null });
    try {
      const groups = await iconsApi.getAllGroups();
      set({ groups });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch groups";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to fetch all groups:", error);
    } finally {
      set({ loading: false });
    }
  },

  fetchGroup: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const group = await iconsApi.getGroup(id);
      if (group) {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? group : g)),
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch group";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to fetch group:", error);
    } finally {
      set({ loading: false });
    }
  },

  saveGroup: async (group: IconGroup) => {
    set({ loading: true, error: null });
    try {
      await iconsApi.saveGroup(group);
      await get().fetchAllGroups();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save group";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to save group:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteGroup: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await iconsApi.deleteGroup(id);
      set((state) => {
        const subGroupIds = state.groups
          .filter((g) => g.parent_id === id)
          .map((g) => g.id);
        const allDeletedGroupIds = [id, ...subGroupIds];
        return {
          groups: state.groups.filter((g) => !allDeletedGroupIds.includes(g.id)),
          icons: state.icons.filter((i) => !allDeletedGroupIds.includes(i.group_id)),
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete group";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to delete group:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchAllIcons: async () => {
    set({ loading: true, error: null });
    try {
      const icons = await iconsApi.getAllIcons();
      set({ icons });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch icons";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to fetch all icons:", error);
    } finally {
      set({ loading: false });
    }
  },

  fetchIconsByGroup: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      const icons = await iconsApi.getIconsByGroup(groupId);
      set({ icons });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch icons";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to fetch icons by group:", error);
    } finally {
      set({ loading: false });
    }
  },

  uploadIcon: async (
    groupId: string,
    file: File
  ): Promise<string> => {
    set({ loading: true, error: null });
    try {
      const fileData = await file.arrayBuffer();
      const uint8Array = new Uint8Array(fileData);
      const iconId = await iconsApi.uploadIcon(
        groupId,
        uint8Array,
        file.name
      );
      
      await get().fetchAllIcons();
      return iconId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload icon";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to upload icon:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  saveIcon: async (icon: SystemIcon) => {
    set({ loading: true, error: null });
    try {
      await iconsApi.saveIcon(icon);
      set((state) => ({
        icons: state.icons.map((i) => (i.id === icon.id ? icon : i)),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save icon";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to save icon:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteIcon: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await iconsApi.deleteIcon(id);
      set((state) => ({
        icons: state.icons.filter((icon) => icon.id !== id),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete icon";
      set({ error: errorMessage });
      console.error("[IconStore] Failed to delete icon:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
}));
