import { isFeedback, isItem, isOutfit, isProfile, isWearLog } from '@/core/model/validate';
import type { Entity, Feedback, Item, Outfit, Profile, WearLog } from '@/core/model/types';
import { createImageStore } from './images';
import { createPixelReader } from './pixels';
import { createAsyncStorageKv, createRepository } from './storage';
import { createSystemClock, createIdGenerator } from './system';
import {
  createFakePixelReader,
  createFixedClock,
  createMemoryImageStore,
  createMemoryKv,
  createSequentialIds,
} from './testing';
import type {
  Clock,
  IdGenerator,
  ImageStore,
  KeyValueStore,
  PixelReader,
  Repository,
} from './types';

export type {
  Clock,
  IdGenerator,
  ImageStore,
  KeyValueStore,
  PixelData,
  PixelReader,
  Repository,
} from './types';

export interface Services {
  items: Repository<Item>;
  outfits: Repository<Outfit>;
  wearLogs: Repository<WearLog>;
  feedback: Repository<Feedback>;
  profile: Repository<Profile>;
  images: ImageStore;
  pixels: PixelReader;
  clock: Clock;
  ids: IdGenerator;
}

export interface ServicesOptions {
  onStorageError?: (error: unknown, context: { collection: string; key: string }) => void;
}

function build(
  kv: KeyValueStore,
  images: ImageStore,
  pixels: PixelReader,
  clock: Clock,
  ids: IdGenerator,
  onError: ServicesOptions['onStorageError'],
): Services {
  const repo = <T extends Entity>(name: string, validate: (v: unknown) => v is T) =>
    createRepository<T>(kv, name, { clock, onError, validate });
  return {
    items: repo<Item>('items', isItem),
    outfits: repo<Outfit>('outfits', isOutfit),
    wearLogs: repo<WearLog>('wearLogs', isWearLog),
    feedback: repo<Feedback>('feedback', isFeedback),
    profile: repo<Profile>('profile', isProfile),
    images,
    pixels,
    clock,
    ids,
  };
}

/** Real services: AsyncStorage records, platform image store, system clock and UUIDs. */
export function createServices(options: ServicesOptions = {}): Services {
  const ids = createIdGenerator();
  return build(
    createAsyncStorageKv(),
    createImageStore({ ids }),
    createPixelReader(),
    createSystemClock(),
    ids,
    options.onStorageError,
  );
}

/** In-memory, deterministic services for tests. */
export function createTestServices(
  overrides: Partial<Pick<Services, 'clock' | 'ids'>> = {},
): Services {
  const ids = overrides.ids ?? createSequentialIds();
  return build(
    createMemoryKv(),
    createMemoryImageStore(ids),
    createFakePixelReader(),
    overrides.clock ?? createFixedClock(),
    ids,
    undefined,
  );
}

let singleton: Services | undefined;

/** The app's real services, created on first use. Features use this for images and pixels. */
export function getServices(): Services {
  singleton ??= createServices();
  return singleton;
}
