import { useState } from 'react';
import type { Formality, Item, Warmth } from '@/core/model/types';
import { Button } from '@/ui/Button';
import { Rating5, type Rating } from '@/ui/Rating5';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';

export interface ItemEdits {
  name: string | undefined;
  formality: Formality;
  warmth: Warmth;
}

interface EditItemSheetProps {
  item: Item;
  visible: boolean;
  onClose: () => void;
  onSave: (edits: ItemEdits) => void;
}

export function EditItemSheet({ item, visible, onClose, onSave }: EditItemSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Edit item" testID="item-edit-sheet">
      {visible ? <EditForm item={item} onSave={onSave} /> : null}
    </Sheet>
  );
}

/** Mounted only while the sheet is open, so the draft restarts from the item each time. */
function EditForm({ item, onSave }: Pick<EditItemSheetProps, 'item' | 'onSave'>) {
  const [name, setName] = useState(item.name ?? '');
  const [formality, setFormality] = useState<Rating>(item.formality);
  const [warmth, setWarmth] = useState<Rating>(item.warmth);
  return (
    <>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Navy work shirt"
        testID="item-edit-name"
      />
      <Rating5
        label="Formality"
        value={formality}
        onChange={setFormality}
        lowLabel="Lounge"
        highLabel="Formal"
        testID="item-edit-formality"
      />
      <Rating5
        label="Warmth"
        value={warmth}
        onChange={setWarmth}
        lowLabel="Summer-light"
        highLabel="Deep winter"
        testID="item-edit-warmth"
      />
      <Button
        label="Save"
        onPress={() => onSave({ name: name.trim() || undefined, formality, warmth })}
        testID="item-edit-save"
      />
    </>
  );
}
