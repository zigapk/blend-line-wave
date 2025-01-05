import { TOptionsBase } from 'i18next';
import { $Dictionary } from 'node_modules/i18next/typescript/helpers';
import {
  useTranslation as _useTranslation,
  Trans as OriginalTrans,
} from 'react-i18next';

export const LOCALES = ['en', 'sl'];
export const defaultLocale = 'en';

// import { serverOnly$ } from 'vite-env-only/macros';

import enTranslation from './locales/en';
import slTranslation from './locales/sl';

// This is the list of languages your application supports, the last one is your
// fallback language
export const supportedLngs = LOCALES;

// This is the language you want to use in case
// the user language is not in the supportedLngs
export const fallbackLng = 'en';

// The default namespace of i18next is "translation", but you can customize it
export const defaultNS = 'translation';

export const resources = {
  en: { translation: enTranslation },
  sl: { translation: slTranslation },
};

type KeysUnion<T, Cache extends string = ''> = T extends PropertyKey
  ? Cache
  : {
      [P in keyof T]: P extends string
        ? Cache extends ''
          ? KeysUnion<T[P], `${P}`>
          : Cache | KeysUnion<T[P], `${Cache}.${P}`>
        : never;
    }[keyof T];

export default function useTranslation() {
  const translation = _useTranslation();
  const t = (
    str: KeysUnion<typeof enTranslation>,
    options?: (TOptionsBase & $Dictionary) | undefined,
  ) => translation.t(str, options);

  return { ...translation, t };
}

export const Trans = ({
  i18nKey,
  ...props
}: Omit<React.ComponentProps<typeof OriginalTrans>, 'i18nKey'> & {
  i18nKey: KeysUnion<typeof enTranslation>;
}) => {
  return <OriginalTrans i18nKey={i18nKey} {...props} />;
};
