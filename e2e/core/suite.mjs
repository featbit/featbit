import { openStack, stopStack } from './stack.mjs';
import { prepareStack, runScenario, saveFailure } from './lifecycle.mjs';
import { scenarios } from './scenarios/index.mjs';

export async function runSuite({ names, imageVersion, runId, scenario, build = false, keepEnvironment = false }, operations = {
  openStack, prepareStack, runScenario, stopStack, saveFailure,
}) {
  const results = [];
  const selectedScenarios = scenario ? [scenario] : Object.keys(scenarios);
  for (const [index, name] of names.entries()) {
    let stack, cleanupFailed = false;
    try {
      stack = await operations.openStack(name, { imageVersion, runId });
      await operations.prepareStack(stack, { build: scenario ? build : !imageVersion && index === 0, reuse: Boolean(scenario) });
      for (const scenario of selectedScenarios) {
        try {
          await operations.runScenario(stack, scenario);
          results.push({ stack: name, scenario, passed: true });
        } catch (error) {
          results.push({ stack: name, scenario, passed: false, error: error.message });
          await operations.saveFailure(stack, `${scenario}-failure.log`, error);
        }
      }
    } catch (error) {
      results.push({ stack: name, phase: 'preparation', passed: false, error: error.message });
      if (stack) await operations.saveFailure(stack, 'preparation-failure.log', error);
      else console.error(`[${name}] ${error.message}`);
    } finally {
      if (stack && keepEnvironment) {
        console.log(`[keep] ${name}: environment retained by --keep-environment`);
      } else if (stack) {
        try {
          await operations.stopStack(stack);
          console.log(`[down] ${name}: services and test data volumes removed`);
        } catch (error) {
          cleanupFailed = true;
          results.push({ stack: name, phase: 'cleanup', passed: false, error: error.message });
          await operations.saveFailure(stack, 'cleanup-failure.log', error);
        }
      }
    }
    if (cleanupFailed) break;
  }
  return results;
}
