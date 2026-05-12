/**
 * @file index.mjs
 * @description Point d'entrée public de @houthoofd/unitix.
 *
 * API publique :
 *
 *   import { generateTests }      from '@houthoofd/unitix'; // config manuelle
 *   import { generateTestsAuto }  from '@houthoofd/unitix'; // détection auto
 *   import { detectArchitecture } from '@houthoofd/unitix'; // détection seule
 *
 * Tout ce qui n'est pas exporté ici est un détail d'implémentation interne.
 *
 * @module @houthoofd/unitix
 */

export { generateTests, generateTestsAuto } from "./core/engine.mjs";
export { detectArchitecture } from "./detectors/architecture-detector.mjs";
