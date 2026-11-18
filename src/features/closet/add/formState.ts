import { subcategoriesOf, subcategoryDefaults } from '@/core/model/taxonomy';
import type { NewItemInit } from '@/core/model/factories';
import type {
  Category,
  ColorName,
  ColorSwatch,
  Formality,
  Item,
  Pattern,
  Warmth,
} from '@/core/model/types';
import { withPrimaryColor } from './colors';

/** Fields the user may have changed by hand; defaults stop overwriting them. */
export type TouchableField = 'formality' | 'warmth' | 'rainOk' | 'sporty';

export interface FormState {
  category: Category;
  subcategory: string;
  colors: ColorSwatch[];
  pattern: Pattern;
  formality: Formality;
  warmth: Warmth;
  rainOk: boolean;
  sporty: boolean;
  name: string;
  touched: Readonly<Record<TouchableField, boolean>>;
}

export type FormAction =
  | { type: 'setCategory'; category: Category }
  | { type: 'setSubcategory'; subcategory: string }
  | { type: 'setPrimaryColor'; color: ColorName }
  | { type: 'setPattern'; pattern: Pattern }
  | { type: 'setFormality'; value: Formality }
  | { type: 'setWarmth'; value: Warmth }
  | { type: 'setRainOk'; value: boolean }
  | { type: 'setSporty'; value: boolean }
  | { type: 'setName'; name: string };

export type FormError = 'no-colour' | 'no-subcategory';

const UNTOUCHED: FormState['touched'] = {
  formality: false,
  warmth: false,
  rainOk: false,
  sporty: false,
};

/** The most common first garment: prefilled so the common case needs no category taps. */
const INITIAL_CATEGORY: Category = 'top';
const INITIAL_SUBCATEGORY = 'tshirt';

/** Applies taxonomy defaults to every field the user has not changed themselves. */
function applyDefaults(state: FormState): FormState {
  const defaults = subcategoryDefaults(state.category, state.subcategory);
  if (!defaults) return state;
  const { touched } = state;
  return {
    ...state,
    formality: touched.formality ? state.formality : defaults.formality,
    warmth: touched.warmth ? state.warmth : defaults.warmth,
    rainOk: touched.rainOk ? state.rainOk : defaults.rainOk,
    sporty: touched.sporty ? state.sporty : defaults.sporty,
  };
}

export function initialFormState(detected: readonly ColorSwatch[]): FormState {
  return applyDefaults({
    category: INITIAL_CATEGORY,
    subcategory: INITIAL_SUBCATEGORY,
    colors: [...detected],
    pattern: 'solid',
    formality: 2,
    warmth: 1,
    rainOk: true,
    sporty: false,
    name: '',
    touched: UNTOUCHED,
  });
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'setCategory': {
      if (action.category === state.category) return state;
      const [first] = subcategoriesOf(action.category);
      return applyDefaults({ ...state, category: action.category, subcategory: first });
    }
    case 'setSubcategory':
      return applyDefaults({ ...state, subcategory: action.subcategory });
    case 'setPrimaryColor':
      return { ...state, colors: withPrimaryColor(state.colors, action.color) };
    case 'setPattern':
      return { ...state, pattern: action.pattern };
    case 'setFormality':
      return { ...state, formality: action.value, touched: { ...state.touched, formality: true } };
    case 'setWarmth':
      return { ...state, warmth: action.value, touched: { ...state.touched, warmth: true } };
    case 'setRainOk':
      return { ...state, rainOk: action.value, touched: { ...state.touched, rainOk: true } };
    case 'setSporty':
      return { ...state, sporty: action.value, touched: { ...state.touched, sporty: true } };
    case 'setName':
      return { ...state, name: action.name };
  }
}

export function validateForm(state: FormState): FormError[] {
  const errors: FormError[] = [];
  if (state.colors.length === 0) errors.push('no-colour');
  if (!subcategoryDefaults(state.category, state.subcategory)) errors.push('no-subcategory');
  return errors;
}

/** Builds the `addItem` input. Call only when `validateForm` returns no errors. */
export function toNewItemInit(
  state: FormState,
  images: Item['images'],
  cutout: Item['cutout'],
): NewItemInit {
  const name = state.name.trim();
  return {
    category: state.category,
    subcategory: state.subcategory,
    colors: state.colors,
    images,
    cutout,
    pattern: state.pattern,
    formality: state.formality,
    warmth: state.warmth,
    rainOk: state.rainOk,
    sporty: state.sporty,
    ...(name ? { name } : {}),
  };
}
