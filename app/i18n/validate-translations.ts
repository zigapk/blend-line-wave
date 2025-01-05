/* eslint-disable @typescript-eslint/no-var-requires */
// Simple script to validate translations
// Usage: pnpm i18n
import { readdirSync } from 'fs';
import path from 'path';

import { pathToFileURL } from 'url';
import { defaultLocale, LOCALES } from './i18n';

const localesFolder = './app/i18n/locales';

const getLocalePath = (locale: string) => path.join(localesFolder, locale);

/**
 * Recursively get all `.ts` files in a directory.
 */
const getFilesRecursively = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });

  const files = entries
    .filter((file) => !file.isDirectory() && file.name.endsWith('.ts'))
    .map((file) => path.join(directory, file.name));

  const folders = entries.filter((folder) => folder.isDirectory());

  for (const folder of folders) {
    files.push(...getFilesRecursively(path.join(directory, folder.name)));
  }

  return files;
};

/**
 * Deep diff between keys of two objects.
 * @param  {Object} obj1 Object compared
 * @param  {Object} obj2 Object to compare with
 * @return Return a three element array with:
 * - the keys present in obj1 but not in obj2
 * - the keys present in obj2 but not in obj1
 * - keys where the type of value is invalid (different from obj1 to obj2 or not string or object)
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const deepKeysDiff = (
  /* eslint-disable @typescript-eslint/no-explicit-any */
  obj1: any,
  obj2: any,
): { missingKeys: string[]; extraKeys: string[]; invalidTypes: string[] } => {
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    console.error(
      `Both arguments must be objects, got ${typeof obj1} and ${typeof obj2}`,
    );
    process.exit(1);
  }

  const missingKeys: string[] = [];
  const extraKeys: string[] = [];
  const invalidTypes: string[] = [];

  const pairs1 = pairsWithoutPlural(obj1);
  const pairs2 = pairsWithoutPlural(obj2);

  for (const pair of pairs1) {
    const key = pair.key;

    // Check if key is present in obj2
    const otherPair = pairs2.find((pair2) => pair2.key === key);
    if (!otherPair) {
      missingKeys.push(key);
      continue;
    }

    // Check type of value
    if (typeof pair.value !== typeof otherPair.value) {
      invalidTypes.push(key);
      continue;
    }

    const type = typeof pair.value;

    if (type === 'string') {
      // If value is a string, we're done
    } else if (type === 'object') {
      // If value is an object, recurse
      const {
        missingKeys: missingKeys2,
        extraKeys: extraKeys2,
        invalidTypes: invalidTypes2,
      } = deepKeysDiff(obj1[key], obj2[key]);

      // Prepend key to keys
      missingKeys.push(...missingKeys2.map((key2: string) => `${key}.${key2}`));
      extraKeys.push(...extraKeys2.map((key2: string) => `${key}.${key2}`));
      invalidTypes.push(
        ...invalidTypes2.map((key2: string) => `${key}.${key2}`),
      );
    } else {
      // If value is neither a string nor an object, this is invalid translation.
      invalidTypes.push(key);
    }
  }

  // Check if there are extra keys in obj2
  for (const pair of pairs2) {
    if (!pairs1.find((pair1) => pair1.key === pair.key)) {
      extraKeys.push(pair.key);
    }

    // No need to recurse here, we already checked all keys in obj1.
  }

  return {
    missingKeys,
    extraKeys,
    invalidTypes,
  };
};

// See docs here for supported suffixes:
// https://www.i18next.com/translation-function/plurals#languages-with-multiple-plurals
const plural_suffixes = ['zero', 'one', 'two', 'few', 'many', 'other'];

function stripPluralSuffix(key: string): string {
  for (const suffix of plural_suffixes) {
    if (key.endsWith(`#${suffix}`)) {
      return key.slice(0, -suffix.length - 1);
    }
  }

  return key;
}

function pairsWithoutPlural(obj: any) {
  const keys: { key: string; value: any }[] = [];
  for (const key in obj) {
    const isString = typeof obj[key] === 'string';

    if (isString) {
      keys.push({ key: stripPluralSuffix(key), value: obj[key] });
    } else {
      keys.push({ key, value: obj[key] });
    }
  }
  // Remove duplicates
  return keys.filter(
    (pair, index, self) => self.findIndex((p) => p.key === pair.key) === index,
  );
}

const validateFiles = async (
  localePath: string,
  defaultLocalePath: string,
  defaultLocaleFiles: string[],
) => {
  for (const defaultLocaleFile of defaultLocaleFiles) {
    const relativePath = path.relative(defaultLocalePath, defaultLocaleFile);
    const localeFile = path.join(localePath, relativePath);

    try {
      const defaultLocaleData = await import(
        pathToFileURL(defaultLocaleFile).href
      );
      const localeData = await import(pathToFileURL(localeFile).href);

      const { missingKeys, extraKeys, invalidTypes } = deepKeysDiff(
        defaultLocaleData,
        localeData,
      );

      if (missingKeys.length > 0) {
        console.error(`Missing keys in ${localeFile}:`, missingKeys);
      }

      if (extraKeys.length > 0) {
        console.error(`Extra keys in ${localeFile}:`, extraKeys);
      }

      if (invalidTypes.length > 0) {
        console.error(`Invalid types in ${localeFile}:`, invalidTypes);
      }

      if (
        missingKeys.length > 0 ||
        extraKeys.length > 0 ||
        invalidTypes.length > 0
      ) {
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error importing file ${localeFile}:`, error);
      process.exit(1);
    }
  }
};

const validate = async () => {
  // Ensure all locales are present
  const locales = readdirSync(localesFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const missingLocales = LOCALES.filter((locale) => !locales.includes(locale));

  if (missingLocales.length > 0) {
    console.error(`Missing locales: ${missingLocales}`);
    process.exit(1);
  }

  const extraLocales = locales.filter((locale) => !LOCALES.includes(locale));
  if (extraLocales.length > 0) {
    console.error(`Extra locales: ${extraLocales}`);
    process.exit(1);
  }

  // Validate default locale
  const defaultLocalePath = getLocalePath(defaultLocale);
  const defaultLocaleFiles = getFilesRecursively(defaultLocalePath);

  for (const locale of locales) {
    if (locale === defaultLocale) continue;

    const localePath = getLocalePath(locale);

    const localeFiles = getFilesRecursively(localePath);
    const defaultRelativePaths = defaultLocaleFiles.map((file) =>
      path.relative(defaultLocalePath, file),
    );
    const localeRelativePaths = localeFiles.map((file) =>
      path.relative(localePath, file),
    );

    const missingNamespaces = defaultRelativePaths.filter(
      (defaultFile) => !localeRelativePaths.includes(defaultFile),
    );

    if (missingNamespaces.length > 0) {
      console.error(`Missing namespaces in ${localePath}:`, missingNamespaces);
      process.exit(1);
    }

    const extraNamespaces = localeRelativePaths.filter(
      (localeFile) => !defaultRelativePaths.includes(localeFile),
    );

    if (extraNamespaces.length > 0) {
      console.error(`Extra namespaces in ${localePath}:`, extraNamespaces);
      process.exit(1);
    }

    // Validate keys
    await validateFiles(localePath, defaultLocalePath, defaultLocaleFiles);
  }

  console.log('All good! 🎉');
};

// Run validation only if script is called directly
if (import.meta.url === new URL('', import.meta.url).href) {
  validate();
}

export { deepKeysDiff };
