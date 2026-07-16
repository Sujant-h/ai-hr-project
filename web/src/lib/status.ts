import type { components } from '../api/types';

type MatchResultOut = components['schemas']['MatchResultOut'];
type Status = MatchResultOut['status'];

/**
 * All four statuses render distinctly. Collapsing `offen` into `nicht_erfuellt`
 * would hide the difference between "the CV does not say" and "the CV says no" —
 * exactly the distinction a recruiter needs to decide whether to ask.
 */
export const STATUS_LABEL: Record<Status, string> = {
  erfuellt: 'Erfüllt',
  teilweise: 'Teilweise',
  offen: 'Offen',
  nicht_erfuellt: 'Nicht erfüllt',
};

export const STATUS_CLASS: Record<Status, string> = {
  erfuellt: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  teilweise: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  offen: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  nicht_erfuellt: 'bg-red-100 text-red-800 hover:bg-red-100',
};

export function metCount(matches: MatchResultOut[]): number {
  return matches.filter((m) => m.status === 'erfuellt').length;
}
