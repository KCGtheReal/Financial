import { describe, it, expect } from 'vitest';
import { en, TranslationKey } from '../src/i18n/en';
import { km } from '../src/i18n/km';
import { t } from '../src/i18n';

describe('i18n Full Parity & Translation Coverage', () => {
  const enKeys = Object.keys(en) as TranslationKey[];
  const kmKeys = Object.keys(km) as TranslationKey[];

  it('maintains 100% key parity between English and Khmer dictionaries', () => {
    expect(enKeys.length).toBe(kmKeys.length);
    for (const key of enKeys) {
      expect(km[key]).toBeDefined();
      expect(typeof km[key]).toBe('string');
      expect(km[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('correctly translates quick date filter range chips', () => {
    expect(t('allTime', 'km')).toBe('ទាំងអស់');
    expect(t('today', 'km')).toBe('ថ្ងៃនេះ');
    expect(t('last7Days', 'km')).toBe('៧ ថ្ងៃ');
    expect(t('thisMonth', 'km')).toBe('ខែនេះ');
  });

  it('correctly translates account type labels into Khmer', () => {
    expect(t('account_bank', 'km')).toBe('គណនីធនាគារ');
    expect(t('account_savings', 'km')).toBe('គណនីសន្សំ');
    expect(t('account_credit_card', 'km')).toBe('កាតឥណទាន');
    expect(t('account_e_wallet', 'km')).toBe('កាបូបអេឡិចត្រូនិក (KHQR)');
    expect(t('account_cash', 'km')).toBe('កាបូបសាច់ប្រាក់');
  });

  it('correctly translates settings and privacy controls into Khmer', () => {
    expect(t('securityPrivacy', 'km')).toBe('សុវត្ថិភាព និងភាពឯកជន');
    expect(t('appPinLock', 'km')).toBe('សោសម្ងាត់កម្មវិធី (PIN)');
    expect(t('preferences', 'km')).toBe('ចំណូលចិត្ត និងរូបរាង');
    expect(t('themeAppearance', 'km')).toBe('ទម្រង់ផ្ទៃខាងក្រោយ');
  });
});
