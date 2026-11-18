import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';

interface RenameSheetProps {
  visible: boolean;
  /** The current custom name ('' when the outfit uses its automatic name). */
  initialName: string;
  placeholder: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

/** The form lives inside the sheet, so it starts from the current name every time it opens. */
function RenameForm({
  initialName,
  placeholder,
  onSave,
}: Omit<RenameSheetProps, 'visible' | 'onClose'>) {
  const [text, setText] = useState(initialName);
  return (
    <>
      <TextField
        label="Name"
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        helperText="Leave it empty to use the automatic name."
        testID="outfit-rename-input"
      />
      <Button label="Save name" onPress={() => onSave(text.trim())} testID="outfit-rename-save" />
    </>
  );
}

export function RenameSheet({
  visible,
  initialName,
  placeholder,
  onClose,
  onSave,
}: RenameSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Rename outfit" testID="outfit-rename-sheet">
      {visible ? (
        <RenameForm initialName={initialName} placeholder={placeholder} onSave={onSave} />
      ) : null}
    </Sheet>
  );
}
