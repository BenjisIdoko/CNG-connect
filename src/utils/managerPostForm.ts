import { ManagerPostDetails } from '../services/managerAccessService';
import { ManagerStateReason } from './managerState';
import { resolveExpectedBack } from './expectedBack';

/** What a manager has picked on the details part of their card. A typed clock time wins over an hours chip. */
export interface PostDetailsChoice {
  reason: ManagerStateReason | null;
  inHours: 1 | 2 | 4 | null;
  clock: string;
}

export type PostDetailsResult = { ok: true; details: ManagerPostDetails } | { ok: false; error: string };

/**
 * Turns the picks into what the database call needs, or a plain-language reason it cannot. Posting
 * details replaces the post's details, so when the manager changes only the reason the time the post
 * already has (`storedUntilIso`) is sent again, as long as it is still ahead; otherwise saving a new
 * reason would silently wipe the expected time drivers can see.
 */
export function buildPostDetails(choice: PostDetailsChoice, now = Date.now(), storedUntilIso?: string | null): PostDetailsResult {
  const details: ManagerPostDetails = {};
  if (choice.reason) details.reason = choice.reason;

  const clock = choice.clock.trim();
  if (clock) {
    const untilIso = resolveExpectedBack({ clock }, now);
    if (!untilIso) return { ok: false, error: 'Enter the time like 14:00' };
    details.untilIso = untilIso;
  } else if (choice.inHours) {
    const untilIso = resolveExpectedBack({ inHours: choice.inHours }, now);
    if (untilIso) details.untilIso = untilIso;
  }

  const nothingNewChosen = !details.reason && !details.untilIso;
  if (!details.untilIso && storedUntilIso) {
    const storedMs = Date.parse(storedUntilIso);
    if (Number.isFinite(storedMs) && storedMs > now) details.untilIso = storedUntilIso;
  }

  if (nothingNewChosen) return { ok: false, error: 'Choose a reason or an expected time first' };
  return { ok: true, details };
}
