import AsyncStorage from '@react-native-async-storage/async-storage';
import { DRAFT_STORAGE_KEY, draftStore, DraftState } from '../src/queue/draftStore';

describe('DraftStore - In-Progress Compose Draft Survival Across App Kills', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__resetStore();
    jest.clearAllMocks();
    await draftStore.clearDraft();
  });

  it('saves active draft text and attachments to disk', async () => {
    const draft: DraftState = {
      description: 'Found transformer oil leak under radiator bank 2',
      attachments: [
        {
          id: 'att_draft_1',
          uri: 'file:///data/user/0/com.fieldreports/cache/leak1.jpg',
          fileName: 'leak1.jpg',
          fileSizeBytes: 1.4 * 1024 * 1024,
        },
      ],
    };

    await draftStore.saveDraft(draft);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      DRAFT_STORAGE_KEY,
      expect.stringContaining('Found transformer oil leak'),
    );
  });

  it('hydrates in-progress draft from disk when app is reopened after being killed', async () => {
    const savedDraft: DraftState = {
      description: 'Partially entered notes before OS killed the app process',
      attachments: [
        {
          id: 'att_draft_2',
          uri: 'file:///data/user/0/com.fieldreports/cache/reopen.jpg',
          fileName: 'reopen.jpg',
          fileSizeBytes: 800000,
        },
      ],
    };

    await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(savedDraft));

    const loaded = await draftStore.loadDraft();
    expect(loaded).not.toBeNull();
    expect(loaded?.description).toBe('Partially entered notes before OS killed the app process');
    expect(loaded?.attachments).toHaveLength(1);
    expect(loaded?.attachments[0].fileName).toBe('reopen.jpg');
  });

  it('removes draft from disk when cleared upon queuing report', async () => {
    await draftStore.saveDraft({
      description: 'Some text',
      attachments: [],
    });

    await draftStore.clearDraft();

    const loaded = await draftStore.loadDraft();
    expect(loaded).toBeNull();
  });
});
