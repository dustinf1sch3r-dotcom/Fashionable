import { BackupError } from './errors';
import { pickFile, saveBlob } from './fileIO.native';

describe('native file IO stub', () => {
  it('says plainly that it is not supported yet', async () => {
    await expect(saveBlob('x.json', new Blob(['x']))).rejects.toMatchObject({
      code: 'unsupported',
    });
    await expect(pickFile('application/json')).rejects.toBeInstanceOf(BackupError);
  });
});
