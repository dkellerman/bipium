// @vitest-environment node
import { it, expect, vi, afterEach } from 'vitest';
import { lookupSongTempo } from '../../server/song-tempo.mjs';
const track = (title, artist, popularity, n = '1') => ({ id: n.repeat(8)+'-1111-1111-1111-111111111111', trackTitle: title, artists: [{ name: artist }], popularity, href: 'https://open.spotify.com/track/example' });
afterEach(() => vi.unstubAllGlobals());
it('matches the requested artist and caches the BPM', async () => {
 const fetcher = vi.fn().mockResolvedValueOnce(Response.json({content:[track('Example One','Wrong Artist',90),track('Example One','Right Artist',40,'2')]})).mockResolvedValueOnce(Response.json({tempo:117.002}));
 vi.stubGlobal('fetch',fetcher);
 const signal = new AbortController().signal;
 const song = await lookupSongTempo('Example One by Right Artist',signal);
 expect(song).toMatchObject({bpm:117,artist:'Right Artist',cached:false});
 expect(fetcher.mock.calls[1][0]).toContain('22222222');
 expect(await lookupSongTempo('Example One by Right Artist',signal)).toMatchObject({cached:true,bpm:117});
 expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not guess between similarly popular songs', async () => {
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({content:[track('Shared Title','Artist A',60),track('Shared Title','Artist B',58)]})));
 await expect(lookupSongTempo('Shared Title',new AbortController().signal)).rejects.toThrow('title and artist');
});
it('does not accept loosely related search results', async () => {
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({content:[track('Different title','Artist A',99)]})));
 await expect(lookupSongTempo('Missing title',new AbortController().signal)).rejects.toThrow('Couldn’t find');
});
it('rejects missing or invalid provider tempo', async () => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({content:[track('No BPM','Artist A',90)]})).mockResolvedValueOnce(Response.json({tempo:null})));
 await expect(lookupSongTempo('No BPM',new AbortController().signal)).rejects.toThrow('No usable BPM');
});
