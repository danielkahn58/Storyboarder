import { describe, it, expect } from 'vitest';
import {
  stripBase64ForSync,
  extractImages,
  mergeImages,
  mergeLocalIntoSbImages,
  stripImagesForVersion,
} from '../../public/lib/versioning.js';

describe('stripBase64ForSync', () => {
  it('nulls out bare data: URL strings but keeps http URLs', () => {
    const out = stripBase64ForSync({
      chars: { c1: { note: 'data:image/png;base64,AAAA', ref: 'https://cdn.example.com/a.png' } },
    });
    expect(out.chars.c1.note).toBeNull();
    expect(out.chars.c1.ref).toBe('https://cdn.example.com/a.png');
  });

  it('prefers cdnUrl/url over an existing base64 dataUrl on image objects', () => {
    const out = stripBase64ForSync({
      chars: {
        c1: { hero: { dataUrl: 'data:image/png;base64,AAAA', base64: 'AAAA', cdnUrl: 'https://cdn.example.com/hero.png' } },
      },
    });
    expect(out.chars.c1.hero.base64).toBeNull();
    expect(out.chars.c1.hero.dataUrl).toBe('https://cdn.example.com/hero.png');
  });

  it('nulls the dataUrl when no cdn/url is available on an image object', () => {
    const out = stripBase64ForSync({
      locs: { l1: { shot: { dataUrl: 'data:image/png;base64,AAAA', base64: 'AAAA' } } },
    });
    expect(out.locs.l1.shot.dataUrl).toBeNull();
    expect(out.locs.l1.shot.base64).toBeNull();
  });

  it('recurses into nested arrays and objects, not just top-level image keys', () => {
    const out = stripBase64ForSync({
      shots: {
        s1: {
          gallery: [
            { dataUrl: 'data:image/png;base64,AAAA', url: 'https://cdn.example.com/1.png' },
            'data:image/png;base64,BBBB',
          ],
        },
      },
    });
    expect(out.shots.s1.gallery[0].dataUrl).toBe('https://cdn.example.com/1.png');
    expect(out.shots.s1.gallery[1]).toBeNull();
  });

  it('passes through null/undefined unchanged', () => {
    expect(stripBase64ForSync(null)).toBeNull();
    expect(stripBase64ForSync(undefined)).toBeUndefined();
  });
});

describe('extractImages / mergeImages round trip', () => {
  const data = {
    characters: [{
      id: 'c1', name: 'Hero', images: ['img1.png'], referenceImage: 'ref.png',
      refImages: [{ id: 'r1', url: 'r1.png' }], expressionCache: { happy: 'happy.png' },
      angles: { front: { prompt: 'front view', useRef: true, image: 'front.png', refImage: 'ref-front.png' } },
    }],
    locations: [{
      id: 'l1', name: 'Alley', images: ['loc1.png'], referenceImage: 'locref.png',
      shotAngles: { wide: { prompt: 'wide shot', useRef: false, image: 'wide.png', refImage: null } },
      customViews: [{ id: 'cv1', name: 'top', prompt: 'top view', image: 'top.png', refImage: null }],
    }],
    shots: [{ id: 's1', description: 'opening shot', images: ['s1-1.png'], finalImage: 'final.png', refImage: 'sref.png', videoUrl: 'video.mp4' }],
  };

  it('extractImages strips image fields out of the returned data but keeps them in imgs', () => {
    const { stripped, imgs } = extractImages(data);

    expect(stripped.characters[0].images).toEqual([]);
    expect(stripped.characters[0].referenceImage).toBeNull();
    expect(stripped.characters[0].angles.front).toEqual({ prompt: 'front view', useRef: true });
    expect(imgs.chars.c1.images).toEqual(['img1.png']);
    expect(imgs.chars.c1.angles.front).toEqual({ image: 'front.png', refImage: 'ref-front.png' });

    expect(stripped.locations[0].images).toEqual([]);
    expect(imgs.locs.l1.customViews[0]).toEqual({ image: 'top.png', refImage: null });

    expect(stripped.shots[0].finalImage).toBeNull();
    expect(imgs.shots.s1.finalImage).toBe('final.png');
  });

  it('mergeImages reconstructs the original image data from a stripped copy + imgs', () => {
    const { stripped, imgs } = extractImages(data);
    const merged = mergeImages(stripped, imgs);

    expect(merged.characters[0].images).toEqual(data.characters[0].images);
    expect(merged.characters[0].referenceImage).toBe(data.characters[0].referenceImage);
    expect(merged.characters[0].angles.front.image).toBe('front.png');
    expect(merged.locations[0].shotAngles.wide.image).toBe('wide.png');
    expect(merged.locations[0].customViews[0].image).toBe('top.png');
    expect(merged.shots[0].finalImage).toBe('final.png');
    expect(merged.shots[0].videoUrl).toBe('video.mp4');
  });

  it('mergeImages is a no-op passthrough when imgs is falsy', () => {
    expect(mergeImages(data, null)).toBe(data);
  });
});

