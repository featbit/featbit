export const scenarios = Object.freeze({
  track: async stack => (await import('./track/index.mjs')).testTrack(stack),
  'sdk-server': async stack => (await import('./sdk-server/index.mjs')).testServerSdk(stack),
  'sdk-client': async stack => (await import('./sdk-client/index.mjs')).testClientSdk(stack),
  'interactive-demo': async stack => (await import('./interactive-demo/index.mjs')).testInteractiveDemo(stack),
});
