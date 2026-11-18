import type { ID } from '@/core/model/types';
import type { IdGenerator } from '../types';

export interface ImageStoreDeps {
  ids?: IdGenerator;
}

export const resolveImageId = (ids: IdGenerator, id?: ID): ID => id ?? ids.uuid();

export const isUriSource = (source: { uri: string } | Blob): source is { uri: string } =>
  'uri' in source && typeof source.uri === 'string';
