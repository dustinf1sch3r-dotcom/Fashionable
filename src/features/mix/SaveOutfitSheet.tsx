import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';

interface SaveOutfitSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the trimmed name (empty when the user left it blank). */
  onSave: (name: string) => void;
}

export function SaveOutfitSheet({ visible, onClose, onSave }: SaveOutfitSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Save outfit" testID="mix-save-sheet">
      {visible ? <SaveForm onSave={onSave} /> : null}
    </Sheet>
  );
}

/** Mounted only while the sheet is open, so the name starts empty each time. */
function SaveForm({ onSave }: Pick<SaveOutfitSheetProps, 'onSave'>) {
  const [name, setName] = useState('');
  return (
    <>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Friday drinks"
        helperText="Optional. You can rename it later."
        testID="mix-save-name"
      />
      <Button label="Save" onPress={() => onSave(name.trim())} testID="mix-save-confirm" />
    </>
  );
}
