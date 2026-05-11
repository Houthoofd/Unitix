/**
 * @file index.mjs
 * @description Point d'entrée public de @clubmanager/test-generator.
 *
 * Quand ce package sera publié sur npm, les consommateurs importeront
 * uniquement depuis ce fichier :
 *
 *   import { generateTests } from '@clubmanager/test-generator';
 *
 * Tout ce qui n'est pas exporté ici est un détail d'implémentation interne.
 *
 * @module @clubmanager/test-generator
 */

export { generateTests } from './engine.mjs';
