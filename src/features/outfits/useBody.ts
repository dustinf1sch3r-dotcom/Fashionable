import { BODY_A, getBody } from '@/core/tryon/bodies';
import type { BodyTemplate } from '@/core/model/types';
import { useProfile } from '@/state';

/** The mannequin body chosen in the profile (default body until the profile has loaded). */
export function useBody(): BodyTemplate {
  const id = useProfile((s) => s.profile?.bodyTemplateId);
  return (id ? getBody(id) : undefined) ?? BODY_A;
}