describe('mergeLocalIntoSbImages', () => {
  it('fills in fields missing from the cloud copy using the local copy', () => {
    const sb = { chars: { c1: { images: [], referenceImage: null } } };
    const local = { chars: { c1: { images: [], referenceImage: 'data:image/png;base64,AAAA' } } };
    const merged = mergeLocalIntoSbImages(sb, local);
    expect(merged.chars.c1.referenceImage).toBe('data:image/png;base64,AAAA');
  });

  it('prefers the cloud value when both sides have data', () => {
    const sb = { chars: { c1: { referenceImage: 'https://cdn.example.com/synced.png' } } };
    const local = { chars: { c1: { referenceImage: 'data:image/png;base64,AAAA' } } };
    const merged = mergeLocalIntoSbImages(sb, local);
    expect(merged.chars.c1.referenceImage).toBe('https://cdn.example.com/synced.png');
  });

  it('recurses into nested objects like angles', () => {
    const sb = { chars: { c1: { angles: { front: { image: null } } } } };
    const local = { chars: { c1: { angles: { front: { image: 'front.png' } } } } };
    const merged = mergeLocalIntoSbImages(sb, local);
    expect(merged.chars.c1.angles.front.image).toBe('front.png');
  });

  it('returns the other side unchanged when one side is missing entirely', () => {
    expect(mergeLocalIntoSbImages(null, { chars: {} })).toEqual({ chars: {} });
    expect(mergeLocalIntoSbImages({ chars: {} }, null)).toEqual({ chars: {} });
  });
});

describe('stripImagesForVersion', () => {
  it('keeps permanent http(s) image URLs', () => {
    const out = stripImagesForVersion({
      characters: [{ id: 'c1', name: 'Hero', angles: { front: { prompt: 'p', image: 'https://cdn.example.com/front.png' } } }],
      locations: [], shots: [],
    });
    expect(out.characters[0].angles.front.image).toBe('https://cdn.example.com/front.png');
  });

  it('strips blob: and base64 image data, keeping only the URL-shaped fields', () => {
    const out = stripImagesForVersion({
      characters: [{ id: 'c1', name: 'Hero', angles: { front: { prompt: 'p', image: 'blob:http://localhost/abc-123' } } }],
      locations: [], shots: [],
    });
    expect(out.characters[0].angles.front.image).toBeNull();
  });

  it('drops fields that are not part of the versioned character schema', () => {
    const out = stripImagesForVersion({
      characters: [{ id: 'c1', name: 'Hero', images: ['should-not-be-versioned.png'], expressionCache: { happy: 'x.png' } }],
      locations: [], shots: [],
    });
    expect(out.characters[0].images).toBeUndefined();
    expect(out.characters[0].expressionCache).toBeUndefined();
  });

  it('filters out compose layers that have no permanent image URL', () => {
    const out = stripImagesForVersion({
      characters: [], locations: [],
      shots: [{
        id: 's1',
        composeLayers: [
          { imgUrl: 'https://cdn.example.com/layer1.png', label: 'char', cx: 0, cy: 0, scale: 1, w: 1, h: 1 },
          { imgUrl: 'blob:http://localhost/temp', label: 'char2', cx: 0, cy: 0, scale: 1, w: 1, h: 1 },
        ],
      }],
    });
    expect(out.shots[0].composeLayers).toHaveLength(1);
    expect(out.shots[0].composeLayers[0].imgUrl).toBe('https://cdn.example.com/layer1.png');
  });

  it('keeps project-level fields like animatics and visual styles as-is', () => {
    const out = stripImagesForVersion({
      characters: [], locations: [], shots: [],
      visualStyles: [{ id: 'v1', name: 'Noir' }],
      animatics: [{ id: 'a1', url: 'https://cdn.example.com/animatic.mp4' }],
    });
    expect(out.visualStyles).toEqual([{ id: 'v1', name: 'Noir' }]);
    expect(out.animatics).toEqual([{ id: 'a1', url: 'https://cdn.example.com/animatic.mp4' }]);
  });
});
