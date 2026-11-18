import type { Entity, Feedback, Item, Outfit, Profile, WearLog } from '@/core/model/types';
import { createImageStore } from './images';
import { createAsyncStorageKv, createRepository } from './storage';
import { createSystemClock, createIdGenerator } from './system';
import {
  createFixedClock,
  createMemoryImageStore,
  createMemoryKv,
  createSequentialIds,
} from './testing';
import type { Clock, IdGenerator, ImageStore, KeyValueStore, Repository } from './types';

export type { Clock, IdGenerator, ImageStore, KeyValueStore, Repository } from './types';

export interface Services {
  items: Repository<Item>;
  outfits: Repository<Outfit>;
  wearLogs: Repository<WearLog>;
  feedback: Repository<Feedback>;
  profile: Repository<Profile>;
  images: ImageStore;
  clock: Clock;
  ids: IdGenerator;
}

export interface ServicesOptions {
  onStorageError?: (error: unknown, context: { collection: string; key: string }) => void;
}

function build(
  kv: KeyValueStore,
  images: ImageStore,
  clock: Clock,
  ids: IdGenerator,
  onError: ServicesOptions['onStorageError'],
): Services {
  const repo = <T extends Entity>(name: string) =>
    createRepository<T>(kv, name, { clock, onError });
  return {
    items: repo<Item>('items'),
    outfits: repo<Outfit>('outfits'),
    wearLogs: repo<WearLog>('wearLogs'),
    feedback: repo<Feedback>('feedback'),
    profile: repo<Profile>('profile'),
    images,
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
    overrides.clock ?? createFixedClock(),
    ids,
    undefined,
  );
}
