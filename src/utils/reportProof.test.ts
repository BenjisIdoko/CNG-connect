import { describe, it, expect } from 'vitest';
import { reportPhotoHint, reportProofProblem } from './reportProof';

// One degree of latitude is about 111,195 m.
const STATION = { lat: 9.0, lng: 7.4 };
const north = (meters: number) => ({ photoLat: STATION.lat + meters / 111195, photoLng: STATION.lng });
const PHOTO = 'data:image/jpeg;base64,AAAA';

const NO_PHOTO = 'Take a live photo at the station to post this report.';
const NO_POSITION = 'The photo needs your position at the station. Retake it.';
const TOO_FAR = 'The photo was taken too far from the station.';

describe('reportProofProblem', () => {
  it('accepts a photo with a position 100 m from the station', () => {
    expect(reportProofProblem({ photo: PHOTO, ...north(100) }, STATION)).toBeNull();
  });

  it('refuses a report with no photo, including an empty one, even with a position', () => {
    expect(reportProofProblem({ ...north(10) }, STATION)).toBe(NO_PHOTO);
    expect(reportProofProblem({ photo: '', ...north(10) }, STATION)).toBe(NO_PHOTO);
  });

  it('refuses a photo with no position, or with only one coordinate', () => {
    expect(reportProofProblem({ photo: PHOTO }, STATION)).toBe(NO_POSITION);
    expect(reportProofProblem({ photo: PHOTO, photoLat: 9.0 }, STATION)).toBe(NO_POSITION);
    expect(reportProofProblem({ photo: PHOTO, photoLng: 7.4 }, STATION)).toBe(NO_POSITION);
    expect(reportProofProblem({ photo: PHOTO, photoLat: Number.NaN, photoLng: 7.4 }, STATION)).toBe(NO_POSITION);
  });

  it('refuses a photo taken more than 800 m from the station and allows 799 m', () => {
    expect(reportProofProblem({ photo: PHOTO, ...north(801) }, STATION)).toBe(TOO_FAR);
    expect(reportProofProblem({ photo: PHOTO, ...north(799) }, STATION)).toBeNull();
    expect(reportProofProblem({ photo: PHOTO, ...north(300) }, STATION)).toBeNull(); // the back of a long queue
  });

  it('refuses when the station itself has no map position', () => {
    expect(reportProofProblem({ photo: PHOTO, ...north(10) }, { lat: Number.NaN, lng: Number.NaN })).toBe(TOO_FAR);
  });

  it('refuses a report built by a one-tap prompt (no photo, no position)', () => {
    expect(reportProofProblem({}, STATION)).toBe(NO_PHOTO);
  });
});

describe('reportPhotoHint', () => {
  it('tells a CNG driver what to photograph for each status', () => {
    expect(reportPhotoHint('full', false)).toBe('Photograph the pump meter');
    expect(reportPhotoHint('queue', false)).toBe('Photograph the queue');
    expect(reportPhotoHint('out', false)).toBe("Photograph the pump showing it's out");
  });

  it('tells an EV driver what to photograph for each status', () => {
    expect(reportPhotoHint('full', true)).toBe('Photograph the charger display');
    expect(reportPhotoHint('queue', true)).toBe('Photograph the busy ports');
    expect(reportPhotoHint('out', true)).toBe("Photograph the charger showing it's out of service");
  });

  it('gives no hint for an unknown status', () => {
    expect(reportPhotoHint('unknown', false)).toBe('');
    expect(reportPhotoHint('unknown', true)).toBe('');
  });
});
