/**
 * What Prism keeps about a recipe source in recipe_sources.provider_config.
 * One shape for every route that reads or writes it.
 */
export interface RecipeSourceConfig {
  /** Whether the token can write back to the server (#1205). */
  canWrite?: boolean;
  writeCheckedAt?: string;
  /**
   * The meal-plan entry ids Prism held a meal for after the last meal sync
   * (#1206). An entry still in the source but no longer in Prism was removed
   * in Prism, and is offered as a removal to send back.
   */
  mealEntryIds?: string[];
  /** The same for recipes (#1207): a recipe deleted in Prism is offered, unticked, as a deletion. */
  recipeIds?: string[];
}

export function readSourceConfig(value: unknown): RecipeSourceConfig {
  return value && typeof value === 'object' ? (value as RecipeSourceConfig) : {};
}
