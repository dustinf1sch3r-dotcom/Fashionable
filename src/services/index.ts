import { isFeedback, isItem, isOutfit, isProfile, isWearLog } from '@/core/model/validate';
import type { Entity, Feedback, Item, Outfit, Profile, WearLog } from '@/core/model/types';
import { createImageStore } from './images';
import { createBackgroundRemover } from './cutout';
import { createPixelReader, createTouchupOpener } from './pixels';
import { createAsyncStorageKv, createRepository } from './storage';
import { createLocationService } from './location';
import { createBodyPhotoCropper, createPoseDetector } from './pose';
import { createGarmentWarper } from './fit';
import { createOpenMeteoProvider } from './weather';
import { createSystemClock, createIdGenerator } from './system';
import {
  createFakeBackgroundRemover,
  createFakeBodyPhotoCropper,
  createFakeGarmentWarper,
  createFakePoseDetector,
  createFakeLocationService,
  createFakePixelReader,
  createFakeTouchupOpener,
  createFakeWeatherProvider,
  createFixedClock,
  createMemoryImageStore,
  createMemoryKv,
  createSequentialIds,
} from './testing';
import type {
  BackgroundRemover,
  BodyPhotoCropper,
  Clock,
  GarmentWarper,
  IdGenerator,
  ImageStore,
  KeyValueStore,
  LocationService,
  PixelReader,
  PoseDetector,
  Repository,
  TouchupOpener,
  WeatherProvider,
} from './types';

export type {
  BackgroundRemover,
  BodyPhotoCropper,
  Clock,
  CutoutResult,
  GarmentWarper,
  IdGenerator,
  ImageStore,
  KeyValueStore,
  GeocodeResult,
  LocationService,
  PixelData,
  PixelReader,
  PoseDetector,
  PositionResult,
  Repository,
  TouchupImage,
  TouchupOpener,
  TouchupResult,
  TouchupSession,
  WeatherProvider,
} from './types';

export interface Services {
  items: Repository<Item>;
  outfits: Repository<Outfit>;
  wearLogs: Repository<WearLog>;
  feedback: Repository<Feedback>;
  profile: Repository<Profile>;
  images: ImageStore;
  pixels: PixelReader;
  touchup: TouchupOpener;
  cutout: BackgroundRemover;
  pose: PoseDetector;
  bodyCrop: BodyPhotoCropper;
  warper: GarmentWarper;
  weather: WeatherProvider;
  location: LocationService;
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
  touchup: TouchupOpener,
  cutout: BackgroundRemover,
  pose: PoseDetector,
  bodyCrop: BodyPhotoCropper,
  warper: GarmentWarper,
  weather: WeatherProvider,
  location: LocationService,
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
    touchup,
    cutout,
    pose,
    bodyCrop,
    warper,
    weather,
    location,
    clock,
    ids,
  };
}

/** Real services: AsyncStorage records, platform image store, system clock and UUIDs. */
export function createServices(options: ServicesOptions = {}): Services {
  const ids = createIdGenerator();
  const kv = createAsyncStorageKv();
  const clock = createSystemClock();
  return build(
    kv,
    createImageStore({ ids }),
    createPixelReader(),
    createTouchupOpener(),
    createBackgroundRemover(),
    createPoseDetector(),
    createBodyPhotoCropper(),
    createGarmentWarper(),
    createOpenMeteoProvider({ kv, clock }),
    createLocationService(),
    clock,
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
    createFakeTouchupOpener(),
    createFakeBackgroundRemover(),
    createFakePoseDetector(),
    createFakeBodyPhotoCropper(),
    createFakeGarmentWarper(),
    createFakeWeatherProvider(),
    createFakeLocationService(),
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
