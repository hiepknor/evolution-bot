import { create } from 'zustand';
import dayjs from 'dayjs';
import type { Campaign, ComposerState, EmojiMode } from '@/lib/types/domain';
import { normalizeImagePath } from '@/lib/media/image-path';

const initialState: ComposerState = {
  imagePath: undefined,
  imageName: undefined,
  captionTemplate: '',
  introText: '',
  titleText: '',
  footerText: '',
  plainTextFallback: '',
  emojiMode: 'low',
  recentFiles: []
};

const COMPOSER_DRAFT_STORAGE_KEY = 'broadcast-bot:composer-draft:v1';

const loadDraft = (): Partial<ComposerState> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(COMPOSER_DRAFT_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Partial<ComposerState>;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return {
      imagePath: typeof parsed.imagePath === 'string' ? normalizeImagePath(parsed.imagePath) : undefined,
      imageName: typeof parsed.imageName === 'string' ? parsed.imageName : undefined,
      captionTemplate: typeof parsed.captionTemplate === 'string' ? parsed.captionTemplate : '',
      introText: typeof parsed.introText === 'string' ? parsed.introText : '',
      titleText: typeof parsed.titleText === 'string' ? parsed.titleText : '',
      footerText: typeof parsed.footerText === 'string' ? parsed.footerText : '',
      plainTextFallback: typeof parsed.plainTextFallback === 'string' ? parsed.plainTextFallback : '',
      emojiMode:
        parsed.emojiMode === 'none' ||
        parsed.emojiMode === 'low' ||
        parsed.emojiMode === 'medium' ||
        parsed.emojiMode === 'high'
          ? parsed.emojiMode
          : 'low',
      recentFiles: Array.isArray(parsed.recentFiles)
        ? parsed.recentFiles.filter((item): item is string => typeof item === 'string').slice(0, 8)
        : []
    };
  } catch {
    return {};
  }
};

const persistDraft = (state: ComposerState): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(COMPOSER_DRAFT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors to avoid breaking UI interactions.
  }
};

const clearPersistedDraft = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(COMPOSER_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage errors to avoid breaking UI interactions.
  }
};

type ContentSource = {
  campaignId: string;
  campaignName: string;
  loadedAt: string;
};

const mergeDraftState = (
  current: ComposerState,
  patch: Partial<ComposerState>
): ComposerState => ({
  imagePath: Object.prototype.hasOwnProperty.call(patch, 'imagePath') ? patch.imagePath : current.imagePath,
  imageName: Object.prototype.hasOwnProperty.call(patch, 'imageName') ? patch.imageName : current.imageName,
  captionTemplate: Object.prototype.hasOwnProperty.call(patch, 'captionTemplate')
    ? patch.captionTemplate ?? ''
    : current.captionTemplate,
  introText: Object.prototype.hasOwnProperty.call(patch, 'introText')
    ? patch.introText ?? ''
    : current.introText,
  titleText: Object.prototype.hasOwnProperty.call(patch, 'titleText')
    ? patch.titleText ?? ''
    : current.titleText,
  footerText: Object.prototype.hasOwnProperty.call(patch, 'footerText')
    ? patch.footerText ?? ''
    : current.footerText,
  plainTextFallback: Object.prototype.hasOwnProperty.call(patch, 'plainTextFallback')
    ? patch.plainTextFallback ?? ''
    : current.plainTextFallback,
  emojiMode: Object.prototype.hasOwnProperty.call(patch, 'emojiMode')
    ? patch.emojiMode ?? current.emojiMode
    : current.emojiMode,
  recentFiles: Object.prototype.hasOwnProperty.call(patch, 'recentFiles')
    ? patch.recentFiles ?? []
    : current.recentFiles
});

const nextContentSource = <T>(
  currentValue: T,
  nextValue: T,
  contentSource: ContentSource | null
): ContentSource | null => (
  contentSource && currentValue !== nextValue ? null : contentSource
);

interface ComposerStore extends ComposerState {
  contentSource: ContentSource | null;
  setImage: (
    path?: string,
    options?: {
      displayName?: string;
      recentSourcePath?: string;
    }
  ) => void;
  setCaptionTemplate: (text: string) => void;
  setIntroText: (text: string) => void;
  setTitleText: (text: string) => void;
  setFooterText: (text: string) => void;
  setPlainTextFallback: (text: string) => void;
  setEmojiMode: (mode: EmojiMode) => void;
  applyCampaignContent: (campaign: Campaign) => void;
  clearContentSource: () => void;
  removeRecentFile: (path: string) => void;
  removeRecentFiles: (paths: string[]) => void;
  reset: () => void;
  clearDraft: () => void;
}

