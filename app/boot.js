// Entry point: ?world=earth | ?world=mars opens that simulator; no world shows the landing page
// with both. The simulator code (Rapier, three.js) loads only after a world is chosen.
import {resolveWorld} from './worlds.js';

const world=resolveWorld();
if(world)await import('./main.js');
else (await import('./landing.js')).showLanding();
