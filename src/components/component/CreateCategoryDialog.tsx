import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { useComponentStore } from "../../store/componentStore";
import { IconPicker } from "./IconPicker";

interface CreateCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  categoryCount: number;
}

export function CreateCategoryDialog({ open, onClose, categoryCount }: CreateCategoryDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("folder");
  const [saving, setSaving] = useState(false);
  const createCategory = useComponentStore((s) => s.createCategory);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCategory({
        name: name.trim(),
        icon,
        color: "#90CAF9",
        sortOrder: categoryCount,
      });
      setName("");
      setIcon("folder");
      onClose();
    } catch (err) {
      console.error("[CreateCategory] Failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 13, pb: 1 }}>创建组件组</DialogTitle>
      <DialogContent sx={{ pt: "8px !important" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <TextField
            size="small"
            label="组名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            sx={{ "& .MuiInputBase-input": { fontSize: 12 } }}
          />
          <IconPicker value={icon} onChange={setIcon} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button size="small" onClick={onClose} sx={{ fontSize: 11, textTransform: "none" }}>
          取消
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!name.trim() || saving}
          onClick={handleSave}
          sx={{ fontSize: 11, textTransform: "none" }}
        >
          创建
        </Button>
      </DialogActions>
    </Dialog>
  );
}
