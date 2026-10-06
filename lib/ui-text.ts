import catalog from './ui-catalog.json';

export type UiLanguage = 'en' | 'ms';
const messages: Record<string, string[]> = catalog;
/** Only translates registered interface messages, never guesses from slashes. */
export function uiText(language: UiLanguage) {
  return <T,>(value: T): T => {
    if (typeof value !== 'string') return value;
    const key = value.trim().replace(/\s+/g, ' ');
    const pair = Object.prototype.hasOwnProperty.call(messages, key) ? messages[key] : undefined;
    if (!pair) return value;
    return (value.match(/^\s*/)?.[0] + pair[language === 'ms' ? 1 : 0] + value.match(/\s*$/)?.[0]) as T;
  };
}
