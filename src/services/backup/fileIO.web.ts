import type { PickedFile } from './fileIO';

export type { PickedFile } from './fileIO';

/** Downloads `blob` through a temporary `<a download>`. */
export async function saveBlob(filename: string, blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Give the browser time to start the download before the URL goes away.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** Opens the file picker through a hidden `<input type=file>`; `null` when cancelled. */
export function pickFile(accept: string): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.setAttribute('data-testid', 'backup-file-input');
    const done = (file: PickedFile | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      done(file ? { name: file.name, size: file.size, text: () => file.text() } : null);
    });
    input.addEventListener('cancel', () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}
