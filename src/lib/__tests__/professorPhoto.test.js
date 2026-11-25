import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/storage', () => ({
  ref: vi.fn((storage, path) => ({ path })),
  uploadBytes: vi.fn(async () => {}),
  getDownloadURL: vi.fn(async (r) => `https://download/${r.path}`),
  deleteObject: vi.fn(async (r) => {
    if (r.path.includes('sumiu')) throw Object.assign(new Error('x'), { code: 'storage/object-not-found' });
    if (r.path.includes('falha')) throw Object.assign(new Error('x'), { code: 'storage/unauthorized' });
  }),
}));

const { professorPhotoPath, uploadProfessorPhoto, deleteProfessorPhoto } = await import('../professorPhoto.js');

describe('foto do professor', () => {
  it('mora no caminho do professor, dentro da academia', () => {
    expect(professorPhotoPath('stronix', 'P1')).toBe('tenants/stronix/professores/P1/avatar.jpg');
    expect(() => professorPhotoPath('stronix', 'a/b')).toThrow();
    expect(() => professorPhotoPath('stronix', '')).toThrow();
    expect(() => professorPhotoPath('', 'P1')).toThrow();
  });

  it('envia e devolve o link de download e o caminho', async () => {
    expect(await uploadProfessorPhoto({}, 'stronix', 'P1', new Blob())).toEqual({
      url: 'https://download/tenants/stronix/professores/P1/avatar.jpg',
      path: 'tenants/stronix/professores/P1/avatar.jpg',
    });
  });

  it('apagar tolera o arquivo que já sumiu e repassa outro erro', async () => {
    await expect(deleteProfessorPhoto({}, 'tenants/x/professores/sumiu/avatar.jpg')).resolves.toBeUndefined();
    await expect(deleteProfessorPhoto({}, null)).resolves.toBeUndefined();
    await expect(deleteProfessorPhoto({}, 'tenants/x/professores/falha/avatar.jpg')).rejects.toThrow();
  });
});