export const useComposerStore = create<ComposerStore>((set, get) => ({
  ...initialState,
  ...loadDraft(),
  contentSource: null,

  setImage: (path, options) => {
    const current = get();
    const normalizedPath = normalizeImagePath(path);
    const imageName = normalizedPath
      ? options?.displayName ?? normalizedPath.split(/[\\/]/).pop()
      : undefined;
    const recentSourcePath = normalizeImagePath(options?.recentSourcePath);
    const recentPath = recentSourcePath ?? normalizedPath;
    const recentFiles = recentPath
      ? [recentPath, ...current.recentFiles.filter((item) => item !== recentPath)].slice(0, 8)
      : current.recentFiles;
    const contentSource = nextContentSource(current.imagePath, normalizedPath, current.contentSource);

    set({ imagePath: normalizedPath, imageName, recentFiles, contentSource });
    persistDraft(
      mergeDraftState(current, {
        imagePath: normalizedPath,
        imageName,
        recentFiles
      })
    );
  },

  setCaptionTemplate: (captionTemplate) => {
    const current = get();
    const contentSource = nextContentSource(
      current.captionTemplate,
      captionTemplate,
      current.contentSource
    );
    set({ captionTemplate, contentSource });
    persistDraft(mergeDraftState(current, { captionTemplate }));
  },
  setIntroText: (introText) => {
    const current = get();
    const contentSource = nextContentSource(current.introText, introText, current.contentSource);
    set({ introText, contentSource });
    persistDraft(mergeDraftState(current, { introText }));
  },
  setTitleText: (titleText) => {
    const current = get();
    const contentSource = nextContentSource(current.titleText, titleText, current.contentSource);
    set({ titleText, contentSource });
    persistDraft(mergeDraftState(current, { titleText }));
  },
  setFooterText: (footerText) => {
    const current = get();
    const contentSource = nextContentSource(current.footerText, footerText, current.contentSource);
    set({ footerText, contentSource });
    persistDraft(mergeDraftState(current, { footerText }));
  },
  setPlainTextFallback: (plainTextFallback) => {
    const current = get();
    const contentSource = nextContentSource(
      current.plainTextFallback,
      plainTextFallback,
      current.contentSource
    );
    set({ plainTextFallback, contentSource });
    persistDraft(mergeDraftState(current, { plainTextFallback }));
  },
  setEmojiMode: (emojiMode) => {
    const current = get();
    const contentSource = nextContentSource(current.emojiMode, emojiMode, current.contentSource);
    set({ emojiMode, contentSource });
    persistDraft(mergeDraftState(current, { emojiMode }));
  },

  applyCampaignContent: (campaign) => {
    const imagePath = normalizeImagePath(campaign.imagePath);
    const imageName = imagePath ? imagePath.split(/[\\/]/).pop() : undefined;
    const recentFiles = imagePath
      ? [imagePath, ...get().recentFiles.filter((item) => item !== imagePath)].slice(0, 8)
      : get().recentFiles;

    const nextState: ComposerState = {
      imagePath,
      imageName,
      captionTemplate: campaign.captionTemplate,
      introText: campaign.introText,
      titleText: campaign.titleText,
      footerText: campaign.footerText,
      plainTextFallback: campaign.plainTextFallback,
      emojiMode: campaign.emojiMode,
      recentFiles
    };

    set({
      ...nextState,
      contentSource: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        loadedAt: dayjs().toISOString()
      }
    });
    persistDraft(nextState);
  },

  clearContentSource: () => {
    set({ contentSource: null });
  },

  removeRecentFile: (path) => {
    const normalizedPath = normalizeImagePath(path);
    if (!normalizedPath) {
      return;
    }

    const current = get();
    const nextRecentFiles = current.recentFiles.filter((item) => item !== normalizedPath);
    if (nextRecentFiles.length === current.recentFiles.length) {
      return;
    }

    set({ recentFiles: nextRecentFiles });
    persistDraft(mergeDraftState(current, { recentFiles: nextRecentFiles }));
  },

  removeRecentFiles: (paths) => {
    const normalizedSet = new Set(
      paths
        .map((item) => normalizeImagePath(item))
        .filter((item): item is string => Boolean(item))
    );
    if (normalizedSet.size === 0) {
      return;
    }

    const current = get();
    const nextRecentFiles = current.recentFiles.filter((item) => !normalizedSet.has(item));
    if (nextRecentFiles.length === current.recentFiles.length) {
      return;
    }

    set({ recentFiles: nextRecentFiles });
    persistDraft(mergeDraftState(current, { recentFiles: nextRecentFiles }));
  },

  reset: () => {
    set({ ...initialState, contentSource: null });
    persistDraft(initialState);
  },

  clearDraft: () => {
    clearPersistedDraft();
  }
}));
