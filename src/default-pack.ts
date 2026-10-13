/**
 * The bundled default content pack.
 *
 * Each locale's JSON files are imported at build time and inlined into the
 * published bundle, so the shipped package carries its content and needs no
 * filesystem or network access at runtime (browser or Node).
 */
import type { RoastEntry } from './types.js';

import enValidation from '../packs/default/en/validation.json' with { type: 'json' };
import enApplication from '../packs/default/en/application.json' with { type: 'json' };
import enDeveloper from '../packs/default/en/developer.json' with { type: 'json' };
import enMyValidation from '../packs/default/en-MY/validation.json' with { type: 'json' };
import enMyApplication from '../packs/default/en-MY/application.json' with { type: 'json' };
import enMyDeveloper from '../packs/default/en-MY/developer.json' with { type: 'json' };
import msMyValidation from '../packs/default/ms-MY/validation.json' with { type: 'json' };
import msMyApplication from '../packs/default/ms-MY/application.json' with { type: 'json' };
import msMyDeveloper from '../packs/default/ms-MY/developer.json' with { type: 'json' };

export const DEFAULT_PACK: readonly RoastEntry[] = [
  ...enValidation,
  ...enApplication,
  ...enDeveloper,
  ...enMyValidation,
  ...enMyApplication,
  ...enMyDeveloper,
  ...msMyValidation,
  ...msMyApplication,
  ...msMyDeveloper,
] as RoastEntry[];
