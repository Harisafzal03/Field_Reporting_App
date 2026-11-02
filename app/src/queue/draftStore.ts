import AsyncStorage from '@react-native-async-storage/async-storage';
import { Attachment } from '../domain/types';

export const DRAFT_STORAGE_KEY = '@field_reports_active_draft_v1';

export interface DraftState {
  description: string;
  attachments: Attachment[];
}

class DraftStore {
  /**
   * Loads the active draft from device disk on app startup
   */
  async loadDraft(): Promise<DraftState | null> {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.description === 'string' &&
          Array.isArray(parsed.attachments)
        ) {
          return {
            description: parsed.description,
            attachments: parsed.attachments,
          };
        }
      }
    } catch (err) {
      console.warn('[DraftStore] Failed to load draft from disk:', err);
    }
    return null;
  }

  /**
   * Persists the in-progress draft to device disk so it survives app kills
   */
  async saveDraft(draft: DraftState): Promise<void> {
    try {
      if (!draft.description && (!draft.attachments || draft.attachments.length === 0)) {
        await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      }
    } catch (err) {
      console.error('[DraftStore] Failed to save draft to disk:', err);
    }
  }

  /**
   * Clears the draft when the report is successfully queued to outbox or reset
   */
  async clearDraft(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      console.error('[DraftStore] Failed to clear draft from disk:', err);
    }
  }
}

export const draftStore = new DraftStore();
